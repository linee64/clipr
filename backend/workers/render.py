import asyncio
import os
import shutil
from pathlib import Path

from services.editor import (
    add_background_audio,
    apply_color_grade,
    burn_subtitles_ass,
    burn_text_overlay,
    check_ffmpeg,
    concatenate_clips,
    detect_beats,
    generate_ass_simple,
    generate_description,
    get_duration,
    resize_for_platform,
    snap_clips_to_beats,
    transcribe_audio,
    trim_clip,
    trim_clip_to_duration,
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
    subtitle_preset: str,
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
                getattr(clip, "mute", False),
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
        if audio_file_id and str(audio_file_id).strip():
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
        if add_subtitles:
            segments = await asyncio.to_thread(transcribe_audio, after_audio_path)
            ass_path = os.path.join(job_dir, "subtitles.ass")
            generate_ass_simple(segments, ass_path, subtitle_preset)

            with_subs_path = os.path.join(job_dir, "with_subs.mp4")
            await asyncio.to_thread(
                burn_subtitles_ass, after_audio_path, ass_path, with_subs_path
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


async def run_broll_render(
    job_id: str,
    scenes: list,
    clip_ids: list,
    audio_file_id: str,
    audio_volume: float,
    color_grade: str,
    platform: str,
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

        render_jobs[job_id]["progress"] = 5
        processed_clips = []

        for i, (scene, clip_id) in enumerate(zip(scenes, clip_ids)):
            raw_path = os.path.join(job_dir, f"raw_{i}.mp4")
            trimmed_path = os.path.join(job_dir, f"trimmed_{i}.mp4")
            graded_path = os.path.join(job_dir, f"graded_{i}.mp4")

            await download_file(f"clips/{clip_id}.mp4", raw_path)
            await asyncio.to_thread(
                trim_clip_to_duration,
                raw_path,
                trimmed_path,
                scene["duration_seconds"],
            )
            await asyncio.to_thread(
                apply_color_grade, trimmed_path, graded_path, color_grade
            )
            processed_clips.append(graded_path)

        render_jobs[job_id]["progress"] = 30

        audio_path = os.path.join(job_dir, "music.mp3")
        await download_file(f"audio/{audio_file_id}.mp3", audio_path)
        beat_times = await asyncio.to_thread(detect_beats, audio_path)

        render_jobs[job_id]["progress"] = 40

        snapped_clips = await asyncio.to_thread(
            snap_clips_to_beats, processed_clips, beat_times, job_dir
        )
        render_jobs[job_id]["progress"] = 55

        concat_path = os.path.join(job_dir, "concat.mp4")
        await asyncio.to_thread(concatenate_clips, snapped_clips, concat_path)
        render_jobs[job_id]["progress"] = 65

        with_audio_path = os.path.join(job_dir, "with_audio.mp4")
        await asyncio.to_thread(
            add_background_audio, concat_path, audio_path, with_audio_path, audio_volume
        )
        render_jobs[job_id]["progress"] = 75

        current_time = 0.0
        scenes_with_timing = []
        for scene in scenes:
            scenes_with_timing.append({**scene, "start_time": current_time})
            current_time += scene["duration_seconds"]

        with_text_path = os.path.join(job_dir, "with_text.mp4")
        await asyncio.to_thread(
            burn_text_overlay, with_audio_path, with_text_path, scenes_with_timing
        )
        render_jobs[job_id]["progress"] = 88

        final_path = os.path.join(job_dir, "final.mp4")
        await asyncio.to_thread(resize_for_platform, with_text_path, final_path, platform)
        render_jobs[job_id]["progress"] = 95

        remote = f"rendered/{job_id}_broll_final.mp4"
        url = await upload_file(final_path, remote)

        render_jobs[job_id]["status"] = "done"
        render_jobs[job_id]["progress"] = 100
        render_jobs[job_id]["output_url"] = url

        shutil.rmtree(job_dir, ignore_errors=True)

    except Exception as e:
        render_jobs[job_id]["status"] = "error"
        render_jobs[job_id]["error"] = str(e)
