import asyncio
import os
import shutil
import traceback
from pathlib import Path

from services.editor import (
    add_background_audio,
    add_background_audio_only,
    apply_end_fade,
    apply_music_hook_lead,
    beat_interval_seconds,
    build_scene_timings_from_cuts,
    burn_subtitles_ass,
    check_ffmpeg,
    concatenate_clips,
    detect_beats,
    detect_hook_offset,
    extract_montage_cut,
    generate_ass_karaoke,
    generate_ass_kinetic,
    generate_ass_simple,
    generate_description,
    get_duration,
    measure_brightness,
    mix_voiceover_per_scene,
    montage_scene_windows,
    plan_accel_cut_montage,
    plan_beat_cut_montage,
    plan_scene_cuts,
    resolve_text_cards,
    render_text_card,
    retime_text_cards_to_voice,
    adjust_voiceover_and_cards,
    resize_for_platform,
    split_montage_at_time,
    transcribe_audio,
    trim_montage_to_time,
    trim_montage_to_ratio,
    trim_clip,
)
from services.storage import download_file, upload_file, use_local_storage
from services.tracks import ensure_track_seeded
from services.tts import generate_single_voiceover
from services.templates import (
    DEFAULT_TEMPLATE,
    cap_total_duration,
    caption_preset_of,
    caption_style_of,
    get_template,
    pacing_of,
)

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = str(BACKEND_DIR / "temp")
# Shared, restart-safe job store (mirrored to storage by a heartbeat). Kept under
# the old name so existing imports (`from workers.render import render_jobs`) and
# all the `render_jobs[job_id][...] = ...` updates keep working unchanged.
from services.jobstore import jobs as render_jobs  # noqa: E402
from services import jobstore, usage  # noqa: E402


def _render_resolution(platform: str, full_res: str) -> str:
    """The frame size to render at. Defaults to full res; RENDER_LONG_EDGE can shrink
    it (e.g. 1280 -> 720x1280) to cut encode memory on a small instance. Captions are
    still authored on the full-res canvas, so libass scales them down 1:1."""
    try:
        long_edge = int(os.getenv("RENDER_LONG_EDGE", "1920") or "1920")
    except ValueError:
        long_edge = 1920
    if long_edge >= 1920:
        return full_res
    long_edge -= long_edge % 2
    short = round(long_edge * 9 / 16)
    short -= short % 2
    return f"{long_edge}:{short}" if platform == "LinkedIn" else f"{short}:{long_edge}"


def _cut_concurrency() -> int:
    """How many montage cuts to encode at once. Each cut is an independent single-pass
    ffmpeg encode to its own file, so they parallelize cleanly — but N concurrent
    libx264 encodes is N× the peak memory, a prime OOM trigger on a small box (and
    os.cpu_count() reports the HOST's cores in a container, so the old min(4, cpu)
    could fan out to 4 encodes there). So: serial (1) whenever the render is downscaled
    to fit a constrained box (RENDER_LONG_EDGE < 1920); parallel for speed only on a
    full-res box. Override either way with RENDER_CUT_CONCURRENCY."""
    raw = (os.getenv("RENDER_CUT_CONCURRENCY") or "").strip()
    if raw:
        try:
            return max(1, int(raw))
        except ValueError:
            pass
    try:
        long_edge = int(os.getenv("RENDER_LONG_EDGE", "1920") or "1920")
    except ValueError:
        long_edge = 1920
    if long_edge < 1920:
        return 1  # memory-constrained deploy: encode cuts one at a time
    return max(1, min(4, os.cpu_count() or 2))


async def _extract_cuts_parallel(specs: list[dict], on_progress=None) -> None:
    """Run extract_montage_cut for each spec with bounded concurrency. Each spec is
    the kwargs for one cut; outputs go to distinct paths so order is preserved by the
    caller's path naming, not by completion order. on_progress(done, total) fires as
    cuts finish (in completion order)."""
    if not specs:
        return
    sem = asyncio.Semaphore(_cut_concurrency())
    lock = asyncio.Lock()
    done = 0

    async def _one(spec: dict):
        nonlocal done
        async with sem:
            await asyncio.to_thread(extract_montage_cut, **spec)
        if on_progress is not None:
            async with lock:
                done += 1
                on_progress(done, len(specs))

    await asyncio.gather(*(_one(s) for s in specs))


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
        # Mirror the terminal state to durable storage NOW, not on the next heartbeat
        # tick (up to HEARTBEAT_SECS away): an OOM-kill in that window would otherwise
        # leave the record at "processing" and a successful render reads back as
        # interrupted on the next poll.
        await jobstore.finish(job_id)

        shutil.rmtree(job_dir, ignore_errors=True)

    except Exception as e:
        # Surface the full traceback to the server console — the job record only keeps
        # str(e), which on its own is often too thin to diagnose a failed render.
        print(f"[render_job {job_id}] FAILED:\n{traceback.format_exc()}", flush=True)
        render_jobs[job_id]["status"] = "error"
        render_jobs[job_id]["error"] = str(e)
        await jobstore.finish(job_id)
        # Clean up the scratch dir on failure too, so failed renders don't leak their
        # intermediate files and fill the box's disk.
        shutil.rmtree(os.path.join(TEMP_DIR, job_id), ignore_errors=True)


