import asyncio
import os
import shutil
from pathlib import Path

from services.editor import (
    WHISPER_ENABLED,
    add_background_audio,
    burn_subtitles,
    check_ffmpeg,
    concatenate_clips,
    generate_description,
    generate_srt,
    get_duration,
    resize_for_platform,
    transcribe_audio,
    trim_clip,
)
from services.storage import download_file, upload_file

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = str(BACKEND_DIR / "temp")
render_jobs: dict = {}


async def run_render_job(
    job_id: str,
    clips: list,
    audio_file_id: str,
    audio_volume: float,
    add_subtitles: bool,
    platform: str,
    script_summary: str,
):
    render_jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "output_url": "",
        "description": "",
        "error": "",
    }

    try:
        job_dir = os.path.join(TEMP_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        await asyncio.to_thread(check_ffmpeg)

        render_jobs[job_id]["progress"] = 5
        trimmed_paths = []

        for clip in sorted(clips, key=lambda x: x.order):
            raw_path = os.path.join(job_dir, f"raw_{clip.clip_id}.mp4")
            trimmed_path = os.path.join(job_dir, f"trimmed_{clip.clip_id}.mp4")

            await download_file(f"clips/{clip.clip_id}.mp4", raw_path)

            duration = await asyncio.to_thread(get_duration, raw_path)
            await asyncio.to_thread(
                trim_clip,
                raw_path,
                trimmed_path,
                clip.trim_start,
                clip.trim_end,
                duration,
            )
            trimmed_paths.append(trimmed_path)

        render_jobs[job_id]["progress"] = 20

        concat_path = os.path.join(job_dir, "concat.mp4")
        await asyncio.to_thread(concatenate_clips, trimmed_paths, concat_path)
        render_jobs[job_id]["progress"] = 40

        resized_path = os.path.join(job_dir, "resized.mp4")
        await asyncio.to_thread(resize_for_platform, concat_path, resized_path, platform)
        render_jobs[job_id]["progress"] = 50

        after_audio_path = resized_path
        if audio_file_id:
            audio_path = os.path.join(job_dir, "background.mp3")
            await download_file(f"audio/{audio_file_id}.mp3", audio_path)
            with_audio_path = os.path.join(job_dir, "with_audio.mp4")
            await asyncio.to_thread(
                add_background_audio,
                resized_path,
                audio_path,
                with_audio_path,
                audio_volume,
            )
            after_audio_path = with_audio_path

        render_jobs[job_id]["progress"] = 60

        final_path = after_audio_path
        if add_subtitles and WHISPER_ENABLED:
            segments = await asyncio.to_thread(transcribe_audio, after_audio_path)
            srt_path = os.path.join(job_dir, "subtitles.srt")
            generate_srt(segments, srt_path)

            with_subs_path = os.path.join(job_dir, "with_subs.mp4")
            await asyncio.to_thread(
                burn_subtitles, after_audio_path, srt_path, with_subs_path, platform
            )
            final_path = with_subs_path

        render_jobs[job_id]["progress"] = 85

        try:
            description = await asyncio.to_thread(
                generate_description, script_summary, platform
            )
        except Exception:
            description = script_summary
        render_jobs[job_id]["description"] = description
        render_jobs[job_id]["progress"] = 90

        output_remote = f"rendered/{job_id}_final.mp4"
        output_url = await upload_file(final_path, output_remote)

        render_jobs[job_id]["status"] = "done"
        render_jobs[job_id]["progress"] = 100
        render_jobs[job_id]["output_url"] = output_url

        shutil.rmtree(job_dir, ignore_errors=True)

    except Exception as e:
        render_jobs[job_id]["status"] = "error"
        render_jobs[job_id]["error"] = str(e)
