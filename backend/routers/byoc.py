import asyncio
import aiofiles
import os
import re
import uuid
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File

from models.schemas import BYOCCreateRequest, RenderStatus
from services import jobstore, usage
from services.editor import get_duration
from services.storage import download_file, upload_file, use_local_storage
from services.templates import get_template, DEFAULT_TEMPLATE
from workers.render import render_jobs, run_broll_render, get_clip_remote_path

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
    # Parse SRT content into list of segments with start, end, text
    pattern = re.compile(
        r"(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n((?:[^\n]+\n*)+)"
    )
    matches = pattern.findall(srt_content.strip() + "\n")
    
    def parse_time(t_str):
        h, m, s_ms = t_str.split(":")
        s, ms = s_ms.split(",")
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    segments = []
    for match in matches:
        num, start, end, text = match
        segments.append({
            "start": parse_time(start),
            "end": parse_time(end),
            "text": text.strip().replace("\n", " ")
        })
    return segments


def split_script_into_scenes(script_text: str, n_clips: int) -> list[str]:
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

    # 2. Determine clip durations
    scenes = []
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

    # 3. Parse script/subtitles and create scenes mapping
    if request.subtitles_file:
        try:
            srt_segments = parse_srt(request.subtitles_file)
            # Combine SRT segments into n_clips blocks
            phrases = []
            if len(srt_segments) <= len(request.clip_ids):
                phrases = [seg["text"] for seg in srt_segments]
                phrases += [""] * (len(request.clip_ids) - len(phrases))
            else:
                # Group SRT segments
                group_size = len(srt_segments) // len(request.clip_ids)
                for g in range(len(request.clip_ids)):
                    if g == len(request.clip_ids) - 1:
                        group = srt_segments[g * group_size:]
                    else:
                        group = srt_segments[g * group_size:(g + 1) * group_size]
                    phrases.append(" ".join(seg["text"] for seg in group))
        except Exception:
            phrases = split_script_into_scenes(request.script, len(request.clip_ids))
    else:
        phrases = split_script_into_scenes(request.script, len(request.clip_ids))

    for i, (clip_id, dur, phrase) in enumerate(zip(request.clip_ids, clip_durations, phrases)):
        role = "hook" if i == 0 else ("punch" if i == len(request.clip_ids) - 1 else "body")
        scenes.append({
            "order": i + 1,
            "phrase": phrase,
            "film_suggestion": "User BYOC clip",
            "duration_seconds": dur,
            "role": role
        })

    # 4. Resolve background music track if not provided
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
        add_voiceover=False,  # BYOC usually doesn't need AI voiceover, but keeps layout
        add_subtitles=request.burn_subtitles,
        source="byoc",
    )

    return {"job_id": request.job_id, "status": "pending"}
