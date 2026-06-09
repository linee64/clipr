import asyncio
import os
import shutil
from pathlib import Path

from services.editor import (
    add_background_audio,
    add_background_audio_only,
    build_scene_timings_from_cuts,
    burn_subtitles_ass,
    check_ffmpeg,
    concatenate_clips,
    detect_beats,
    extract_montage_cut,
    generate_ass_karaoke,
    generate_ass_simple,
    generate_description,
    get_duration,
    montage_scene_windows,
    plan_scene_cuts,
    resize_for_platform,
    transcribe_audio,
    trim_clip,
)
from services.storage import download_file, upload_file
from services.templates import (
    DEFAULT_TEMPLATE,
    caption_preset_of,
    caption_style_of,
    get_template,
    pacing_of,
)

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
    beats_per_clip: int = 2,  # kept for API stability; b-roll pacing now comes from the template
    template_id: str = "",
):
    render_jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "output_url": "",
        "description": "",
        "error": "",
    }

    try:
        if not scenes or not clip_ids:
            raise ValueError("No scenes or clips provided for render.")
        if len(scenes) != len(clip_ids):
            raise ValueError(
                f"scene/clip count mismatch: {len(scenes)} scenes vs "
                f"{len(clip_ids)} clips"
            )

        job_dir = os.path.join(TEMP_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        render_jobs[job_id]["progress"] = 5

        audio_path = os.path.join(job_dir, "music.mp3")
        await download_file(f"audio/{audio_file_id}.mp3", audio_path)
        beat_times = await asyncio.to_thread(detect_beats, audio_path)

        resolution = "1920:1080" if platform == "LinkedIn" else "1080:1920"

        # Style template drives pacing + caption style (falls back to defaults).
        template = get_template(template_id) or DEFAULT_TEMPLATE
        pacing = pacing_of(template)
        target_cut_len = pacing["target_cut_len"]
        max_cuts = pacing["max_cuts_per_scene"]
        zooms = pacing["zooms"]
        caption_style = caption_style_of(template)
        # Template owns the whole look: grade comes from the template too (not just
        # the request payload), so the color can't drift from pacing/captions.
        grade = template.get("color_grade") or color_grade or "dark_cinematic"
        # Tone-matched custom grade (built from the reference's measured colors) wins
        # over the preset name; caption font/size vary per template too.
        grade_filter = template.get("grade_filter") or grade
        caption_preset = caption_preset_of(template)

        # Lay scenes on the video timeline with each scene change snapped to an
        # audible beat (same clock the captions use).
        windows = await asyncio.to_thread(
            montage_scene_windows,
            [s["duration_seconds"] for s in scenes],
            beat_times,
            target_cut_len,
        )

        render_jobs[job_id]["progress"] = 15

        # Slice every uploaded clip into several beat-synced montage cuts. A handful
        # of source clips becomes a fast sequence of jump cuts instead of a slideshow.
        cut_paths: list[str] = []
        scene_cut_counts: list[int] = []
        cut_idx = 0
        total = max(1, len(scenes))

        for i, (scene, clip_id) in enumerate(zip(scenes, clip_ids)):
            raw_path = os.path.join(job_dir, f"raw_{i}.mp4")
            await download_file(f"clips/{clip_id}.mp4", raw_path)
            src_dur = await asyncio.to_thread(get_duration, raw_path)

            window_start, window_len = windows[i]
            cuts = plan_scene_cuts(
                window_start, window_len, src_dur, beat_times,
                target_cut_len, max_cuts, zooms,
            )

            for cut in cuts:
                out_path = os.path.join(job_dir, f"cut_{cut_idx:03d}.mp4")
                await asyncio.to_thread(
                    extract_montage_cut,
                    raw_path,
                    out_path,
                    cut["src_offset"],
                    cut["length"],
                    cut["zoom"],
                    grade_filter,
                    resolution,
                )
                cut_paths.append(out_path)
                cut_idx += 1

            scene_cut_counts.append(len(cuts))
            render_jobs[job_id]["progress"] = 15 + int(30 * (i + 1) / total)

        render_jobs[job_id]["progress"] = 45

        concat_path = os.path.join(job_dir, "concat.mp4")
        await asyncio.to_thread(concatenate_clips, cut_paths, concat_path)
        render_jobs[job_id]["progress"] = 62

        with_audio_path = os.path.join(job_dir, "with_audio.mp4")
        await asyncio.to_thread(
            add_background_audio_only,
            concat_path,
            audio_path,
            with_audio_path,
            audio_volume,
        )
        render_jobs[job_id]["progress"] = 75

        # Measure real scene windows from the rendered cuts so word timing is exact.
        scenes_with_timing = await asyncio.to_thread(
            build_scene_timings_from_cuts, cut_paths, scene_cut_counts, scenes
        )

        ass_path = os.path.join(job_dir, "broll_captions.ass")
        if caption_style == "karaoke":
            await asyncio.to_thread(
                generate_ass_karaoke,
                scenes_with_timing,
                beat_times,
                ass_path,
                "karaoke",
                resolution,
                caption_preset,
            )
        else:
            # one static phrase per scene in the template's caption style
            segments = [
                {
                    "start": s["start_time"],
                    "end": s["start_time"] + max(0.1, s["duration_seconds"] - 0.04),
                    "text": s.get("phrase", ""),
                }
                for s in scenes_with_timing
                if s.get("phrase")
            ]
            await asyncio.to_thread(
                generate_ass_simple,
                segments,
                ass_path,
                caption_style,
                resolution,
                caption_preset,
            )

        final_path = os.path.join(job_dir, "final.mp4")
        await asyncio.to_thread(
            burn_subtitles_ass, with_audio_path, ass_path, final_path
        )
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
