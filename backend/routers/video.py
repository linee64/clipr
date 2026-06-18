import asyncio
import base64
import os
import uuid
from pathlib import Path

import aiofiles
import httpx
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from models.schemas import (
    BeatSyncRequest,
    BrollRenderRequest,
    ClipUploadResponse,
    PexelsImportRequest,
    RenderRequest,
    RenderStatus,
    SilenceDetectRequest,
    SilenceRemoveRequest,
    SubtitleStyleRequest,
    VoiceoverPreviewRequest,
)
from services.editor import (
    apply_beat_sync_transitions,
    burn_subtitles_ass,
    compress_clip_for_upload,
    detect_beats,
    detect_silence,
    generate_ass_simple,
    get_duration,
    remove_silence,
    segments_from_text,
    transcode_to_mp3,
    transcribe_audio,
)
from services import jobstore, pexels, tts, usage
from services.storage import (
    LOCAL_STORAGE_ROOT,
    download_file,
    upload_file,
    use_local_storage,
)
from services.tracks import get_tracks_with_urls
from workers.render import render_jobs, run_broll_render, run_render_job

router = APIRouter(prefix="/api/video", tags=["video"])

TEMP_DIR = str(Path(__file__).resolve().parent.parent / "temp")
os.makedirs(TEMP_DIR, exist_ok=True)


# Clips larger than this are downscaled/re-encoded to 1080p before upload. Phone
# footage (4K HEVC) otherwise exceeds the storage bucket's per-file size limit
# (Supabase free tier = 50 MB -> a 413 that reads as a frozen upload) and takes
# minutes to transfer. The render only works at <=1080p, so this is lossless to the
# output. Small clips pass through untouched (byte-identical to before).
_COMPRESS_OVER_BYTES = 8 * 1024 * 1024
# Hard cap on a Pexels download so a huge/hostile response can't exhaust memory or
# fill the disk. Real portrait HD clips are well under this; it's just a safety net.
_PEXELS_MAX_BYTES = 300 * 1024 * 1024


async def _store_clip_from_temp(clip_id: str, temp_path: str) -> str:
    """Compress (if over the size threshold) then upload temp_path to
    clips/<clip_id>.mp4, returning the stored URL. Always cleans up the temp files.
    Shared by the file-upload route and the Pexels import route so both paths produce
    an identical clips/<id>.mp4 the render can download."""
    upload_path = temp_path
    compressed_path = None
    if os.path.getsize(temp_path) > _COMPRESS_OVER_BYTES:
        compressed_path = os.path.join(TEMP_DIR, f"{clip_id}_c.mp4")
        await asyncio.to_thread(compress_clip_for_upload, temp_path, compressed_path)
        upload_path = compressed_path

    remote_path = f"clips/{clip_id}.mp4"
    try:
        return await upload_file(upload_path, remote_path)
    finally:
        for p in (temp_path, compressed_path):
            if p and os.path.exists(p):
                os.remove(p)


