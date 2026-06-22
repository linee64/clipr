"""Local b-roll render harness — runs the real render pipeline WITHOUT Supabase.

Mirrors workers.render.run_broll_render but reads clips/audio from local disk and
writes the result locally, so we can iterate on a template's look and compare the
output frame-by-frame against a reference video.

Usage (from backend/):
    python scripts/local_render.py --template ref-locked-in \
        --out temp/render_locked_in.mp4 \
        --clips ~/Downloads/video5273762300916966235.mp4 ~/Downloads/video5273762300916966236.mp4 \
        --audio assets/tracks/"Ryutqc_NORWXXD_REAPER_-_Break_The_Pattern_(SkySound.cc).mp3"

Phrases default to the "Locked in" reference's lines so the comparison is fair.
After rendering it also dumps 1fps frames next to the output (<out>_frames/).
"""

import argparse
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from services.editor import (  # noqa: E402
    add_background_audio_only,
    apply_end_fade,
    apply_music_hook_lead,
    build_scene_timings_from_cuts,
    burn_subtitles_ass,
    concatenate_clips,
    detect_beats,
    detect_hook_offset,
    extract_montage_cut,
    generate_ass_karaoke,
    generate_ass_kinetic,
    generate_ass_simple,
    get_duration,
    measure_brightness,
    montage_scene_windows,
    plan_accel_cut_montage,
    plan_beat_cut_montage,
    plan_scene_cuts,
    render_text_card,
    _tool,
)
from services.templates import (  # noqa: E402
    DEFAULT_TEMPLATE,
    cap_total_duration,
    caption_preset_of,
    caption_style_of,
    get_template,
    pacing_of,
)
from services.tracks import _slugify  # noqa: E402 — match local audio to recommended_track

# Reference phrases ("Locked in"), in order, so the test mirrors the real video.
DEFAULT_PHRASES = [
    "im not lucky",
    "it's never the right time",
    "im just",
    "locked in.",
]


