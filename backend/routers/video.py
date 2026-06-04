import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from models.schemas import RenderRequest, RenderStatus
from services.storage import local_file_path, upload_file, use_local_storage
from workers.render import render_jobs, run_render_job

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


@router.post("/render", response_model=RenderStatus)
async def start_render(request: RenderRequest, background_tasks: BackgroundTasks):
    """Start video render job in background, returns job_id to poll."""
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