def get_clip_remote_path(clip_id: str) -> str:
    if clip_id.startswith("byoc/"):
        if clip_id.endswith(".mp4") or clip_id.endswith(".mov") or clip_id.endswith(".webm"):
            return clip_id
        return f"{clip_id}.mp4"
    return f"clips/{clip_id}.mp4"


async def run_broll_render(
    job_id: str,
    scenes: list,
    clip_ids: list,
    audio_file_id: str,
    audio_volume: float,
    color_grade: str,
    platform: str,
    email: str = "",  # billing email; the voiceover credit is charged here on success
    beats_per_clip: int = 2,  # kept for API stability; b-roll pacing now comes from the template
    template_id: str = "",
    music_start: float | None = None,  # user-picked track start (trimmer); wins over auto
    add_voiceover: bool = False,
    voice_id: str = "",
    vo_speed: float = 1.0,
    vo_volume: float = 1.0,
    bg_music_volume: float = 0.2,
    add_subtitles: bool = True,
    source: str = "ai",
):
    render_jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "output_url": "",
        "description": "",
        "error": "",
    }

    # A voiceover credit was reserved at request time iff voiceover was requested. We
    # keep it only if a voiceover is actually mixed in AND the render completes; otherwise
    # we refund it (music-only fallback, or a failed/OOM'd render) so a non-delivering
    # render never burns one of the free AI-voiceover credits.
    voiceover_reserved = bool(add_voiceover and (voice_id or "").strip())
    voiceover_delivered = False

    try:
        if not scenes or not clip_ids:
            raise ValueError("No scenes or clips provided for render.")
        if len(scenes) != len(clip_ids):
            raise ValueError(
                f"scene/clip count mismatch: {len(scenes)} scenes vs "
                f"{len(clip_ids)} clips"
            )

        # Global rule: cap the video at MAX_VIDEO_SECONDS. Scale scene durations only
        # (never drop scenes — they're paired 1:1 with clip_ids), so the montage and
        # captions all stay within the cap regardless of where the scenes came from.
        scenes = cap_total_duration(scenes, as_int=False, allow_trim=False)

        job_dir = os.path.join(TEMP_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        render_jobs[job_id]["progress"] = 5

        # Seed a template track into storage if needed (no-op for uploaded audio /
        # already-seeded tracks). Done here, inside the job, so the request handler
        # returns instantly and this shows up as early progress, not a pre-job stall.
        if audio_file_id:
            await ensure_track_seeded(audio_file_id)

        audio_path = os.path.join(job_dir, "music.mp3")
        await download_file(f"audio/{audio_file_id}.mp3", audio_path)
        beat_times = await asyncio.to_thread(detect_beats, audio_path)

        # Caption authoring canvas = full res (templates were tuned at 1080p). The
        # actual render frame may be downscaled (RENDER_LONG_EDGE) to cut encode
        # memory on small instances; libass scales the full-res captions onto it.
        caption_resolution = "1920:1080" if platform == "LinkedIn" else "1080:1920"
        resolution = _render_resolution(platform, caption_resolution)

        # Style template drives pacing + caption style (falls back to defaults).
        template = get_template(template_id) or DEFAULT_TEMPLATE
        pacing = pacing_of(template)
        target_cut_len = pacing["target_cut_len"]
        max_cuts = pacing["max_cuts_per_scene"]
        zooms = pacing["zooms"]
        min_cut = pacing.get("min_cut")  # template may allow faster sub-cuts
        # Fit mode: "card" (rounded-card frame on black, the "you versus you" look),
        # "letterbox" (16:9 footage + black bars), or "cover" (default fill).
        fit = (
            "card" if template.get("card_frame")
            else "letterbox" if template.get("letterbox")
            else "cover"
        )
        card_opts = {
            "w_frac": template.get("card_w_frac", 0.889),
            "h_frac": template.get("card_h_frac", 0.394),
            "radius": template.get("card_radius", 60),
            "y_frac": template.get("card_y_frac", 0.272),
        } if fit == "card" else None
        # Hold the first scene as one continuous shot (no sub-cuts) for a tension-
        # building opener before the montage drops.
        hold_first = bool(template.get("hold_first_scene"))
        # White flash-cuts on every Nth cut (energetic downbeat flashes). flash_dur=0
        # disables it (every other template -> unchanged).
        flash_dur = (float(template.get("flash_ms", 60)) / 1000.0) if template.get("flash_cut") else 0.0
        flash_every = max(1, int(template.get("flash_every", 2)))
        # flash_mode "scene" = flash only on each scene's first cut (sparse, ~scene_count
        # deliberate flashes); "every" = every flash_every-th cut.
        flash_mode = template.get("flash_mode", "every")
        # Start music on its hook/drop (the viral part), not the intro; re-base beats.
        # A fixed music_start is curated for the template's recommended track (its hook
        # sits at a known timestamp), so it only applies when that exact track is used;
        # a user's own song falls through to automatic hook detection instead.
        audio_start = 0.0
        is_recommended = audio_file_id == template.get("recommended_track")
        if music_start is not None:
            # User picked the segment in the trimmer — their choice wins over the
            # template's curated start and over hook detection.
            audio_start = max(0.0, float(music_start))
        elif template.get("music_start") is not None and is_recommended:
            audio_start = float(template["music_start"])
        elif template.get("music_hook"):
            audio_start = await asyncio.to_thread(detect_hook_offset, audio_path)
            # When the music was auto-matched to the reference (user skipped picking
            # their own track), start a touch earlier so it opens on the viral drop.
            audio_start = apply_music_hook_lead(
                audio_start, template, beat_times, is_recommended=is_recommended,
            )
        if audio_start > 0.01:
            beat_times = [b - audio_start for b in beat_times if b >= audio_start]
        beat_len = beat_interval_seconds(
            beat_times, ((template.get("measured") or {}).get("bpm"))
        )
        caption_style = caption_style_of(template)
        # Template owns the whole look: grade comes from the template too (not just
        # the request payload), so the color can't drift from pacing/captions.
        grade = template.get("color_grade") or color_grade or "dark_cinematic"
        # Tone-matched custom grade (built from the reference's measured colors) wins
        # over the preset name; caption font/size vary per template too.
        grade_filter = template.get("grade_filter") or grade
        caption_preset = caption_preset_of(template)

        # Generated intro text-cards (footage-less dark-gradient / light-grain cards
        # carrying a single bold phrase) for reference templates that define them.
        # Each card bakes in its own caption and matches the montage cut stream
        # params, so it concatenates ahead of the footage with no re-encode mismatch.
        intro_cards = resolve_text_cards(template.get("intro_cards"), scenes)
        outro_cards = resolve_text_cards(template.get("outro_cards"), scenes)
        outro_voice_lines = [
            str(card.get("text", "")).strip()
            for card in outro_cards
            if str(card.get("text", "")).strip()
        ]

        # Speed up transitions for scenes after the middle cards (accelerating towards the end)
        if (
            outro_cards
            and str(template.get("outro_position") or "").strip().lower() == "middle"
            and template.get("outro_start_at") is not None
        ):
            outro_start_at = float(template["outro_start_at"])
            cum_duration = 0.0
            after_scenes = []
            for scene in scenes:
                if cum_duration >= outro_start_at - 0.01:
                    after_scenes.append(scene)
                else:
                    cum_duration += scene["duration_seconds"]
            
            if after_scenes:
                total_after_duration = sum(s["duration_seconds"] for s in after_scenes)
                m = len(after_scenes)
                if m == 1:
                    after_scenes[0]["duration_seconds"] = total_after_duration
                else:
                    # Accelerate from 1.4x of the average duration down to 0.6x of the average duration
                    for idx, scene in enumerate(after_scenes):
                        factor = 1.4 - 0.8 * (idx / (m - 1))
                        scene["duration_seconds"] = (total_after_duration / m) * factor

        prebuilt_outro_voiceover = None
        if (
            add_voiceover
            and (voice_id or "").strip()
            and str(template.get("voiceover_target") or "").strip().lower() == "outro_cards"
            and outro_voice_lines
        ):
            vo_dir = os.path.join(job_dir, "voiceover")
            os.makedirs(vo_dir, exist_ok=True)
            vo_path = os.path.join(vo_dir, "narration.mp3")
            prebuilt_outro_voiceover = await asyncio.to_thread(
                generate_single_voiceover,
                [{"phrase": line} for line in outro_voice_lines],
                vo_path,
                voice_id,
                vo_speed,
            )
            spans = prebuilt_outro_voiceover.get("spans") if prebuilt_outro_voiceover else None
            if spans:
                adjusted_vo_path = os.path.join(vo_dir, "narration_sync.mp3")
                outro_cards = await asyncio.to_thread(
                    adjust_voiceover_and_cards,
                    vo_path,
                    spans,
                    outro_cards,
                    beat_len,
                    adjusted_vo_path,
                    min_duration=float(template.get("outro_voice_min_duration", 0.4)),
                    hold_after_end=float(template.get("outro_voice_hold", 0.35)),
                )
                prebuilt_outro_voiceover["audio_path"] = adjusted_vo_path
        # Card captions come from the REFERENCE (the template's curated card text),
        # not the user's script — these are the reference's signature subtitles.
        # Outro cards may instead be built dynamically from the generated scene phrases.
        intro_card_paths: list[str] = []
        for ci, card in enumerate(intro_cards):
            card_text = str(card.get("text", "")).strip()
            if card.get("lowercase", True):
                card_text = card_text.lower()
            card_out = os.path.join(job_dir, f"intro_card_{ci:02d}.mp4")
            await asyncio.to_thread(
                render_text_card,
                card_out,
                float(card.get("duration", 1.6)),
                card_text,
                card.get("bg", "dark_gradient"),
                card.get("style", "card_phrase"),
                resolution,
                fontcycle=card.get("fontcycle"),
                fontcycle_dur=card.get("fontcycle_dur"),
                caption_resolution=caption_resolution,
                wrap_words=card.get("wrap_words"),
                max_chars=card.get("max_chars"),
            )
            intro_card_paths.append(card_out)
        outro_card_paths: list[str] = []
        for ci, card in enumerate(outro_cards):
            card_text = str(card.get("text", "")).strip()
            if card.get("lowercase", True):
                card_text = card_text.lower()
            card_dur = float(card.get("duration", 1.6))
            if card.get("beats_per_card"):
                card_dur = max(0.18, beat_len * float(card["beats_per_card"]))
            card_out = os.path.join(job_dir, f"outro_card_{ci:02d}.mp4")
            await asyncio.to_thread(
                render_text_card,
                card_out,
                card_dur,
                card_text,
                card.get("bg", "dark_gradient"),
                card.get("style", "card_phrase"),
                resolution,
                fontcycle=card.get("fontcycle"),
                fontcycle_dur=card.get("fontcycle_dur"),
                caption_resolution=caption_resolution,
                wrap_words=card.get("wrap_words"),
                max_chars=card.get("max_chars"),
            )
            outro_card_paths.append(card_out)

        render_jobs[job_id]["progress"] = 15

        # Slice the uploaded clips into beat-synced montage cuts.
        # Each cut is planned + spec'd serially below (cheap), then all the heavy
        # encodes run in parallel via _extract_cuts_parallel. Output paths carry the
        # ordering (cut_NNN.mp4), so concurrent completion doesn't reorder anything.
        cut_paths: list[str] = []
        cut_specs: list[dict] = []
        scene_cut_counts: list[int] = []
        cut_idx = 0
        total = max(1, len(scenes))

        # When the template opts into auto-exposure, normalize each source toward a
        # mid target before the grade so a dark grade can't crush dark clips to black.
        auto_exposure = bool(template.get("auto_exposure"))
        NORM_TARGET = 58.0  # luma to normalize sources to, pre-grade
        _exp_cache: dict = {}

        async def _exposure_for(p: str) -> float:
            if not auto_exposure:
                return 0.0
            if p not in _exp_cache:
                yavg = await asyncio.to_thread(measure_brightness, p)
                _exp_cache[p] = max(-0.20, min(0.22, (NORM_TARGET - yavg) / 255.0))
            return _exp_cache[p]

        if template.get("clip_per_beat"):
            # Fast beat-cut montage: cut to the NEXT clip every `clip_beats` beats
            # (clips repeat in sets), over the heard beats of the montage span. All
            # clips are pulled up front so cuts can cycle through them freely.
            uniq_ids = list(dict.fromkeys(clip_ids))
            clip_files: list[str] = []
            for cid in uniq_ids:
                p = os.path.join(job_dir, f"raw_{cid}.mp4")
                await download_file(get_clip_remote_path(cid), p)
                clip_files.append(p)
            clip_durs = {
                p: await asyncio.to_thread(get_duration, p) for p in clip_files
            }
            intro_total = await asyncio.to_thread(
                lambda: sum(get_duration(p) for p in intro_card_paths)
            )
            montage_total = sum(s["duration_seconds"] for s in scenes)
            plan = plan_beat_cut_montage(
                [clip_durs[p] for p in clip_files],
                beat_times, intro_total, montage_total, zooms,
                every=int(template.get("clip_beats", 1)),
            )
            for cut in plan:
                raw_path = clip_files[cut["clip_index"]]
                out_path = os.path.join(job_dir, f"cut_{cut_idx:03d}.mp4")
                do_flash = flash_dur > 0 and (cut_idx % flash_every == 0)
                cut_specs.append(dict(
                    src_path=raw_path, out_path=out_path,
                    src_offset=cut["src_offset"], length=cut["length"],
                    zoom=cut["zoom"], grade=grade_filter, resolution=resolution,
                    exposure=await _exposure_for(raw_path), fit=fit,
                    flash=flash_dur if do_flash else 0.0, card_opts=card_opts,
                ))
                cut_paths.append(out_path)
                cut_idx += 1
            scene_cut_counts.append(len(plan))
        else:
            # Lay scenes on the video timeline with each scene change snapped to an
            # audible beat (same clock the captions use); each scene = one clip with
            # in-scene zoom sub-cuts.
            windows = await asyncio.to_thread(
                montage_scene_windows,
                [s["duration_seconds"] for s in scenes],
                beat_times,
                target_cut_len,
                template.get("scene_snap_tol"),
            )
            # Tempo shift: from `fast_after` seconds on, fill each scene's window with a
            # fast beat-cut montage that swaps the source CLIP every `fast_clip_beats`
            # beats (an energetic back half) instead of sub-cutting one clip per scene;
            # scene time-windows are unchanged so the captions still line up. Flash-cuts
            # (white transitions) only fire on cuts that start before `flash_until`.
            fast_after = template.get("fast_after")
            # Tempo-shift placement, derived from the montage's real end so it lands
            # near the end regardless of total length:
            #   `fast_hold` (+ optional `fast_ramp`) = GRADUALLY accelerate over the
            #     ramp, then hold ONE fast tempo for the last `fast_hold` seconds.
            #   `fast_before_end` = simpler abrupt fast for the last N seconds.
            fast_before_end = template.get("fast_before_end")
            fast_hold = template.get("fast_hold")
            fast_ramp = float(template.get("fast_ramp", 0.0))
            hold_start = None
            slow_seg = float(template.get("fast_slow_seg", 1.5))
            fast_seg = float(template.get("fast_seg", 0.5))
            montage_span = max((ws + wl for ws, wl in windows), default=0.0)
            if fast_after is None and fast_hold is not None and windows:
                hold_start = max(0.0, montage_span - float(fast_hold))
                fast_after = max(0.0, hold_start - fast_ramp)
            elif fast_after is None and fast_before_end is not None and windows:
                fast_after = max(0.0, montage_span - float(fast_before_end))
            flash_until = template.get("flash_until")
            fast_clip_beats = max(1, int(template.get("fast_clip_beats", 1)))
            fast_min_cut = float(template.get("fast_min_cut", 0.18))

            # The fast section cycles through every clip, so when a tempo shift is set we
            # pull them all up front; otherwise keep the per-scene download (one clip per
            # scene) so templates without a tempo shift are byte-identical.
            clip_files: list[str] = []
            clip_durs: list[float] = []
            clip_path_by_id: dict[str, str] = {}
            clip_dur_by_id: dict[str, float] = {}
            if fast_after is not None:
                for di, cid in enumerate(dict.fromkeys(clip_ids)):
                    p = os.path.join(job_dir, f"raw_{di}.mp4")
                    await download_file(get_clip_remote_path(cid), p)
                    d = await asyncio.to_thread(get_duration, p)
                    clip_files.append(p)
                    clip_durs.append(d)
                    clip_path_by_id[cid] = p
                    clip_dur_by_id[cid] = d

            for i, (scene, clip_id) in enumerate(zip(scenes, clip_ids)):
                window_start, window_len = windows[i]
                # A scene counts as "fast" if it reaches into the accel zone (overlap,
                # not just start) so the ramp begins right at fast_after instead of the
                # next scene boundary. The held opener is always kept slow.
                window_end = window_start + window_len
                is_fast = (
                    fast_after is not None
                    and window_end > float(fast_after)
                    and not (hold_first and i == 0)
                )
                if is_fast and hold_start is not None:
                    # Gradual ramp into a steady fast tempo (held for the last seconds).
                    plan = await asyncio.to_thread(
                        plan_accel_cut_montage, clip_durs, beat_times,
                        window_start, window_len, zooms,
                        float(fast_after), float(hold_start), slow_seg, fast_seg, fast_min_cut,
                    )
                elif is_fast:
                    plan = await asyncio.to_thread(
                        plan_beat_cut_montage, clip_durs, beat_times,
                        window_start, window_len, zooms, fast_clip_beats, fast_min_cut,
                    )
                else:
                    plan = None

                if plan:
                    # Fast clip-swap fill: cycle clips, a new source every beat, no flash.
                    for cut in plan:
                        raw_path = clip_files[cut["clip_index"]]
                        out_path = os.path.join(job_dir, f"cut_{cut_idx:03d}.mp4")
                        cut_specs.append(dict(
                            src_path=raw_path, out_path=out_path,
                            src_offset=cut["src_offset"], length=cut["length"],
                            zoom=cut["zoom"], grade=grade_filter, resolution=resolution,
                            exposure=await _exposure_for(raw_path), fit=fit,
                            flash=0.0, card_opts=card_opts,
                        ))
                        cut_paths.append(out_path)
                        cut_idx += 1
                    scene_cut_counts.append(len(plan))
                    continue

                # Slow section (or no tempo shift): one clip per scene with zoom sub-cuts.
                if fast_after is not None:
                    raw_path = clip_path_by_id[clip_id]
                    src_dur = clip_dur_by_id[clip_id]
                else:
                    raw_path = os.path.join(job_dir, f"raw_{i}.mp4")
                    await download_file(get_clip_remote_path(clip_id), raw_path)
                    src_dur = await asyncio.to_thread(get_duration, raw_path)

                if hold_first and i == 0:
                    # one continuous held shot for the opener (no sub-cuts)
                    cuts = plan_scene_cuts(
                        window_start, window_len, src_dur, beat_times,
                        window_len, 1, zooms, min_cut=window_len,
                    )
                else:
                    cuts = plan_scene_cuts(
                        window_start, window_len, src_dur, beat_times,
                        target_cut_len, max_cuts, zooms, min_cut=min_cut,
                    )

                for ci, cut in enumerate(cuts):
                    out_path = os.path.join(job_dir, f"cut_{cut_idx:03d}.mp4")
                    in_flash_window = flash_until is None or window_start < float(flash_until)
                    do_flash = flash_dur > 0 and in_flash_window and (
                        (ci == 0) if flash_mode == "scene"
                        else (cut_idx % flash_every == 0)
                    )
                    cut_specs.append(dict(
                        src_path=raw_path,
                        out_path=out_path,
                        src_offset=cut["src_offset"],
                        length=cut["length"],
                        zoom=cut["zoom"],
                        grade=grade_filter,
                        resolution=resolution,
                        exposure=await _exposure_for(raw_path),
                        fit=fit,
                        flash=flash_dur if do_flash else 0.0,
                        card_opts=card_opts,
                    ))
                    cut_paths.append(out_path)
                    cut_idx += 1

                scene_cut_counts.append(len(cuts))
                render_jobs[job_id]["progress"] = 15 + int(15 * (i + 1) / total)

        # Encode all planned cuts in parallel (the heavy step). Drive progress across
        # the 30..45 band as they finish; ordering is already fixed by cut_paths.
        def _cut_progress(done: int, total_cuts: int):
            render_jobs[job_id]["progress"] = 30 + int(15 * done / max(1, total_cuts))

        await _extract_cuts_parallel(cut_specs, on_progress=_cut_progress)
        render_jobs[job_id]["progress"] = 45

        intro_total = await asyncio.to_thread(
            lambda: sum(get_duration(p) for p in intro_card_paths)
        )
        full_footage_total = await asyncio.to_thread(
            lambda: sum(get_duration(p) for p in cut_paths)
        )
        output_cut_paths = list(cut_paths)
        output_scene_cut_counts = list(scene_cut_counts)
        output_scenes = list(scenes)
        before_cut_paths = list(cut_paths)
        before_scene_cut_counts = list(scene_cut_counts)
        before_scenes = list(scenes)
        after_cut_paths: list[str] = []
        after_scene_cut_counts: list[int] = []
        after_scenes: list[dict] = []
        before_footage_total = full_footage_total
        after_footage_total = 0.0
        footage_total = full_footage_total
        dropped_footage_total = 0.0
        cards_position = str(template.get("outro_position") or "end").strip().lower()
        if (
            outro_card_paths
            and cards_position == "middle"
            and template.get("outro_start_at") is not None
        ):
            (
                before_cut_paths,
                before_scene_cut_counts,
                before_scenes,
                after_cut_paths,
                after_scene_cut_counts,
                after_scenes,
                before_footage_total,
                after_footage_total,
            ) = await asyncio.to_thread(
                split_montage_at_time,
                cut_paths,
                scene_cut_counts,
                scenes,
                float(template.get("outro_start_at")),
            )
            output_cut_paths = before_cut_paths + after_cut_paths
            output_scene_cut_counts = before_scene_cut_counts + after_scene_cut_counts
            output_scenes = before_scenes + after_scenes
            footage_total = before_footage_total + after_footage_total
        elif outro_card_paths and template.get("outro_start_at") is not None:
            (
                output_cut_paths,
                output_scene_cut_counts,
                output_scenes,
                footage_total,
                dropped_footage_total,
            ) = await asyncio.to_thread(
                trim_montage_to_time,
                cut_paths,
                scene_cut_counts,
                scenes,
                float(template.get("outro_start_at")),
            )
        elif outro_card_paths and template.get("outro_start_ratio") is not None:
            (
                output_cut_paths,
                output_scene_cut_counts,
                output_scenes,
                footage_total,
                dropped_footage_total,
            ) = await asyncio.to_thread(
                trim_montage_to_ratio,
                cut_paths,
                scene_cut_counts,
                scenes,
                float(template.get("outro_start_ratio")),
            )
        if (
            outro_card_paths
            and cards_position != "middle"
            and template.get("fit_outro_to_replaced_tail")
        ):
            fitted_paths: list[str] = []
            fitted_total = 0.0
            slack = max(0.12, beat_len * 0.35)
            for p in outro_card_paths:
                dur = await asyncio.to_thread(get_duration, p)
                if fitted_paths and dropped_footage_total > 0.01 and fitted_total + dur > dropped_footage_total + slack:
                    break
                fitted_paths.append(p)
                fitted_total += dur
            if fitted_paths:
                outro_card_paths = fitted_paths
        mute_start = template.get("music_pause_start")
        mute_dur = template.get("music_pause_dur")
        if outro_card_paths and template.get("music_pause_at") == "outro_start":
            mute_start = (
                intro_total + before_footage_total
                if cards_position == "middle"
                else intro_total + footage_total
            )
            if str(template.get("voiceover_target") or "").strip().lower() == "outro_cards":
                # For black-block voiceover references, keep the music OFF for the whole
                # black-card section so the track never comes back under the voice/text.
                mute_dur = await asyncio.to_thread(
                    lambda: sum(get_duration(p) for p in outro_card_paths)
                )
            else:
                pause_cards = max(1, int(template.get("music_pause_cards", 1)))
                mute_dur = await asyncio.to_thread(
                    lambda: sum(get_duration(p) for p in outro_card_paths[:pause_cards])
                )

        concat_path = os.path.join(job_dir, "concat.mp4")
        card_insert_total = await asyncio.to_thread(
            lambda: sum(get_duration(p) for p in outro_card_paths)
        )
        concat_parts = (
            intro_card_paths + before_cut_paths + outro_card_paths + after_cut_paths
            if cards_position == "middle"
            else intro_card_paths + output_cut_paths + outro_card_paths
        )
        # Prepend intro cards and place the reference's black text-cards either in the
        # middle or at the end, depending on the template.
        await asyncio.to_thread(
            concatenate_clips,
            concat_parts,
            concat_path,
        )
        render_jobs[job_id]["progress"] = 62

        with_audio_path = os.path.join(job_dir, "with_audio.mp4")
        music_volume = float(template.get("music_volume", audio_volume))
        await asyncio.to_thread(
            add_background_audio_only,
            concat_path,
            audio_path,
            with_audio_path,
            music_volume,
            audio_start,
            mute_start=mute_start,
            mute_dur=mute_dur,
            restart_after_mute=template.get("music_restart"),
            restart_offset=template.get("music_restart_offset"),
        )
        render_jobs[job_id]["progress"] = 75

        # Intro cards occupy [0, intro_total]; montage captions start after them. Outro
        # card text is already baked into the card clips, so the final ASS carries only
        # the montage captions, shifted by the intro duration.
        # Measure real scene windows from the rendered cuts so caption timing is exact.
        if template.get("clip_per_beat"):
            # clip_per_beat tiles cuts across the whole montage (NOT grouped per scene),
            # so per-scene cut counts can't time captions. Lay each scene's caption
            # window on its share of the real footage length (scaled to the actual
            # total) so per-scene captions follow the script over the fast clip-swaps.
            scenes_with_timing = []
            if cards_position == "middle" and after_scenes:
                intended_before = sum(
                    max(0.1, float(s["duration_seconds"])) for s in before_scenes
                ) or 1.0
                scale_before = before_footage_total / intended_before
                cursor = intro_total
                for s in before_scenes:
                    d = max(0.1, float(s["duration_seconds"])) * scale_before
                    scenes_with_timing.append(
                        {**s, "start_time": cursor, "duration_seconds": d}
                    )
                    cursor += d
                intended_after = sum(
                    max(0.1, float(s["duration_seconds"])) for s in after_scenes
                ) or 1.0
                scale_after = after_footage_total / intended_after
                cursor = intro_total + before_footage_total + card_insert_total
                for s in after_scenes:
                    d = max(0.1, float(s["duration_seconds"])) * scale_after
                    scenes_with_timing.append(
                        {**s, "start_time": cursor, "duration_seconds": d}
                    )
                    cursor += d
            else:
                intended = (
                    sum(max(0.1, float(s["duration_seconds"])) for s in output_scenes)
                    or 1.0
                )
                scale = footage_total / intended
                cursor = intro_total
                for s in output_scenes:
                    d = max(0.1, float(s["duration_seconds"])) * scale
                    scenes_with_timing.append(
                        {**s, "start_time": cursor, "duration_seconds": d}
                    )
                    cursor += d
        else:
            if cards_position == "middle" and after_scenes:
                before_timed = await asyncio.to_thread(
                    build_scene_timings_from_cuts,
                    before_cut_paths,
                    before_scene_cut_counts,
                    before_scenes,
                    intro_total,
                )
                after_timed = await asyncio.to_thread(
                    build_scene_timings_from_cuts,
                    after_cut_paths,
                    after_scene_cut_counts,
                    after_scenes,
                    intro_total + before_footage_total + card_insert_total,
                )
                scenes_with_timing = before_timed + after_timed
            else:
                scenes_with_timing = await asyncio.to_thread(
                    build_scene_timings_from_cuts,
                    output_cut_paths,
                    output_scene_cut_counts,
                    output_scenes,
                    intro_total,
                )

        # --- AI voiceover (optional) -------------------------------------------------
        # Generate the ENTIRE narration in ONE ElevenLabs call (all scene phrases joined),
        # so the voice keeps one consistent tone and natural flow. Generating a separate
        # clip per short phrase made it choppy — a few words, silence, then a different
        # tone mid-thought (each call was its own generation/prosody). The single call
        # returns per-character timestamps, so each phrase's caption is timed to the exact
        # span it's spoken. The b-roll cuts keep their own beat timing underneath.
        # Non-fatal: a TTS hiccup falls back to the music-only mix + montage-timed captions.
        caption_video_path = with_audio_path
        if add_voiceover and (voice_id or "").strip():
            try:
                vo_dir = os.path.join(job_dir, "voiceover")
                os.makedirs(vo_dir, exist_ok=True)
                vo_path = os.path.join(vo_dir, "narration.mp3")
                if (
                    str(template.get("voiceover_target") or "").strip().lower()
                    == "outro_cards"
                    and outro_voice_lines
                    and mute_start is not None
                    and mute_dur is not None
                ):
                    vo = prebuilt_outro_voiceover
                    if not vo or not vo.get("audio_path"):
                        voice_scenes = [{"phrase": line} for line in outro_voice_lines]
                        vo = await asyncio.to_thread(
                            generate_single_voiceover,
                            voice_scenes,
                            vo_path,
                            voice_id,
                            vo_speed,
                        )
                    if vo and vo.get("audio_path"):
                        with_vo_path = os.path.join(job_dir, "with_voiceover.mp4")
                        await asyncio.to_thread(
                            mix_voiceover_per_scene,
                            with_audio_path,
                            [{
                                "audio_path": vo["audio_path"],
                                "start_time": float(mute_start),
                                "max_duration": float(mute_dur),
                            }],
                            with_vo_path,
                            vo_volume,
                            bg_music_volume,
                        )
                        caption_video_path = with_vo_path
                        voiceover_delivered = True
                else:
                    vo = await asyncio.to_thread(
                        generate_single_voiceover,
                        scenes_with_timing, vo_path, voice_id, vo_speed,
                    )
                    spans = vo.get("spans") if vo else None
                    if spans:
                        # Narration begins at the first voiced scene's footage start. Each
                        # caption starts when its phrase is spoken, but is HELD until the next
                        # phrase begins (so it doesn't flash for ~1s and leave the pauses
                        # blank), and the LAST caption is held to the end of the video (so the
                        # tail after the narration isn't left with no subtitle). The voice
                        # still plays at the exact spans — only the caption windows stretch.
                        first_idx = spans[0]["index"]
                        audio_offset = float(scenes_with_timing[first_idx].get("start_time", 0.0))
                        video_total = await asyncio.to_thread(get_duration, with_audio_path)
                        held: dict = {}
                        for k, sp in enumerate(spans):
                            start = audio_offset + float(sp["start"])
                            nxt = (
                                audio_offset + float(spans[k + 1]["start"])
                                if k + 1 < len(spans)
                                else video_total
                            )
                            end = max(start + 0.6, min(nxt, video_total))
                            held[sp["index"]] = (start, end)
                        retimed: list = []
                        for idx, scene in enumerate(scenes_with_timing):
                            if idx in held:
                                start, end = held[idx]
                                retimed.append(
                                    {**scene, "start_time": start, "duration_seconds": end - start}
                                )
                            else:
                                retimed.append(scene)  # no phrase -> keep montage timing
                        with_vo_path = os.path.join(job_dir, "with_voiceover.mp4")
                        await asyncio.to_thread(
                            mix_voiceover_per_scene,
                            with_audio_path,
                            [{"audio_path": vo["audio_path"], "start_time": audio_offset}],
                            with_vo_path,
                            vo_volume,
                            bg_music_volume,
                        )
                        caption_video_path = with_vo_path
                        # Mix succeeded — only NOW commit the voice-span caption timeline, so a
                        # mix failure (handled below) keeps the original montage-timed captions
                        # over the music-only fallback instead of timing them to absent speech.
                        scenes_with_timing = retimed
                        # A voiceover was genuinely synthesized and mixed in. The credit was
                        # reserved at request time; mark it delivered so we KEEP it once the
                        # render completes (and don't refund it on the success path below).
                        voiceover_delivered = True
            except Exception:
                print(
                    f"[broll_render {job_id}] voiceover failed, continuing without it:\n"
                    f"{traceback.format_exc()}",
                    flush=True,
                )
                caption_video_path = with_audio_path
        render_jobs[job_id]["progress"] = 80

        ass_path = os.path.join(job_dir, "broll_captions.ass")
        # Scene phrases from the user's script — never the template's closing_caption
        # string (that field only records what appeared on the reference clip).
        if not add_subtitles or not template.get("captions_on_montage", True):
            await asyncio.to_thread(
                generate_ass_simple,
                [],
                ass_path,
                caption_style,
                caption_resolution,
                caption_preset,
            )
        elif caption_style == "kinetic":
            await asyncio.to_thread(
                generate_ass_kinetic,
                scenes_with_timing,
                beat_times,
                ass_path,
                caption_resolution,
                caption_preset,
            )
        elif caption_style == "karaoke":
            await asyncio.to_thread(
                generate_ass_karaoke,
                scenes_with_timing,
                beat_times,
                ass_path,
                "karaoke",
                caption_resolution,
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
                caption_resolution,
                caption_preset,
            )

        final_path = os.path.join(job_dir, "final.mp4")
        # Optional "glass" caption: blend the text onto the footage (e.g. difference)
        # so it inverts/shifts the background instead of an opaque overlay.
        caption_blend = template.get("caption_blend")
        blend_opacity = float(template.get("caption_blend_opacity", 0.85))
        await asyncio.to_thread(
            burn_subtitles_ass, caption_video_path, ass_path, final_path,
            caption_blend, blend_opacity, True,
        )

        # Optional darkening outro: fade the picture to black over the last seconds.
        end_fade = template.get("end_fade")
        if end_fade:
            faded_path = os.path.join(job_dir, "final_faded.mp4")
            await asyncio.to_thread(apply_end_fade, final_path, faded_path, float(end_fade))
            final_path = faded_path

        render_jobs[job_id]["progress"] = 95

        remote = f"rendered/{job_id}_broll_final.mp4"
        url = await upload_file(final_path, remote)

        render_jobs[job_id]["status"] = "done"
        render_jobs[job_id]["progress"] = 100
        render_jobs[job_id]["output_url"] = url
        # Persist the terminal state immediately so an OOM-kill before the next
        # heartbeat tick can't make a finished render read back as interrupted.
        await jobstore.finish(job_id)

        # Log to public.videos database table:
        if not use_local_storage():
            try:
                from services.storage import _get_supabase
                _get_supabase().table("videos").insert({
                    "job_id": job_id,
                    "email": email,
                    "output_url": url,
                    "source": source,
                }).execute()
            except Exception as db_err:
                print(f"Error inserting video record: {db_err}", flush=True)

        # The render delivered. Keep the reserved voiceover credit only if a voiceover was
        # actually produced; if it fell back to music-only, release the reservation.
        if voiceover_reserved and not voiceover_delivered:
            await usage.refund(email, "voiceover")

        shutil.rmtree(job_dir, ignore_errors=True)

    except Exception as e:
        # Surface the full traceback to the server console — the job record only keeps
        # str(e), which on its own is often too thin to diagnose a failed render.
        print(f"[broll_render {job_id}] FAILED:\n{traceback.format_exc()}", flush=True)
        render_jobs[job_id]["status"] = "error"
        render_jobs[job_id]["error"] = str(e)
        await jobstore.finish(job_id)
        # The render produced no deliverable — release reserved credits so a failed
        # render doesn't burn monthly video or free voiceover allowances.
        if voiceover_reserved:
            await usage.refund(email, "voiceover")
        await usage.refund_video(email)
        # Clean up the scratch dir on failure too (the success path rmtrees below);
        # otherwise every failed render leaks its full intermediate tree and fills disk.
        shutil.rmtree(os.path.join(TEMP_DIR, job_id), ignore_errors=True)