def local_broll_render(
    out_path: str,
    clip_paths: list[str],
    audio_path: str,
    phrases: list[str],
    template_id: str,
    platform: str = "TikTok",
    audio_volume: float = 0.6,
):
    job_dir = os.path.join(str(BACKEND_DIR), "temp", "local_render")
    os.makedirs(job_dir, exist_ok=True)

    scenes = [
        {
            "order": i + 1,
            "phrase": p,
            "duration_seconds": 3,
            "role": "hook" if i == 0 else "body",
        }
        for i, p in enumerate(phrases)
    ]
    # Global rule: keep the video within the cap (scale durations, keep all scenes).
    scenes = cap_total_duration(scenes, as_int=False, allow_trim=False)

    beat_times = detect_beats(audio_path)
    resolution = "1920:1080" if platform == "LinkedIn" else "1080:1920"

    template = get_template(template_id) or DEFAULT_TEMPLATE
    pacing = pacing_of(template)
    target_cut_len = pacing["target_cut_len"]
    max_cuts = pacing["max_cuts_per_scene"]
    zooms = pacing["zooms"]
    min_cut = pacing.get("min_cut")
    caption_style = caption_style_of(template)
    grade = template.get("color_grade") or "dark_cinematic"
    grade_filter = template.get("grade_filter") or grade
    caption_preset = caption_preset_of(template)

    # Start music on its hook/drop (viral part), not the intro; re-base beats so cuts
    # stay on-beat. Must happen BEFORE montage_scene_windows uses beat_times.
    # A fixed music_start is curated for the recommended track, so it only applies when
    # that exact track is used; a user's own song falls through to hook detection.
    audio_start = 0.0
    is_recommended = _slugify(Path(audio_path).stem) == template.get("recommended_track")
    if template.get("music_start") is not None and is_recommended:
        audio_start = float(template["music_start"])
    elif template.get("music_hook"):
        audio_start = detect_hook_offset(audio_path)
        # Mirror production: if this local audio IS the template's recommended track
        # (i.e. what the user gets when they skip picking music), start a touch earlier.
        audio_start = apply_music_hook_lead(
            audio_start, template, beat_times, is_recommended=is_recommended
        )
    if audio_start > 0.01:
        beat_times = [b - audio_start for b in beat_times if b >= audio_start]
        print(f"  music offset: {audio_start:.2f}s")

    print(f"template={template.get('id')}  caption_style={caption_style}")
    print(f"  pacing: cut_len={target_cut_len} max_cuts={max_cuts} zooms={zooms}")
    print(f"  grade_filter: {grade_filter}")
    print(f"  caption_preset: {caption_preset}")

    # Generated intro cards (mirrors run_broll_render): captions come from the
    # REFERENCE (template card text), bg/style/duration from the template.
    intro_cards = template.get("intro_cards") or []
    card_paths: list[str] = []
    for ci, card in enumerate(intro_cards):
        card_text = str(card.get("text", "")).lower()
        card_out = os.path.join(job_dir, f"card_{ci:02d}.mp4")
        render_text_card(
            card_out,
            float(card.get("duration", 1.6)),
            card_text,
            card.get("bg", "dark_gradient"),
            card.get("style", "card_phrase"),
            resolution,
            fontcycle=card.get("fontcycle"),
            fontcycle_dur=card.get("fontcycle_dur"),
        )
        card_paths.append(card_out)
    print(f"  intro cards: {len(card_paths)}")

    cut_paths: list[str] = []
    scene_cut_counts: list[int] = []
    cut_idx = 0
    auto_exposure = bool(template.get("auto_exposure"))
    NORM_TARGET = 58.0
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
    hold_first = bool(template.get("hold_first_scene"))
    flash_dur = (float(template.get("flash_ms", 60)) / 1000.0) if template.get("flash_cut") else 0.0
    flash_every = max(1, int(template.get("flash_every", 2)))
    flash_mode = template.get("flash_mode", "every")

    _exp_cache: dict = {}

    def _exposure_for(p: str) -> float:
        if not auto_exposure:
            return 0.0
        if p not in _exp_cache:
            yavg = measure_brightness(p)
            _exp_cache[p] = max(-0.20, min(0.22, (NORM_TARGET - yavg) / 255.0))
        return _exp_cache[p]

    if template.get("clip_per_beat"):
        # Fast beat-cut montage: cut to the NEXT clip every `clip_beats` beats
        # (clips repeat in sets), over the heard beats of the montage span.
        card_total = sum(get_duration(p) for p in card_paths)
        montage_total = sum(s["duration_seconds"] for s in scenes)
        plan = plan_beat_cut_montage(
            [get_duration(p) for p in clip_paths],
            beat_times, card_total, montage_total, zooms,
            every=int(template.get("clip_beats", 1)),
        )
        for cut in plan:
            raw_path = clip_paths[cut["clip_index"]]
            cut_out = os.path.join(job_dir, f"cut_{cut_idx:03d}.mp4")
            do_flash = flash_dur > 0 and (cut_idx % flash_every == 0)
            extract_montage_cut(
                raw_path, cut_out, cut["src_offset"], cut["length"],
                cut["zoom"], grade_filter, resolution,
                exposure=_exposure_for(raw_path), fit=fit,
                flash=flash_dur if do_flash else 0.0, card_opts=card_opts,
            )
            cut_paths.append(cut_out)
            cut_idx += 1
        scene_cut_counts.append(len(plan))
        print(f"  clip-per-beat: {len(plan)} cuts cycling {len(clip_paths)} clips")
    else:
        windows = montage_scene_windows(
            [s["duration_seconds"] for s in scenes], beat_times, target_cut_len,
            template.get("scene_snap_tol"),
        )
        # Tempo shift (mirrors run_broll_render): from `fast_after` seconds on, fill each
        # scene window with a fast beat-cut montage that swaps the source CLIP every
        # `fast_clip_beats` beats instead of sub-cutting one clip; scene time-windows are
        # unchanged so captions line up. Flash-cuts only fire before `flash_until`.
        fast_after = template.get("fast_after")
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
        clip_durs_all = [get_duration(p) for p in clip_paths] if fast_after is not None else []

        # Cycle through the provided clips, one source per scene.
        for i, scene in enumerate(scenes):
            window_start, window_len = windows[i]
            window_end = window_start + window_len
            is_fast = (
                fast_after is not None
                and window_end > float(fast_after)
                and not (hold_first and i == 0)
            )
            if is_fast and hold_start is not None:
                plan = plan_accel_cut_montage(
                    clip_durs_all, beat_times, window_start, window_len, zooms,
                    float(fast_after), float(hold_start), slow_seg, fast_seg, fast_min_cut,
                )
            elif is_fast:
                plan = plan_beat_cut_montage(
                    clip_durs_all, beat_times, window_start, window_len,
                    zooms, fast_clip_beats, fast_min_cut,
                )
            else:
                plan = None

            if plan:
                for cut in plan:
                    raw_path = clip_paths[cut["clip_index"]]
                    cut_out = os.path.join(job_dir, f"cut_{cut_idx:03d}.mp4")
                    extract_montage_cut(
                        raw_path, cut_out, cut["src_offset"], cut["length"],
                        cut["zoom"], grade_filter, resolution,
                        exposure=_exposure_for(raw_path), fit=fit,
                        flash=0.0, card_opts=card_opts,
                    )
                    cut_paths.append(cut_out)
                    cut_idx += 1
                scene_cut_counts.append(len(plan))
                continue

            raw_path = clip_paths[i % len(clip_paths)]
            src_dur = get_duration(raw_path)
            if hold_first and i == 0:
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
                cut_out = os.path.join(job_dir, f"cut_{cut_idx:03d}.mp4")
                in_flash_window = flash_until is None or window_start < float(flash_until)
                do_flash = flash_dur > 0 and in_flash_window and (
                    (ci == 0) if flash_mode == "scene" else (cut_idx % flash_every == 0)
                )
                extract_montage_cut(
                    raw_path, cut_out, cut["src_offset"], cut["length"],
                    cut["zoom"], grade_filter, resolution,
                    exposure=_exposure_for(raw_path), fit=fit,
                    flash=flash_dur if do_flash else 0.0,
                    card_opts=card_opts,
                )
                cut_paths.append(cut_out)
                cut_idx += 1
            scene_cut_counts.append(len(cuts))

    concat_path = os.path.join(job_dir, "concat.mp4")
    concatenate_clips(card_paths + cut_paths, concat_path)

    with_audio = os.path.join(job_dir, "with_audio.mp4")
    add_background_audio_only(concat_path, audio_path, with_audio, audio_volume, audio_start)

    card_total = sum(get_duration(p) for p in card_paths)
    if template.get("clip_per_beat"):
        # clip_per_beat isn't grouped per scene; lay caption windows on each scene's
        # share of the real footage length (mirrors run_broll_render).
        footage_total = sum(get_duration(p) for p in cut_paths)
        intended = sum(max(0.1, float(s["duration_seconds"])) for s in scenes) or 1.0
        scale = footage_total / intended
        scenes_timed = []
        cursor = card_total
        for s in scenes:
            d = max(0.1, float(s["duration_seconds"])) * scale
            scenes_timed.append({**s, "start_time": cursor, "duration_seconds": d})
            cursor += d
    else:
        scenes_timed = build_scene_timings_from_cuts(
            cut_paths, scene_cut_counts, scenes, card_total
        )

    ass_path = os.path.join(job_dir, "captions.ass")
    # Burn each scene's script phrase — not the template closing_caption placeholder.
    if caption_style == "kinetic":
        generate_ass_kinetic(
            scenes_timed, beat_times, ass_path, resolution, caption_preset
        )
    elif caption_style == "karaoke":
        generate_ass_karaoke(
            scenes_timed, beat_times, ass_path, "karaoke", resolution, caption_preset
        )
    else:
        segments = [
            {
                "start": s["start_time"],
                "end": s["start_time"] + max(0.1, s["duration_seconds"] - 0.04),
                "text": s.get("phrase", ""),
            }
            for s in scenes_timed
            if s.get("phrase")
        ]
        generate_ass_simple(segments, ass_path, caption_style, resolution, caption_preset)

    # burn_subtitles_ass always writes its output into the .ass file's directory
    # (it runs ffmpeg with cwd=ass_dir and basenames the paths), so render into the
    # job dir first, then copy to the requested destination.
    import shutil
    final_in_job = os.path.join(job_dir, "final.mp4")
    burn_subtitles_ass(
        with_audio, ass_path, final_in_job,
        template.get("caption_blend"), float(template.get("caption_blend_opacity", 0.85)),
        True,
    )
    # Optional darkening outro: fade the picture to black over the last seconds.
    final_src = final_in_job
    end_fade = template.get("end_fade")
    if end_fade:
        final_src = os.path.join(job_dir, "final_faded.mp4")
        apply_end_fade(final_in_job, final_src, float(end_fade))

    out_abs = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_abs) or ".", exist_ok=True)
    shutil.copy2(final_src, out_abs)
    print(f"\nRendered -> {out_abs}  ({get_duration(out_abs):.2f}s)")
    return out_abs


