import asyncio
import aiofiles
import os
import re
import uuid
import json
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form

from models.schemas import BYOCCreateRequest, RenderStatus
from services import jobstore, usage
from services.editor import get_duration
from services.storage import download_file, upload_file, use_local_storage
from services.templates import get_template, DEFAULT_TEMPLATE
from workers.render import render_jobs, run_broll_render, get_clip_remote_path
from services.reference_analyzer import (
    download_reference_video,
    extract_reference_audio,
    analyze_reference_cuts,
    analyze_reference_subtitles,
    analyze_reference_colors,
    build_custom_grade_filter,
)

router = APIRouter(prefix="/api/byoc", tags=["byoc"])

TEMP_DIR = str(Path(__file__).resolve().parent.parent / "temp")


@router.post("/upload")
async def upload_byoc_clip(
    user_id: str,
    session_id: str,
    file: UploadFile = File(...)
):
    try:
        clip_id = str(uuid.uuid4())
        temp_path = os.path.join(TEMP_DIR, f"{clip_id}_byoc_upload.mp4")
        
        async with aiofiles.open(temp_path, "wb") as f:
            content = await file.read()
            await f.write(content)
            
        remote_path = f"byoc/{user_id}/{session_id}/{clip_id}.mp4"
        
        upload_path = temp_path
        compressed_path = None
        try:
            if os.path.getsize(temp_path) > 8 * 1024 * 1024:
                from services.editor import compress_clip_for_upload
                compressed_path = os.path.join(TEMP_DIR, f"{clip_id}_byoc_c.mp4")
                await asyncio.to_thread(compress_clip_for_upload, temp_path, compressed_path)
                upload_path = compressed_path
            
            url = await upload_file(upload_path, remote_path)
        finally:
            for p in (temp_path, compressed_path):
                if p and os.path.exists(p):
                    os.remove(p)
                    
        return {
            "clip_id": f"byoc/{user_id}/{session_id}/{clip_id}",
            "url": url,
            "storage": "local" if use_local_storage() else "supabase"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def parse_srt(srt_content: str) -> list[dict]:
    import re
    lines = [line.strip() for line in srt_content.splitlines()]
    segments = []
    i = 0
    
    def parse_time(t_str):
        h, m, s_ms = t_str.split(":")
        s, ms = s_ms.split(",")
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    while i < len(lines):
        if not lines[i]:
            i += 1
            continue
        
        if not re.match(r'^\d+$', lines[i]):
            i += 1
            continue
            
        i += 1
        if i >= len(lines): break
        
        times = lines[i].split("-->")
        if len(times) != 2:
            continue
            
        start = times[0].strip()
        end = times[1].strip()
        
        i += 1
        if i >= len(lines): break
        
        text_lines = []
        while i < len(lines) and lines[i]:
            text_lines.append(lines[i])
            i += 1
            
        try:
            segments.append({
                "start": parse_time(start),
                "end": parse_time(end),
                "text": " ".join(text_lines)
            })
        except Exception:
            pass

    return segments


def split_script_into_scenes(script_text: str, n_clips: int) -> list[str]:
    script_text = script_text.strip()
    if script_text.startswith("{") and '"pattern_type"' in script_text:
        # Pass the full JSON as the first phrase so render.py can parse it
        return [script_text] + [""] * max(0, n_clips - 1)
        
    lines = [line.strip() for line in script_text.split("\n") if line.strip()]
    if not lines:
        lines = [""]
    
    if len(lines) == n_clips:
        return lines
    elif len(lines) > n_clips:
        result = lines[:n_clips-1]
        result.append(" ".join(lines[n_clips-1:]))
        return result
    else:
        return lines + [""] * (n_clips - len(lines))


@router.post("/create")
async def create_byoc_render(request: BYOCCreateRequest, background_tasks: BackgroundTasks):
    allowed_email = "aidaraltynbek02@gmail.com"
    if (request.email or "").strip().lower() != allowed_email:
        raise HTTPException(
            status_code=403,
            detail="My Clips is coming soon for other accounts!"
        )

    if not request.clip_ids:
        raise HTTPException(status_code=400, detail="No clips provided")
    
    template = get_template(request.template_id) or DEFAULT_TEMPLATE
    
    # 1. Quota reservation (same as broll_render)
    video_reserved = False
    try:
        await usage.reserve_video(request.email)
        video_reserved = True
        await usage.require_template_allowed(request.email, request.template_id)
    except usage.PremiumRequired as e:
        if video_reserved:
            await usage.refund_video(request.email)
        raise HTTPException(status_code=403, detail=f"{e} Upgrade to unlock it.")
    except usage.QuotaExceeded as e:
        if video_reserved:
            await usage.refund_video(request.email)
        raise HTTPException(status_code=429, detail=f"Quota exceeded: {e}")

    # 2. Determine clip durations for the unique clips provided
    clip_durations = []
    
    try:
        for i, clip_id in enumerate(request.clip_ids):
            temp_path = os.path.join(TEMP_DIR, f"byoc_dur_{uuid.uuid4()}.mp4")
            try:
                await download_file(get_clip_remote_path(clip_id), temp_path)
                dur = await asyncio.to_thread(get_duration, temp_path)
                clip_durations.append(dur)
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
    except Exception as e:
        if video_reserved:
            await usage.refund_video(request.email)
        raise HTTPException(status_code=400, detail=f"Failed to read clip durations: {str(e)}")

    # 3. The template's exact_timings determine the real scene count (from reference).
    #    The user may have uploaded fewer clips (e.g. 6 for a 23-scene reference),
    #    so we cycle clips + phrases with modulo to fill all scenes.
    exact_timings = template.get("pacing", {}).get("exact_timings", [])
    total_scenes = len(exact_timings) if exact_timings else len(request.clip_ids)
    n_clips = len(request.clip_ids)

    # 4. Parse script/subtitles for total_scenes lines
    if request.script and "-->" in request.script and not request.subtitles_file:
        request.subtitles_file = request.script

    if request.subtitles_file:
        try:
            srt_segments = parse_srt(request.subtitles_file)
            phrases = []
            if len(srt_segments) <= total_scenes:
                phrases = [seg["text"] for seg in srt_segments]
                phrases += [""] * (total_scenes - len(phrases))
            else:
                group_size = len(srt_segments) // total_scenes
                for g in range(total_scenes):
                    if g == total_scenes - 1:
                        group = srt_segments[g * group_size:]
                    else:
                        group = srt_segments[g * group_size:(g + 1) * group_size]
                    phrases.append(" ".join(seg["text"] for seg in group))
        except Exception:
            phrases = split_script_into_scenes(request.script, total_scenes)
    else:
        phrases = split_script_into_scenes(request.script, total_scenes)

    # Build scenes cycling through the user's clips
    scenes = []
    for i in range(total_scenes):
        clip_idx = i % n_clips
        dur = clip_durations[clip_idx]
        phrase = phrases[i] if i < len(phrases) else ""
        role = "hook" if i == 0 else ("punch" if i == total_scenes - 1 else "body")
        scenes.append({
            "order": i + 1,
            "phrase": phrase,
            "film_suggestion": "User BYOC clip",
            "duration_seconds": dur,
            "role": role
        })

    # 5. Resolve background music track if not provided
    audio_file_id = request.audio_file_id
    if not audio_file_id:
        audio_file_id = template.get("recommended_track") or "dark_ambient"

    render_jobs[request.job_id] = {
        "status": "pending",
        "progress": 0,
        "output_url": "",
        "description": "",
        "error": "",
    }
    jobstore.start_heartbeat(request.job_id)

    background_tasks.add_task(
        run_broll_render,
        job_id=request.job_id,
        scenes=scenes,
        clip_ids=request.clip_ids,
        audio_file_id=audio_file_id,
        audio_volume=0.6,
        color_grade=template.get("color_grade", "dark_cinematic"),
        platform=request.platform,
        email=request.email,
        template_id=request.template_id,
        add_voiceover=False,
        add_subtitles=request.burn_subtitles,
        source="byoc",
        subtitles_srt=request.subtitles_file or "",
    )

    return {"job_id": request.job_id, "status": "pending"}


@router.post("/analyze-reference")
async def analyze_reference(
    url: str | None = Form(None),
    email: str = Form(""),
    file: UploadFile | None = File(None)
):
    temp_video_path = None
    if file and file.filename:
        ref_id = str(uuid.uuid4())
        temp_video_path = os.path.join(TEMP_DIR, f"{ref_id}_ref_uploaded.mp4")
        async with aiofiles.open(temp_video_path, "wb") as f:
            content = await file.read()
            await f.write(content)
    elif url:
        try:
            temp_video_path = await asyncio.to_thread(download_reference_video, url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to download video from URL: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Either file or url must be provided")

    try:
        # 1. Extract audio
        audio_path = await asyncio.to_thread(extract_reference_audio, temp_video_path)
        audio_id = str(uuid.uuid4())
        remote_audio_path = f"audio/{audio_id}.mp3"
        audio_url = await upload_file(audio_path, remote_audio_path)
        if os.path.exists(audio_path):
            os.remove(audio_path)

        # 2. Get duration
        dur = await asyncio.to_thread(get_duration, temp_video_path)

        # 3. Analyze cuts / transitions
        cuts = await asyncio.to_thread(analyze_reference_cuts, temp_video_path, dur)
        
        # Calculate scene counts and timings
        exact_timings = []
        if len(cuts) == 0:
            exact_timings = [dur]
        else:
            prev = 0.0
            for cut in cuts:
                exact_timings.append(round(cut - prev, 3))
                prev = cut
            exact_timings.append(round(dur - prev, 3))

        # Filter out extremely small cuts
        exact_timings = [t for t in exact_timings if t >= 0.2]
        avg_cut_len = dur / (len(exact_timings) or 1)

        # 4. Analyze subtitles (pass cuts + duration so Gemini Vision can run per-scene)
        sub_info = await asyncio.to_thread(analyze_reference_subtitles, temp_video_path, cuts, dur)

        # 5. Analyze colors
        colors = await asyncio.to_thread(analyze_reference_colors, temp_video_path)
        grade_filter = build_custom_grade_filter(colors)

        # 6. Save template dynamically to templates.json
        from services.templates import TEMPLATES_PATH
        templates = []
        if TEMPLATES_PATH.exists():
            try:
                templates = json.loads(TEMPLATES_PATH.read_text(encoding="utf-8"))
            except Exception:
                templates = []

        template_id = f"ref-custom-{str(uuid.uuid4())[:8]}"
        label = "Custom Reference"
        if url:
            label = f"Ref: {url.split('//')[-1].split('/')[0]}"
        elif file:
            label = f"Ref: {file.filename or 'Uploaded file'}"

        # Strip per_frame_texts from the pattern before saving to the template
        # (it's large and only needed for the immediate API response)
        pattern_for_template = dict(sub_info.get("subtitle_pattern") or {})
        pattern_for_template.pop("per_frame_texts", None)
        scene_contexts = sub_info.get("scene_contexts", [])

        new_template = {
            "id": template_id,
            "label": label,
            "platforms": ["all"],
            "scene_count": [len(exact_timings), len(exact_timings)],
            "pacing": {
                "target_cut_len": round(avg_cut_len, 2),
                "max_cuts_per_scene": 5,
                "zooms": [1.0, 1.12],
                "exact_timings": exact_timings
            },
            "caption_style": sub_info["caption_style"],
            "caption_font": sub_info["caption_font"],
            "caption_alignment": sub_info["caption_alignment"],
            "caption_marginv": sub_info.get("caption_marginv", 150),
            "caption_uppercase": sub_info["caption_uppercase"],
            "caption_bold": sub_info.get("caption_bold", False),
            "caption_active_color": sub_info.get("caption_active_color", "&H9EE500&"),
            "color_grade": "custom",
            "grade_filter": grade_filter,
            "recommended_track": audio_id,
            "is_custom": True,
            "ref": label,
            "ref_subtitles": sub_info.get("detected_texts", []),
            "avg_words_per_line": sub_info.get("avg_words_per_line", 4),
            "subtitle_pattern": pattern_for_template,
            "scene_contexts": scene_contexts,
        }

        templates.append(new_template)
        TEMPLATES_PATH.write_text(json.dumps(templates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        return {
            "status": "success",
            "template": {
                "id": template_id,
                "label": label,
                "recommended_track": audio_id,
                "audio_url": audio_url,
                "scene_count": len(exact_timings),
                "ref_subtitles": sub_info.get("detected_texts", []),
                "avg_words_per_line": sub_info.get("avg_words_per_line", 4),
                "caption_style": sub_info["caption_style"],
                "caption_alignment": sub_info["caption_alignment"],
                "caption_marginv": sub_info.get("caption_marginv", 150),
                "caption_font": sub_info["caption_font"],
                "caption_uppercase": sub_info["caption_uppercase"],
                "caption_bold": sub_info.get("caption_bold", False),
                "caption_active_color": sub_info.get("caption_active_color", "&H9EE500&"),
                "subtitle_pattern": pattern_for_template,
                "scene_contexts": scene_contexts,
                "exact_timings": exact_timings,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reference analysis failed: {str(e)}")
    finally:
        if temp_video_path and os.path.exists(temp_video_path):
            os.remove(temp_video_path)


@router.post("/transcribe-music")
async def transcribe_music(
    audio_url: str = Form(...),
):
    """
    Transcribe the reference track using faster-whisper.
    Returns a list of subtitle lines with optional timestamps.
    Used in the BYOC Step 3 UI to auto-fill subtitles from song lyrics.
    """
    import httpx
    import tempfile

    tmp_path = None
    try:
        # Download audio file
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(audio_url)
            resp.raise_for_status()

        suffix = ".mp3"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=TEMP_DIR) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        # Transcribe with faster-whisper
        def _transcribe(path: str) -> list[str]:
            try:
                from faster_whisper import WhisperModel
                import datetime
                model = WhisperModel("base", device="cpu", compute_type="int8")
                segments, _ = model.transcribe(path, beam_size=3, language=None, word_timestamps=True)
                
                def format_time(seconds):
                    td = datetime.timedelta(seconds=seconds)
                    tot_sec = int(td.total_seconds())
                    hours = tot_sec // 3600
                    minutes = (tot_sec % 3600) // 60
                    secs = tot_sec % 60
                    ms = int((seconds - tot_sec) * 1000)
                    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"

                lines = []
                srt_lines = []
                srt_index = 1
                for seg in segments:
                    if not seg.words:
                        continue
                    
                    # Chunk words into max 3 words
                    words_list = seg.words
                    n = 3
                    for i in range(0, len(words_list), n):
                        chunk = words_list[i:i + n]
                        chunk_text = " ".join([w.word.strip() for w in chunk])
                        if not chunk_text:
                            continue
                        
                        start_time = chunk[0].start
                        end_time = chunk[-1].end
                        
                        srt_lines.append(str(srt_index))
                        srt_lines.append(f"{format_time(start_time)} --> {format_time(end_time)}")
                        srt_lines.append(chunk_text)
                        srt_lines.append("")
                        srt_index += 1
                        lines.append(chunk_text)

                return lines, "\n".join(srt_lines)
            except Exception as exc:
                raise RuntimeError(f"Whisper transcription failed: {exc}")

        lines, srt_script = await asyncio.to_thread(_transcribe, tmp_path)
        return {"lines": lines, "script": srt_script}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