async def _upload_one_clip(file: UploadFile) -> dict:
    clip_id = str(uuid.uuid4())
    temp_path = os.path.join(TEMP_DIR, f"{clip_id}_upload.mp4")

    async with aiofiles.open(temp_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    url = await _store_clip_from_temp(clip_id, temp_path)
    return {"clip_id": clip_id, "url": url, "filename": file.filename or ""}


@router.get("/files/{file_path:path}")
async def get_stored_file(file_path: str):
    """Dev mode: serve files saved locally when Supabase is not configured."""
    if not use_local_storage():
        raise HTTPException(status_code=404, detail="Not available with Supabase storage")
    # {file_path:path} preserves slashes and Starlette does NOT strip "..", so a request
    # like ../../.env (or an absolute path) would otherwise escape the storage root and
    # read arbitrary files. Resolve and require the result to stay inside the root.
    root = LOCAL_STORAGE_ROOT.resolve()
    path = (root / file_path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@router.post("/upload/clip")
async def upload_clip(file: UploadFile = File(...)):
    """Upload one video clip per request. For several clips, call again or use /upload/clips."""
    try:
        result = await _upload_one_clip(file)
        return {
            "clip_id": result["clip_id"],
            "url": result["url"],
            "storage": "local" if use_local_storage() else "supabase",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload/clips")
async def upload_clips(files: list[UploadFile] = File(...)):
    """Upload several clips in one request (same field name `files` for each file)."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    try:
        clips = [await _upload_one_clip(f) for f in files]
        return {
            "clips": clips,
            "count": len(clips),
            "storage": "local" if use_local_storage() else "supabase",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pexels-import", response_model=ClipUploadResponse)
async def pexels_import(request: PexelsImportRequest):
    """Import a picked Pexels stock video as a render clip.

    The frontend sends only the Pexels video id; the server re-resolves the mp4 link
    from Pexels (never downloads a client-supplied URL), streams it to disk under a
    size cap, then runs it through the same compress+store path as an upload. Returns
    the same {clip_id, url, storage} shape as /upload/clip, so a Pexels pick is
    interchangeable with an uploaded file.
    """
    clip_id = str(uuid.uuid4())
    temp_path = os.path.join(TEMP_DIR, f"{clip_id}_pexels.mp4")
    try:
        link = await pexels.get_download_url(request.video_id)
        # Stream to disk (never buffer the whole body in RAM) and abort if it blows
        # past the cap, so a huge/hostile response can't exhaust memory or disk.
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0), follow_redirects=True
        ) as client:
            async with client.stream("GET", link) as resp:
                resp.raise_for_status()
                written = 0
                async with aiofiles.open(temp_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(256 * 1024):
                        written += len(chunk)
                        if written > _PEXELS_MAX_BYTES:
                            raise pexels.PexelsError("Pexels video is too large to import.")
                        await f.write(chunk)
        url = await _store_clip_from_temp(clip_id, temp_path)
    except pexels.PexelsNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except (pexels.PexelsError, httpx.HTTPError) as e:
        raise HTTPException(status_code=502, detail=f"Couldn't import the Pexels video: {e}")
    except Exception as e:
        # Storage/processing failure (e.g. upload_file raising) — surface a clean 502
        # rather than a generic 500. (HTTPExceptions raised above pass straight through.)
        raise HTTPException(status_code=502, detail=f"Couldn't import the Pexels video: {e}")
    finally:
        # _store_clip_from_temp deletes temp_path on the success path; this is the
        # fallback for the paths where the download failed before it ran.
        if os.path.exists(temp_path):
            os.remove(temp_path)
    return {
        "clip_id": clip_id,
        "url": url,
        "storage": "local" if use_local_storage() else "supabase",
    }


@router.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload background audio, transcode to a clean mp3, returns audio_file_id."""
    audio_id = str(uuid.uuid4())
    src_ext = os.path.splitext(file.filename or "")[1] or ".bin"
    src_path = os.path.join(TEMP_DIR, f"{audio_id}_src{src_ext}")
    mp3_path = os.path.join(TEMP_DIR, f"{audio_id}_audio.mp3")

    async with aiofiles.open(src_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    try:
        # Normalize any uploaded format (m4a/aac/wav/ogg/...) to real mp3 so beat
        # detection and mixing never choke on a mislabeled file downstream.
        await asyncio.to_thread(transcode_to_mp3, src_path, mp3_path)
        remote_path = f"audio/{audio_id}.mp3"
        url = await upload_file(mp3_path, remote_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Audio processing failed: {e}")
    finally:
        for p in (src_path, mp3_path):
            if os.path.exists(p):
                os.remove(p)

    return {"audio_file_id": audio_id, "url": url}


@router.get("/tracks")
async def list_tracks():
    """Built-in template tracks for creators without their own music."""
    return {"tracks": await get_tracks_with_urls()}


@router.post("/silence/detect")
async def silence_detect(request: SilenceDetectRequest):
    """Detect silent moments in a clip."""
    local_path = os.path.join(TEMP_DIR, f"{request.clip_id}_silence_check.mp4")
    try:
        await download_file(f"clips/{request.clip_id}.mp4", local_path)

        silences = detect_silence(local_path, request.threshold, request.min_duration)
        duration = get_duration(local_path)

        return {
            "clip_id": request.clip_id,
            "total_duration": round(duration, 2),
            "silence_count": len(silences),
            "silence_segments": silences,
            "total_silence_seconds": round(sum(s["duration"] for s in silences), 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Always clean up the downloaded clip — detect_silence/get_duration can raise
        # (e.g. a corrupt clip), and the success-path os.remove would then be skipped,
        # leaking full-size files that fill the render box's small disk over time.
        if os.path.exists(local_path):
            os.remove(local_path)


@router.post("/silence/remove")
async def silence_remove(request: SilenceRemoveRequest, background_tasks: BackgroundTasks):
    """Automatically remove silent segments from one or more clips."""
    # Map each source clip to a freshly generated output clip id.
    clip_map = [(clip_id, str(uuid.uuid4())) for clip_id in request.clip_ids]

    async def run_one(clip_id: str, new_clip_id: str):
        try:
            job_dir = os.path.join(TEMP_DIR, f"silence_{new_clip_id}")
            os.makedirs(job_dir, exist_ok=True)

            input_path = os.path.join(job_dir, "input.mp4")
            output_path = os.path.join(job_dir, "cleaned.mp4")

            await download_file(f"clips/{clip_id}.mp4", input_path)
            remove_silence(input_path, output_path, request.threshold)

            remote = f"clips/{new_clip_id}.mp4"
            await upload_file(output_path, remote)

            import shutil

            shutil.rmtree(job_dir, ignore_errors=True)

        except Exception as e:
            print(f"Silence remove error for {clip_id}: {e}")

    async def run():
        for clip_id, new_clip_id in clip_map:
            await run_one(clip_id, new_clip_id)

    background_tasks.add_task(run)
    return {
        "status": "processing",
        "results": [
            {"clip_id": clip_id, "new_clip_id": new_clip_id}
            for clip_id, new_clip_id in clip_map
        ],
    }


@router.post("/beat-sync")
async def beat_sync(request: BeatSyncRequest, background_tasks: BackgroundTasks):
    """Analyze audio beats and sync clip transitions to beat timestamps."""
    render_jobs[request.job_id] = {
        "status": "processing",
        "progress": 0,
        "output_url": "",
        "description": "",
        "error": "",
    }
    jobstore.start_heartbeat(request.job_id)

    async def run():
        try:
            job_dir = os.path.join(TEMP_DIR, request.job_id)
            os.makedirs(job_dir, exist_ok=True)

            render_jobs[request.job_id]["progress"] = 10
            clip_paths = []
            for clip_id in request.clip_ids:
                local = os.path.join(job_dir, f"{clip_id}.mp4")
                await download_file(f"clips/{clip_id}.mp4", local)
                clip_paths.append(local)

            render_jobs[request.job_id]["progress"] = 30
            audio_local = os.path.join(job_dir, "beat_audio.mp3")
            await download_file(f"audio/{request.audio_file_id}.mp3", audio_local)

            render_jobs[request.job_id]["progress"] = 50
            output_path = os.path.join(job_dir, "beat_synced.mp4")
            apply_beat_sync_transitions(
                clip_paths,
                audio_local,
                output_path,
                request.transition_type,
                request.fade_duration,
                request.add_subtitles,
                request.subtitle_preset,
            )

            render_jobs[request.job_id]["progress"] = 90
            remote = f"rendered/{request.job_id}_beat_synced.mp4"
            url = await upload_file(output_path, remote)

            render_jobs[request.job_id]["status"] = "done"
            render_jobs[request.job_id]["progress"] = 100
            render_jobs[request.job_id]["output_url"] = url

            import shutil

            shutil.rmtree(job_dir, ignore_errors=True)

        except Exception as e:
            render_jobs[request.job_id]["status"] = "error"
            render_jobs[request.job_id]["error"] = str(e)

    background_tasks.add_task(run)
    return {"job_id": request.job_id, "status": "processing"}


@router.post("/beat-sync/analyze")
async def analyze_beats(audio_file_id: str):
    """Analyze audio and return beat timestamps for timeline visualization."""
    local_audio = os.path.join(TEMP_DIR, f"{audio_file_id}_analyze.mp3")
    try:
        await download_file(f"audio/{audio_file_id}.mp3", local_audio)

        beats = detect_beats(local_audio)

        return {
            "audio_file_id": audio_file_id,
            "beat_count": len(beats),
            "beat_timestamps": beats,
            "avg_bpm": round(60 / (beats[1] - beats[0]), 1) if len(beats) > 1 else 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up even if detect_beats raises, so repeated failures can't fill the disk.
        if os.path.exists(local_audio):
            os.remove(local_audio)


@router.get("/subtitles/preview")
async def subtitle_presets_list():
    """Returns available subtitle presets with descriptions."""
    return {
        "presets": [
            {
                "id": "tiktok_bold",
                "label": "TikTok Bold",
                "description": "Large bold white text, thick black outline, bottom center",
            },
            {
                "id": "plaque",
                "label": "Plaque",
                "description": "White text on dark semi-transparent background",
            },
            {
                "id": "center_caps",
                "label": "Center Caps",
                "description": "Uppercase bold text centered on screen, aggressive look",
            },
        ]
    }


@router.post("/subtitles/apply")
async def apply_subtitles(request: SubtitleStyleRequest, background_tasks: BackgroundTasks):
    """Apply subtitle style preset to an already rendered video."""
    render_jobs[request.job_id] = {
        "status": "processing",
        "progress": 0,
        "output_url": "",
        "description": "",
        "error": "",
    }
    jobstore.start_heartbeat(request.job_id)

    async def run():
        try:
            job_dir = os.path.join(TEMP_DIR, request.job_id)
            os.makedirs(job_dir, exist_ok=True)

            render_jobs[request.job_id]["progress"] = 20
            video_local = os.path.join(job_dir, "input.mp4")
            await download_file(f"rendered/{request.video_file_id}", video_local)

            render_jobs[request.job_id]["progress"] = 50
            ass_path = os.path.join(job_dir, "subs.ass")
            if request.audio_file_id:
                audio_local = os.path.join(job_dir, "lyrics_audio.mp3")
                await download_file(f"audio/{request.audio_file_id}.mp3", audio_local)
                segments = transcribe_audio(audio_local)
            elif request.custom_text:
                duration = get_duration(video_local)
                segments = segments_from_text(request.custom_text, duration)
            else:
                segments = transcribe_audio(video_local)
            generate_ass_simple(segments, ass_path, request.preset)

            render_jobs[request.job_id]["progress"] = 75
            output_path = os.path.join(job_dir, "with_subs.mp4")
            burn_subtitles_ass(video_local, ass_path, output_path)

            render_jobs[request.job_id]["progress"] = 90
            remote = f"rendered/{request.job_id}_subtitled.mp4"
            url = await upload_file(output_path, remote)

            render_jobs[request.job_id]["status"] = "done"
            render_jobs[request.job_id]["progress"] = 100
            render_jobs[request.job_id]["output_url"] = url

            import shutil

            shutil.rmtree(job_dir, ignore_errors=True)

        except Exception as e:
            render_jobs[request.job_id]["status"] = "error"
            render_jobs[request.job_id]["error"] = str(e)

    background_tasks.add_task(run)
    return {"job_id": request.job_id, "status": "processing"}


@router.post("/broll-render")
async def broll_render(request: BrollRenderRequest, background_tasks: BackgroundTasks):
    """Full aesthetic b-roll render: clips + phrases + music → graded video with text."""
    # Fail fast (and match /voiceover/preview's contract) rather than silently rendering
    # without voiceover when it was asked for but no voice was chosen.
    if request.add_voiceover and not (request.voice_id or "").strip():
        raise HTTPException(
            status_code=400,
            detail="voice_id is required when add_voiceover is enabled.",
        )

    # Server-side free-tier enforcement (Pro bypasses all of it). Premium reference
    # style / AI voice are Pro-only (403); AI-voiceover renders are metered (429).
    try:
        await usage.require_template_allowed(request.email, request.template_id)
        if request.add_voiceover:
            await usage.require_voice_allowed(request.email, request.voice_id)
            # Gate up front (429 if already over the limit) but DON'T charge yet: the
            # render runs in the background and can fail/OOM, or fall back to a music-only
            # mix if TTS hiccups. The credit is recorded inside the worker only once a
            # voiceover is actually produced (workers/render.py), so a failed or
            # voiceover-less render never burns one of the 2 free AI-voiceover credits.
            await usage.check_quota(request.email, "voiceover")
    except usage.PremiumRequired as e:
        raise HTTPException(status_code=403, detail=f"{e} Upgrade to unlock it.")
    except usage.QuotaExceeded as e:
        raise HTTPException(
            status_code=429,
            detail=f"You've used your {e.limit} free AI voiceovers. Upgrade to Pro for unlimited.",
        )

    # Note: seeding a template track into storage (an upload that can take seconds on
    # a cold worker) happens inside run_broll_render now, not here — so this request
    # returns immediately and the client starts polling real progress right away
    # instead of waiting on the seed before the job even exists.
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
        email=request.email,
        scenes=[s.model_dump() for s in request.scenes],
        clip_ids=request.clip_ids,
        audio_file_id=request.audio_file_id,
        audio_volume=request.audio_volume,
        color_grade=request.color_grade,
        platform=request.platform,
        beats_per_clip=request.beats_per_clip,
        template_id=request.template_id,
        music_start=request.music_start,
        add_voiceover=request.add_voiceover,
        voice_id=request.voice_id,
        vo_speed=request.vo_speed,
        vo_volume=request.vo_volume,
        bg_music_volume=request.bg_music_volume,
    )

    return {"job_id": request.job_id, "status": "pending"}


@router.get("/voices")
async def list_voices():
    """List the ElevenLabs voices available for AI voiceover (for the picker)."""
    try:
        voices = await asyncio.to_thread(tts.get_available_voices)
        return {"voices": voices}
    except tts.TTSNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except tts.TTSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/voiceover/preview")
async def voiceover_preview(request: VoiceoverPreviewRequest):
    """Synthesize a short sample line in the chosen voice and return it as a base64
    mp3, so the picker can play a preview without a render. Kept small + synchronous;
    the audio is base64 in the JSON body (no temp file is left on the server)."""
    if not (request.voice_id or "").strip():
        raise HTTPException(status_code=400, detail="voice_id is required.")
    tmp_path = os.path.join(TEMP_DIR, f"vo_preview_{uuid.uuid4()}.mp3")
    try:
        await asyncio.to_thread(
            tts.text_to_speech, request.text, tmp_path, request.voice_id, request.speed
        )
        async with aiofiles.open(tmp_path, "rb") as f:
            data = await f.read()
        return {
            "audio_base64": base64.b64encode(data).decode("ascii"),
            "content_type": "audio/mpeg",
        }
    except tts.TTSNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except tts.TTSError as e:
        raise HTTPException(status_code=502, detail=str(e))
    finally:
        # Best-effort cleanup — a transient remove failure (e.g. AV scanner holding the
        # file briefly on Windows) must not mask the real response/error.
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass


@router.post("/render", response_model=RenderStatus)
async def start_render(request: RenderRequest, background_tasks: BackgroundTasks):
    """Start final video render job in background, returns job_id to poll."""
    render_jobs[request.job_id] = {
        "status": "pending",
        "progress": 0,
        "output_url": "",
        "description": "",
        "error": "",
    }
    jobstore.start_heartbeat(request.job_id)

    background_tasks.add_task(
        run_render_job,
        job_id=request.job_id,
        clips=request.clips,
        audio_file_id=request.audio_file_id,
        audio_volume=request.audio_volume,
        add_subtitles=request.add_subtitles,
        subtitle_preset=request.subtitle_preset,
        platform=request.platform,
        script_summary=request.script_summary,
    )

    return RenderStatus(job_id=request.job_id, status="pending", progress=0)


@router.get("/render/{job_id}", response_model=RenderStatus)
async def get_render_status(job_id: str):
    """Poll render job status — frontend polls this every 3 seconds."""
    job = render_jobs.get(job_id)
    if job is None:
        # In-memory copy gone (e.g. the render process restarted mid-render). Fall
        # back to the durable mirror so a poll survives a restart instead of 404-ing
        # forever as "Job not found".
        job = await jobstore.read_remote(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    status = job.get("status", "")
    error = job.get("error", "")
    if jobstore.is_stale(job):
        # Heartbeat went cold while still "processing" -> the worker died mid-render
        # (almost always out of memory). Surface a clear reason, not a stuck bar.
        status = "error"
        error = jobstore.INTERRUPTED_MSG

    return RenderStatus(
        job_id=job_id,
        status=status,
        progress=job.get("progress", 0),
        output_url=job.get("output_url", ""),
        description=job.get("description", ""),
        error=error,
    )