def dump_frames(video_path: str):
    frames_dir = f"{os.path.splitext(video_path)[0]}_frames"
    os.makedirs(frames_dir, exist_ok=True)
    import subprocess
    subprocess.run(
        [_tool("ffmpeg"), "-y", "-i", video_path, "-vf", "fps=1,scale=638:-1",
         os.path.join(frames_dir, "f_%02d.jpg")],
        capture_output=True,
    )
    print(f"frames -> {frames_dir}")
    return frames_dir


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", default="ref-locked-in")
    ap.add_argument("--out", default="temp/render_test.mp4")
    ap.add_argument("--clips", nargs="+", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--phrases", nargs="*", default=None)
    ap.add_argument("--platform", default="TikTok")
    ap.add_argument("--no-frames", action="store_true")
    args = ap.parse_args()

    clips = [os.path.expanduser(c) for c in args.clips]
    for c in clips:
        if not os.path.isfile(c):
            print(f"missing clip: {c}")
            return 1
    audio = os.path.expanduser(args.audio)
    if not os.path.isfile(audio):
        print(f"missing audio: {audio}")
        return 1

    phrases = args.phrases if args.phrases else DEFAULT_PHRASES
    out = local_broll_render(
        args.out, clips, audio, phrases, args.template, args.platform
    )
    if not args.no_frames:
        dump_frames(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
