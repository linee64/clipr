import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from models.schemas import (
    BeatSyncRequest,
    BrollRenderRequest,
    RenderRequest,
    RenderStatus,
    SilenceDetectRequest,
    SilenceRemoveRequest,
    SubtitleStyleRequest,
)
from services.editor import (
    apply_beat_sync_transitions,
    burn_subtitles_ass,
    detect_beats,
    detect_silence,
    generate_ass_simple,
    get_duration,
    remove_silence,
    segments_from_text,
    transcribe_audio,
)
from services.storage import download_file, local_file_path, upload_file, use_local_storage
from workers.render import render_jobs, run_broll_render, run_render_job

router = APIRouter(prefix="/api/video", tags=["video"])

TEMP_DIR = str(Path(__file__).resolve().parent.parent / "temp")
os.makedirs(TEMP_DIR, exist_ok=True)


async def _upload_one_clip(file: UploadFile) -> dict:
    clip_id = str(uuid.uuid4())
    temp_path = os.path.join(TEMP_DIR, f"{clip_id}_upload.mp4")

    async with aiofiles.open(temp_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    remote_path = f"clips/{clip_id}.mp4"
    url = await upload_file(temp_path, remote_path)
    os.remove(temp_path)

    return {"clip_id": clip_id, "url": url, "filename": file.filename or ""}


@router.get("/files/{file_path:path}")
async def get_stored_file(file_path: str):
    """Dev mode: serve files saved locally when Supabase is not configured."""
    if not use_local_storage():
        raise HTTPException(status_code=404, detail="Not available with Supabase storage")
    path = local_file_path(file_path)
    if not path.is_file():
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


@router.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload background audio file, returns audio_file_id."""
    audio_id = str(uuid.uuid4())
    temp_path = os.path.join(TEMP_DIR, f"{audio_id}_audio.mp3")

    async with aiofiles.open(temp_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    remote_path = f"audio/{audio_id}.mp3"
    url = await upload_file(temp_path, remote_path)
    os.remove(temp_path)

    return {"audio_file_id": audio_id, "url": url}


@router.post("/silence/detect")
async def silence_detect(request: SilenceDetectRequest):
    """Detect silent moments in a clip."""
    try:
        local_path = os.path.join(TEMP_DIR, f"{request.clip_id}_silence_check.mp4")
        await download_file(f"clips/{request.clip_id}.mp4", local_path)

        silences = detect_silence(local_path, request.threshold, request.min_duration)
        duration = get_duration(local_path)

        os.remove(local_path)

        return {
            "clip_id": request.clip_id,
            "total_duration": round(duration, 2),
            "silence_count": len(silences),
            "silence_segments": silences,
            "total_silence_seconds": round(sum(s["duration"] for s in silences), 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        local_audio = os.path.join(TEMP_DIR, f"{audio_file_id}_analyze.mp3")
        await download_file(f"audio/{audio_file_id}.mp3", local_audio)

        beats = detect_beats(local_audio)
        os.remove(local_audio)

        return {
            "audio_file_id": audio_file_id,
            "beat_count": len(beats),
            "beat_timestamps": beats,
            "avg_bpm": round(60 / (beats[1] - beats[0]), 1) if len(beats) > 1 else 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    render_jobs[request.job_id] = {
        "status": "pending",
        "progress": 0,
        "output_url": "",
        "description": "",
        "error": "",
    }

    background_tasks.add_task(
        run_broll_render,
        job_id=request.job_id,
        scenes=[s.model_dump() for s in request.scenes],
        clip_ids=request.clip_ids,
        audio_file_id=request.audio_file_id,
        audio_volume=request.audio_volume,
        color_grade=request.color_grade,
        platform=request.platform,
        beats_per_clip=request.beats_per_clip,
    )

    return {"job_id": request.job_id, "status": "pending"}


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
    if job_id not in render_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = render_jobs[job_id]
    return RenderStatus(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        output_url=job["output_url"],
        description=job["description"],
        error=job["error"],
    )
