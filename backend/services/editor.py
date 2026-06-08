import json
import os
import subprocess
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = str(BACKEND_DIR / "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

WHISPER_ENABLED = True
_whisper_model = None

_FFMPEG_HINT = (
    "FFmpeg not found. Put it in backend/tools/ffmpeg/bin/ "
    "or install from https://ffmpeg.org and add to PATH."
)

_LOCAL_FFMPEG_BIN = BACKEND_DIR / "tools" / "ffmpeg" / "bin"


def _tool(name: str) -> str:
    local = _LOCAL_FFMPEG_BIN / f"{name}.exe"
    if local.is_file():
        return str(local)
    return name


def _run(cmd: list[str], **kwargs):
    if cmd:
        cmd = [_tool(cmd[0])] + cmd[1:]
    try:
        return subprocess.run(cmd, check=True, capture_output=True, **kwargs)
    except FileNotFoundError as e:
        raise RuntimeError(_FFMPEG_HINT) from e


def check_ffmpeg():
    _run(["ffmpeg", "-version"])
    _run(["ffprobe", "-version"])

_gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip().strip('"').strip("'")
if _gemini_key and _gemini_key != "your_key_here":
    genai.configure(api_key=_gemini_key)


def trim_clip(
    input_path: str,
    output_path: str,
    trim_start: float,
    trim_end: float,
    duration: float,
    mute: bool = False,
):
    """Trim a single video clip. If mute=True, replace audio with silence for concat compatibility."""
    end_time = duration - trim_end if trim_end > 0 else duration
    segment_len = max(0.01, end_time - trim_start)

    if mute:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-ss",
            str(trim_start),
            "-to",
            str(end_time),
            "-f",
            "lavfi",
            "-i",
            f"anullsrc=r=44100:cl=stereo:d={segment_len}",
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-preset",
            "fast",
            "-shortest",
            output_path,
        ]
    else:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-ss",
            str(trim_start),
            "-to",
            str(end_time),
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-preset",
            "fast",
            output_path,
        ]
    _run(cmd)


def has_audio_stream(file_path: str) -> bool:
    """Return True if the file contains at least one audio stream."""
    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=index",
        "-of",
        "csv=p=0",
        file_path,
    ]
    if cmd:
        cmd = [_tool(cmd[0])] + cmd[1:]
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError:
        # ffprobe exits 1 when no audio stream exists — not an error for us
        return False
    except FileNotFoundError as e:
        raise RuntimeError(_FFMPEG_HINT) from e
    return bool(result.stdout.strip())


def get_duration(file_path: str) -> float:
    """Get video duration in seconds using FFprobe."""
    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        file_path,
    ]
    result = _run(cmd, text=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def concatenate_clips(clip_paths: list[str], output_path: str):
    """Concatenate multiple clips into one video using FFmpeg concat."""
    list_file = os.path.join(TEMP_DIR, "concat_list.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for path in clip_paths:
            f.write(f"file '{os.path.abspath(path)}'\n")

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list_file,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-preset",
        "fast",
        output_path,
    ]
    _run(cmd)


def add_background_audio(
    video_path: str, audio_path: str, output_path: str, volume: float = 0.3
):
    """Mix background audio into video, or use only background if the clip has no audio."""
    vol = max(0.05, min(float(volume), 2.0))

    if has_audio_stream(video_path):
        # normalize=0: do not squash both tracks; keeps background audible over clip audio
        filter_complex = (
            f"[1:a]volume={vol}[bg];"
            f"[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]"
        )
    else:
        # Clips filmed without mic often have no audio stream — old filter failed silently or errored
        filter_complex = f"[1:a]volume={vol}[aout]"

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-i",
        audio_path,
        "-filter_complex",
        filter_complex,
        "-map",
        "0:v",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        output_path,
    ]
    _run(cmd)


def add_background_audio_only(
    video_path: str, audio_path: str, output_path: str, volume: float = 0.6
):
    """Replace video audio with background music only — source clip audio is discarded."""
    vol = max(0.05, min(float(volume), 2.0))
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-i",
        audio_path,
        "-filter_complex",
        f"[1:a]volume={vol}[aout]",
        "-map",
        "0:v",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        output_path,
    ]
    _run(cmd)


def transcribe_audio(audio_path: str) -> list[dict]:
    """Transcribe audio/video and return timed segments synced to vocals."""
    global _whisper_model

    if not WHISPER_ENABLED:
        raise RuntimeError("Whisper transcription is disabled.")

    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise RuntimeError("Install faster-whisper: pip install faster-whisper") from e

    if _whisper_model is None:
        _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")

    segments_iter, _ = _whisper_model.transcribe(
        audio_path,
        vad_filter=True,
        word_timestamps=False,
    )
    segments = [
        {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
        for seg in segments_iter
        if seg.text.strip()
    ]
    if not segments:
        raise RuntimeError("No speech detected in audio.")
    return segments


def segments_from_text(text: str, duration: float) -> list[dict]:
    """Split plain text into timed segments for testing without Whisper."""
    lines = [line.strip() for line in text.strip().split("\n") if line.strip()]
    if not lines:
        lines = [text.strip() or "..."]
    chunk = max(duration / len(lines), 0.5)
    segments = []
    for i, line in enumerate(lines):
        start = i * chunk
        end = min((i + 1) * chunk, duration)
        if start >= duration:
            break
        segments.append({"start": start, "end": end, "text": line})
    return segments


def generate_ass_simple(segments: list, output_path: str, style: str = "tiktok_bold"):
    """
    Generate .ass subtitle file with advanced styling.

    style options:
    - tiktok_bold: large bold white text, black outline, bottom center
    - plaque: white text on dark semi-transparent background plaque
    - center_caps: uppercase, center screen, thick outline, aggressive
    """
    styles = {
        "tiktok_bold": {
            "Name": "Default",
            "Fontname": "Arial",
            "Fontsize": "78",
            "PrimaryColour": "&H00FFFFFF",
            "SecondaryColour": "&H00FFFFFF",
            "OutlineColour": "&H00000000",
            "BackColour": "&H00000000",
            "Bold": "1",
            "Italic": "0",
            "Outline": "4",
            "Shadow": "2",
            "Alignment": "2",
            "MarginV": "150",
        },
        "plaque": {
            "Name": "Default",
            "Fontname": "Arial",
            "Fontsize": "72",
            "PrimaryColour": "&H00FFFFFF",
            "SecondaryColour": "&H00FFFFFF",
            "OutlineColour": "&H00000000",
            "BackColour": "&HAA000000",
            "Bold": "1",
            "Italic": "0",
            "Outline": "0",
            "Shadow": "0",
            "BorderStyle": "4",
            "Alignment": "2",
            "MarginV": "150",
        },
        "center_caps": {
            "Name": "Default",
            "Fontname": "Arial",
            "Fontsize": "84",
            "PrimaryColour": "&H00FFFFFF",
            "SecondaryColour": "&H00FFFFFF",
            "OutlineColour": "&H00000000",
            "BackColour": "&H00000000",
            "Bold": "1",
            "Italic": "0",
            "Outline": "4",
            "Shadow": "2",
            "Alignment": "5",
            "MarginV": "0",
        },
        "broll_center": {
            "Name": "Default",
            "Fontname": "Arial",
            "Fontsize": "56",
            "PrimaryColour": "&H00FFFFFF",
            "SecondaryColour": "&H00FFFFFF",
            "OutlineColour": "&H00000000",
            "BackColour": "&H00000000",
            "Bold": "0",
            "Italic": "0",
            "Outline": "1",
            "Shadow": "1",
            "Alignment": "5",
            "MarginV": "0",
        },
    }

    chosen = styles.get(style, styles["tiktok_bold"])

    def format_ass_time(seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int((seconds % 1) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    style_line = (
        f"Style: {chosen['Name']},"
        f"{chosen['Fontname']},"
        f"{chosen['Fontsize']},"
        f"{chosen['PrimaryColour']},"
        f"{chosen['SecondaryColour']},"
        f"{chosen['OutlineColour']},"
        f"{chosen['BackColour']},"
        f"{chosen.get('Bold', '0')},"
        f"{chosen.get('Italic', '0')},"
        f"0,0,"
        f"100,100,"
        f"0,0,"
        f"{chosen.get('BorderStyle', '1')},"
        f"{chosen.get('Outline', '2')},"
        f"{chosen.get('Shadow', '1')},"
        f"{chosen.get('Alignment', '2')},"
        f"10,10,"
        f"{chosen.get('MarginV', '60')},"
        f"1"
    )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("[Script Info]\n")
        f.write("ScriptType: v4.00+\n")
        f.write("PlayResX: 1080\n")
        f.write("PlayResY: 1920\n\n")
        f.write("[V4+ Styles]\n")
        f.write(
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
            "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        )
        f.write(style_line + "\n\n")
        f.write("[Events]\n")
        f.write(
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )

        for seg in segments:
            text = seg["text"].strip()
            if style == "center_caps":
                text = text.upper()

            start = format_ass_time(seg["start"])
            end = format_ass_time(seg["end"])
            f.write(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n")


def burn_subtitles_ass(video_path: str, ass_path: str, output_path: str) -> str:
    """Burn .ass subtitles into video using FFmpeg."""
    work_dir = os.path.dirname(os.path.abspath(ass_path))
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        os.path.basename(video_path),
        "-vf",
        f"ass={os.path.basename(ass_path)}",
        "-c:a",
        "copy",
        os.path.basename(output_path),
    ]
    if cmd:
        cmd = [_tool(cmd[0])] + cmd[1:]
    try:
        subprocess.run(cmd, check=True, capture_output=True, cwd=work_dir)
    except FileNotFoundError as e:
        raise RuntimeError(_FFMPEG_HINT) from e
    return output_path


def detect_beats(audio_path: str) -> list[float]:
    """Analyze audio file and return timestamps (in seconds) of beat hits."""
    import librosa

    y, sr = librosa.load(audio_path, sr=None)
    _, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    return beat_times


def _concat_with_fade(clip_paths: list[str], output_path: str, fade_duration: float = 0.12):
    """Concatenate clips with crossfade transitions between each clip."""
    if len(clip_paths) == 1:
        import shutil

        shutil.copy(clip_paths[0], output_path)
        return

    inputs = []
    for path in clip_paths:
        inputs += ["-i", path]

    filter_parts = []
    for i, _path in enumerate(clip_paths):
        duration = get_duration(_path)
        fade_start = max(0, duration - fade_duration)
        filter_parts.append(
            f"[{i}:v]fade=t=out:st={fade_start}:d={fade_duration}[v{i}];"
        )
        filter_parts.append(
            f"[{i}:a]afade=t=out:st={fade_start}:d={fade_duration}[a{i}];"
        )

    v_inputs = "".join([f"[v{i}]" for i in range(len(clip_paths))])
    a_inputs = "".join([f"[a{i}]" for i in range(len(clip_paths))])
    filter_parts.append(f"{v_inputs}concat=n={len(clip_paths)}:v=1:a=0[vout];")
    filter_parts.append(f"{a_inputs}concat=n={len(clip_paths)}:v=0:a=1[aout]")

    filter_complex = "".join(filter_parts)

    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        filter_complex,
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-preset",
        "fast",
        output_path,
    ]
    _run(cmd)


def snap_clips_to_beats(
    clip_paths: list[str],
    beat_times: list[float],
    output_dir: str,
) -> list[str]:
    """
    Trim each clip so it ends exactly on the nearest beat timestamp.
    Trims from the end only; never trims more than 30% of clip duration.
    """
    import shutil

    os.makedirs(output_dir, exist_ok=True)
    snapped_paths = []
    beat_cursor = 0.0

    for i, clip_path in enumerate(clip_paths):
        duration = get_duration(clip_path)
        natural_end = beat_cursor + duration

        if not beat_times:
            snapped_paths.append(clip_path)
            continue

        nearest_beat = min(beat_times, key=lambda b: abs(b - natural_end))
        diff = natural_end - nearest_beat
        max_trim = duration * 0.30

        snapped_path = os.path.join(output_dir, f"snapped_{i}.mp4")

        if 0 < diff <= max_trim:
            new_duration = duration - diff
            cmd = [
                "ffmpeg",
                "-y",
                "-i",
                clip_path,
                "-t",
                str(new_duration),
                "-c:v",
                "libx264",
                "-c:a",
                "aac",
                "-preset",
                "fast",
                snapped_path,
            ]
            _run(cmd)
            beat_cursor += new_duration

        elif diff < 0 and abs(diff) <= 1.5:
            freeze_duration = abs(diff)
            freeze_path = os.path.join(output_dir, f"freeze_{i}.mp4")
            last_frame = os.path.join(output_dir, f"last_frame_{i}.jpg")

            _run(
                [
                    "ffmpeg",
                    "-y",
                    "-sseof",
                    "-0.1",
                    "-i",
                    clip_path,
                    "-vframes",
                    "1",
                    last_frame,
                ]
            )

            _run(
                [
                    "ffmpeg",
                    "-y",
                    "-loop",
                    "1",
                    "-i",
                    last_frame,
                    "-f",
                    "lavfi",
                    "-i",
                    f"anullsrc=r=44100:cl=stereo:d={freeze_duration}",
                    "-t",
                    str(freeze_duration),
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    "-pix_fmt",
                    "yuv420p",
                    "-shortest",
                    freeze_path,
                ]
            )

            concatenate_clips([clip_path, freeze_path], snapped_path)
            beat_cursor += duration + freeze_duration

            for p in [last_frame, freeze_path]:
                if os.path.exists(p):
                    os.remove(p)
        else:
            shutil.copy(clip_path, snapped_path)
            beat_cursor += duration

        snapped_paths.append(snapped_path)

    return snapped_paths


def beat_interval_durations(
    num_clips: int,
    beat_times: list[float],
    fallbacks: list[float],
) -> list[float]:
    """One clip per beat interval — cut lengths follow the music grid."""
    if len(beat_times) >= num_clips + 1:
        durations = []
        for i in range(num_clips):
            d = beat_times[i + 1] - beat_times[i]
            durations.append(max(0.8, min(d, 8.0)))
        return durations
    return [max(0.8, float(d)) for d in fallbacks[:num_clips]]


def build_scene_timings(clip_paths: list[str], scenes: list[dict]) -> list[dict]:
    """Map phrases to actual clip durations so only one text shows per scene."""
    timed: list[dict] = []
    cursor = 0.0
    for clip_path, scene in zip(clip_paths, scenes):
        duration = get_duration(clip_path)
        timed.append(
            {
                **scene,
                "start_time": cursor,
                "duration_seconds": duration,
            }
        )
        cursor += duration
    return timed


def apply_beat_sync_transitions(
    clip_paths: list[str],
    audio_path: str,
    output_path: str,
    transition_type: str = "fade",
    fade_duration: float = 0.12,
    add_subtitles: bool = False,
    subtitle_preset: str = "tiktok_bold",
) -> str:
    """Snap clips to beats, join with transitions, mix audio, optionally burn synced subs."""
    beat_times = detect_beats(audio_path)
    output_dir = os.path.dirname(os.path.abspath(output_path)) or TEMP_DIR
    os.makedirs(output_dir, exist_ok=True)

    snapped_paths: list[str] = []
    if beat_times:
        snapped_paths = snap_clips_to_beats(clip_paths, beat_times, output_dir)
        source_clips = snapped_paths
    else:
        source_clips = clip_paths

    concat_path = os.path.join(output_dir, "beat_concat.mp4")
    if transition_type == "fade":
        _concat_with_fade(source_clips, concat_path, fade_duration)
    else:
        concatenate_clips(source_clips, concat_path)

    mixed_path = os.path.join(output_dir, "beat_mixed.mp4")
    add_background_audio(concat_path, audio_path, mixed_path, volume=1.0)

    if add_subtitles:
        segments = transcribe_audio(audio_path)
        ass_path = os.path.join(output_dir, "subs.ass")
        generate_ass_simple(segments, ass_path, subtitle_preset)
        burn_subtitles_ass(mixed_path, ass_path, output_path)
        if os.path.exists(ass_path):
            os.remove(ass_path)
    else:
        import shutil

        shutil.move(mixed_path, output_path)

    for p in snapped_paths:
        if os.path.exists(p) and os.path.abspath(p) not in {
            os.path.abspath(c) for c in clip_paths
        }:
            os.remove(p)
    for p in [concat_path, mixed_path]:
        if os.path.exists(p) and os.path.abspath(p) != os.path.abspath(output_path):
            os.remove(p)

    return output_path


def detect_silence(
    video_path: str,
    silence_threshold: float = -35.0,
    min_silence_duration: float = 0.5,
) -> list[dict]:
    """Detect silent moments in video using FFmpeg silencedetect."""
    import re

    cmd = [
        "ffmpeg",
        "-i",
        video_path,
        "-af",
        f"silencedetect=noise={silence_threshold}dB:d={min_silence_duration}",
        "-f",
        "null",
        "-",
    ]
    result = _run(cmd, text=True)

    stderr = result.stderr
    silences = []

    starts = re.findall(r"silence_start: ([\d.]+)", stderr)
    ends = re.findall(r"silence_end: ([\d.]+)", stderr)

    for start, end in zip(starts, ends):
        s = float(start)
        e = float(end)
        silences.append(
            {
                "start": round(s, 2),
                "end": round(e, 2),
                "duration": round(e - s, 2),
            }
        )

    return silences


def remove_silence(
    video_path: str,
    output_path: str,
    silence_threshold: float = -35.0,
) -> str:
    """Remove silent segments from video automatically."""
    import shutil

    silences = detect_silence(video_path, silence_threshold)
    total_duration = get_duration(video_path)

    if not silences:
        shutil.copy(video_path, output_path)
        return output_path

    keep_segments = []
    prev_end = 0.0

    for silence in silences:
        if silence["start"] > prev_end + 0.1:
            keep_segments.append((prev_end, silence["start"]))
        prev_end = silence["end"]

    if prev_end < total_duration - 0.1:
        keep_segments.append((prev_end, total_duration))

    if not keep_segments:
        shutil.copy(video_path, output_path)
        return output_path

    temp_segments = []
    for idx, (start, end) in enumerate(keep_segments):
        seg_path = video_path.replace(".mp4", f"_seg_{idx}.mp4")
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            video_path,
            "-ss",
            str(start),
            "-to",
            str(end),
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-preset",
            "fast",
            seg_path,
        ]
        _run(cmd)
        temp_segments.append(seg_path)

    concatenate_clips(temp_segments, output_path)

    for p in temp_segments:
        if os.path.exists(p):
            os.remove(p)

    return output_path


def apply_color_grade(video_path: str, output_path: str, grade: str) -> str:
    """Apply cinematic color grade using FFmpeg filters."""
    filters = {
        "dark_cinematic": "eq=brightness=-0.06:contrast=1.18:saturation=0.72,vignette=PI/5",
        "moody": "eq=brightness=-0.08:contrast=1.12:saturation=0.65,vignette=PI/4",
        "high_contrast": "eq=brightness=-0.03:contrast=1.35:saturation=0.85,vignette=PI/4",
    }
    f = filters.get(grade, filters["dark_cinematic"])
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vf",
        f,
        "-c:a",
        "copy",
        output_path,
    ]
    _run(cmd)
    return output_path


def burn_text_overlay(
    video_path: str,
    output_path: str,
    scenes: list[dict],
) -> str:
    """Burn text phrases onto video at scene timestamps — heyeaslo aesthetic."""
    segments = []
    for scene in scenes:
        start = float(scene.get("start_time", 0))
        duration = float(scene.get("duration_seconds", 3))
        # Small gap before next phrase so two lines never overlap on screen
        end = start + max(0.1, duration - 0.04)
        segments.append(
            {
                "start": start,
                "end": end,
                "text": scene["phrase"],
            }
        )

    job_dir = os.path.dirname(os.path.abspath(output_path))
    ass_path = os.path.join(job_dir, "broll_text.ass")
    generate_ass_simple(segments, ass_path, style="broll_center")
    burn_subtitles_ass(video_path, ass_path, output_path)
    return output_path


def trim_clip_to_duration(
    input_path: str,
    output_path: str,
    duration: float,
    mute: bool = False,
) -> str:
    """Trim clip to exact target duration from start. mute=True strips source audio."""
    duration = max(0.1, float(duration))
    if mute:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-f",
            "lavfi",
            "-i",
            f"anullsrc=r=44100:cl=stereo:d={duration}",
            "-t",
            str(duration),
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-preset",
            "fast",
            "-shortest",
            output_path,
        ]
    else:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-t",
            str(duration),
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-preset",
            "fast",
            output_path,
        ]
    _run(cmd)
    return output_path


def resize_for_platform(video_path: str, output_path: str, platform: str):
    """Resize video to platform-specific dimensions."""
    resolutions = {
        "TikTok": "1080:1920",
        "Reels": "1080:1920",
        "LinkedIn": "1920:1080",
    }
    resolution = resolutions.get(platform, "1080:1920")

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vf",
        f"scale={resolution}:force_original_aspect_ratio=decrease,pad={resolution}:(ow-iw)/2:(oh-ih)/2",
        "-c:a",
        "copy",
        output_path,
    ]
    _run(cmd)


def generate_description(script_summary: str, platform: str) -> str:
    """Generate video description using Gemini."""
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    platform_rules = {
        "TikTok": "150 chars max, 3-5 hashtags, casual tone",
        "LinkedIn": "200-300 chars, professional but personal, 3 relevant hashtags",
        "Reels": "100-150 chars, emojis ok, 5 hashtags",
    }
    rule = platform_rules.get(platform, platform_rules["TikTok"])

    prompt = f"""
Write a video description for {platform} based on this script summary:
{script_summary}

Rules:
- {rule}
- Sound like a real person, not a brand
- End with relevant hashtags

Return only the description text, nothing else.
"""
    response = model.generate_content(prompt)
    return response.text.strip()
