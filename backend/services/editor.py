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


def _register_local_ffmpeg_on_path() -> None:
    """Put the bundled ffmpeg/ffprobe on PATH.

    We call ffmpeg directly via `_tool()`, but librosa's audioread fallback (used
    by detect_beats when soundfile can't decode the audio, e.g. m4a/aac uploaded
    as .mp3) searches PATH for ffmpeg. Without this, beat detection dies with
    audioread NoBackendError and the whole render fails at the first step.
    """
    if not _LOCAL_FFMPEG_BIN.is_dir():
        return
    bin_str = str(_LOCAL_FFMPEG_BIN)
    current = os.environ.get("PATH", "")
    parts = current.split(os.pathsep)
    if bin_str not in parts:
        os.environ["PATH"] = bin_str + os.pathsep + current


_register_local_ffmpeg_on_path()


def _tool(name: str) -> str:
    local = _LOCAL_FFMPEG_BIN / f"{name}.exe"
    if local.is_file():
        return str(local)
    return name


def _run(cmd: list[str], **kwargs):
    if cmd:
        cmd = [_tool(cmd[0])] + cmd[1:]
    # In text mode, decode as UTF-8 (ffmpeg's output encoding) rather than the
    # Windows locale (cp1251). Otherwise ffmpeg echoing a filename with emoji or
    # non-Latin chars makes the subprocess reader thread raise UnicodeDecodeError,
    # which surfaces as stdout=None and breaks json.loads / parsing downstream.
    if kwargs.get("text") and "encoding" not in kwargs:
        kwargs["encoding"] = "utf-8"
        kwargs["errors"] = "replace"
    try:
        return subprocess.run(cmd, check=True, capture_output=True, **kwargs)
    except FileNotFoundError as e:
        raise RuntimeError(_FFMPEG_HINT) from e
    except subprocess.CalledProcessError as e:
        # CalledProcessError.__str__ omits stderr, so the real ffmpeg reason was
        # being lost. Surface the tail of stderr so failures are diagnosable.
        stderr = e.stderr
        if isinstance(stderr, bytes):
            stderr = stderr.decode("utf-8", "replace")
        tail = "\n".join((stderr or "").strip().splitlines()[-8:])
        tool = os.path.basename(cmd[0]) if cmd else "ffmpeg"
        raise RuntimeError(f"{tool} failed (exit {e.returncode}):\n{tail}") from e


def check_ffmpeg():
    _run(["ffmpeg", "-version"])
    _run(["ffprobe", "-version"])


def transcode_to_mp3(input_path: str, output_path: str, bitrate: str = "192k") -> str:
    """Re-encode any ffmpeg-readable audio (or video's audio track) into a clean mp3.

    Uploaders may send m4a/aac/wav/ogg etc. Storing those bytes under a .mp3 name
    breaks beat detection (soundfile can't decode them). Normalizing to real mp3
    on upload guarantees a decodable file downstream.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-vn",  # drop any video stream, keep audio only
        "-acodec",
        "libmp3lame",
        "-b:a",
        bitrate,
        "-ar",
        "44100",
        output_path,
    ]
    _run(cmd)
    return output_path

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
    if not clip_paths:
        raise ValueError("concatenate_clips: no input clips to concatenate")
    # Write the concat list next to the output (per-job dir) instead of a single
    # shared file in TEMP_DIR — two concurrent renders would otherwise clobber it.
    out_dir = os.path.dirname(os.path.abspath(output_path)) or TEMP_DIR
    list_file = os.path.join(out_dir, "concat_list.txt")
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
        # loop the music so a track shorter than the montage can't truncate it;
        # -shortest below then ends the output exactly at the video length
        "-stream_loop",
        "-1",
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


# All burned-in subtitle styles live here. Arial is used deliberately: it is the
# one font guaranteed to exist on the render host (Railway), so libass never falls
# back to a missing face and silently drops the text.
ASS_STYLES = {
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
    # Word-by-word captions: bold, centered, thick outline so each word reads
    # cleanly over busy b-roll while the phrase builds up in time with the beat.
    "karaoke": {
        "Name": "Default",
        "Fontname": "Arial",
        "Fontsize": "66",
        "PrimaryColour": "&H00FFFFFF",
        "SecondaryColour": "&H00FFFFFF",
        "OutlineColour": "&H00000000",
        "BackColour": "&H80000000",
        "Bold": "1",
        "Italic": "0",
        "Outline": "3",
        "Shadow": "1",
        "Alignment": "5",
        "MarginV": "0",
    },
}

# Mint accent (#10B981) written as ASS &HBBGGRR for the currently-spoken word.
KARAOKE_ACTIVE_COLOR = "&H81B910&"
KARAOKE_BASE_COLOR = "&HFFFFFF&"


def _ass_time(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds % 1) * 100))
    if cs >= 100:  # rounding can push .995 -> 100; clamp so the field stays 2 digits
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _ass_style_line(style: str, font: str = "", fontsize=None) -> str:
    chosen = ASS_STYLES.get(style, ASS_STYLES["tiktok_bold"])
    fontname = font or chosen["Fontname"]
    size = str(int(fontsize)) if fontsize else chosen["Fontsize"]
    return (
        f"Style: {chosen['Name']},"
        f"{fontname},"
        f"{size},"
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


def _write_ass_header(
    f, style: str, play_w: int = 1080, play_h: int = 1920, font: str = "", fontsize=None
) -> None:
    f.write("[Script Info]\n")
    f.write("ScriptType: v4.00+\n")
    # PlayRes MUST match the rendered frame, otherwise libass scales X and Y by
    # different factors and the captions come out stretched / mispositioned.
    f.write(f"PlayResX: {play_w}\n")
    f.write(f"PlayResY: {play_h}\n\n")
    f.write("[V4+ Styles]\n")
    f.write(
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
    )
    f.write(_ass_style_line(style, font, fontsize) + "\n\n")
    f.write("[Events]\n")
    f.write(
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )


def generate_ass_simple(
    segments: list,
    output_path: str,
    style: str = "tiktok_bold",
    resolution: str = "1080:1920",
    font: str = "",
    fontsize=None,
):
    """
    Generate .ass subtitle file with advanced styling.

    style options:
    - tiktok_bold: large bold white text, black outline, bottom center
    - plaque: white text on dark semi-transparent background plaque
    - center_caps: uppercase, center screen, thick outline, aggressive

    font / fontsize override the style's defaults so each template can have its own
    caption look.
    """
    try:
        play_w, play_h = (int(float(x)) for x in resolution.split(":"))
    except (ValueError, TypeError):
        play_w, play_h = 1080, 1920
    with open(output_path, "w", encoding="utf-8") as f:
        _write_ass_header(f, style, play_w, play_h, font, fontsize)
        for seg in segments:
            text = seg["text"].strip()
            if style == "center_caps":
                text = text.upper()
            f.write(
                f"Dialogue: 0,{_ass_time(seg['start'])},{_ass_time(seg['end'])},"
                f"Default,,0,0,0,,{text}\n"
            )


def _wrap_words(words: list[str], max_chars: int = 18, max_words_per_line: int = 3):
    """Group words into centered caption lines (≤ max_chars or max_words each)."""
    lines: list[list[str]] = []
    cur: list[str] = []
    cur_len = 0
    for w in words:
        add = len(w) + (1 if cur else 0)
        if cur and (cur_len + add > max_chars or len(cur) >= max_words_per_line):
            lines.append(cur)
            cur, cur_len = [w], len(w)
        else:
            cur.append(w)
            cur_len += add
    if cur:
        lines.append(cur)
    return lines


def _karaoke_word_times(start: float, end: float, n_words: int, beats: list[float]):
    """Appearance time for each word within [start, end].

    Word 0 shows at the scene start; the rest land on musical beats when enough
    fall inside the window, otherwise they spread evenly. The last word appears by
    ~85% of the scene so the finished phrase holds for a beat before the next cut.
    """
    if n_words <= 1:
        return [start]

    reveal_end = start + (end - start) * 0.85
    span = max(0.2, reveal_end - start)
    need = n_words - 1
    # Shrink the per-word gap when the scene is too short to fit every word at the
    # ideal 0.16s spacing, so late words never collapse into a sub-frame flicker.
    eff_gap = min(0.16, span / need)

    candidates = [b for b in beats if start + eff_gap < b <= reveal_end]
    if len(candidates) >= need:
        last = len(candidates) - 1
        picked = [candidates[round(i * last / need)] for i in range(1, need + 1)]
        times = [start] + picked
    else:
        times = [start] + [start + span * i / need for i in range(1, need + 1)]

    # enforce strictly increasing with the effective gap, capped just before the end
    cap = end - 0.05
    clean = [start]
    for t in times[1:]:
        t = min(max(t, clean[-1] + eff_gap), cap)
        if t <= clean[-1]:
            t = clean[-1] + 0.001  # last-resort monotonic guard
        clean.append(t)
    return clean


def _render_cumulative(lines_struct, visible: int, active: int) -> str:
    """Render the first `visible` words across wrapped lines, the `active` one mint."""
    out_lines: list[str] = []
    gi = 0
    for line in lines_struct:
        toks: list[str] = []
        for w in line:
            if gi < visible:
                if gi == active:
                    toks.append(
                        f"{{\\c{KARAOKE_ACTIVE_COLOR}}}{w}{{\\c{KARAOKE_BASE_COLOR}}}"
                    )
                else:
                    toks.append(w)
            gi += 1
        if toks:
            out_lines.append(" ".join(toks))
        elif out_lines:
            break  # no visible words left on this line -> nothing further is shown
    return "\\N".join(out_lines)


def generate_ass_karaoke(
    scenes_timed: list,
    beat_times: list,
    output_path: str,
    style: str = "karaoke",
    resolution: str = "1080:1920",
    font: str = "",
    fontsize=None,
):
    """Write an .ass where each scene's phrase reveals word-by-word, in time with
    the beat, the newest word highlighted in mint — a montage caption look.

    font / fontsize override the style defaults so each template's captions differ.
    """
    try:
        play_w, play_h = (int(float(x)) for x in resolution.split(":"))
    except (ValueError, TypeError):
        play_w, play_h = 1080, 1920

    beats = sorted(b for b in (beat_times or []) if b is not None and b >= 0)
    with open(output_path, "w", encoding="utf-8") as f:
        _write_ass_header(f, style, play_w, play_h, font, fontsize)
        for scene in scenes_timed:
            phrase = str(scene.get("phrase", "")).strip()
            if not phrase:
                continue
            start = float(scene.get("start_time", 0.0))
            dur = max(0.3, float(scene.get("duration_seconds", 3.0)))
            end = start + dur
            words = phrase.split()
            n = len(words)
            times = _karaoke_word_times(start, end, n, beats)
            lines_struct = _wrap_words(words)
            for j in range(n):
                seg_start = times[j]
                seg_end = times[j + 1] if j + 1 < n else end
                if seg_end <= seg_start:
                    seg_end = seg_start + 0.05
                text = _render_cumulative(lines_struct, visible=j + 1, active=j)
                f.write(
                    f"Dialogue: 0,{_ass_time(seg_start)},{_ass_time(seg_end)},"
                    f"Default,,0,0,0,,{text}\n"
                )


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
    beats_per_clip: int = 2,
) -> list[float]:
    """Distribute clip lengths across the planned scene durations, snapping cuts to beats.

    Instead of holding every clip for a fixed number of beats, we honor each scene's
    planned ``duration_seconds`` and snap the cumulative scene boundaries to the nearest
    musical beat. Longer scenes keep more time, shorter ones are cut tighter, so the whole
    video lands close to the planned total while every cut still falls on a beat.
    """
    if num_clips <= 0:
        return []

    planned = [max(0.8, float(d)) for d in fallbacks[:num_clips]]
    while len(planned) < num_clips:
        planned.append(planned[-1] if planned else 3.0)

    beats = sorted(b for b in beat_times if b is not None and b >= 0)
    total = sum(planned)
    if len(beats) < 2 or total <= 0:
        return [min(d, 12.0) for d in planned]

    start = beats[0]

    def nearest_beat(t):
        return min(beats, key=lambda b: abs(b - t))

    durations = []
    prev = start
    acc = 0.0
    for d in planned:
        acc += d
        boundary = nearest_beat(start + acc)
        seg = boundary - prev
        if seg < 0.8:
            seg = max(0.8, d)
        seg = min(seg, 12.0)
        durations.append(seg)
        prev = prev + seg
    return durations


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


# --- Beat-synced montage cutting -------------------------------------------------
# Each uploaded clip is sliced into several short cuts so a handful of source clips
# read as a fast, edited montage instead of a slideshow.
MONTAGE_MIN_CUT = 0.45      # never shorter than this — sub-0.4s cuts read as flicker
MONTAGE_TARGET_CUT = 0.9    # aim for ~0.9s per cut
MONTAGE_MAX_CUTS = 5        # cap cuts per scene so one long clip can't explode
MONTAGE_PUNCH_ZOOMS = (1.0, 1.12)  # alternate punch-in so cuts stay visible on static footage


def plan_scene_cuts(
    window_start: float,
    window_len: float,
    source_duration: float,
    beat_times: list[float],
    target_cut_len: float = MONTAGE_TARGET_CUT,
    max_cuts: int = MONTAGE_MAX_CUTS,
    zooms: list | tuple | None = None,
) -> list[dict]:
    """Tile one scene's screen time [0, window_len] with beat-synced sub-cuts.

    Cut boundaries snap to musical beats that fall inside the scene's window so the
    visual cuts land with the track. Each sub-cut samples a different part of the
    source clip (a jump-cut montage from one continuous take) and alternates a
    subtle punch-in zoom, so even a single static shot reads as several cuts.

    ``target_cut_len`` / ``max_cuts`` / ``zooms`` come from the active style template
    so different templates produce different pacing.

    Returns a list of ``{"src_offset", "length", "zoom"}`` in play order.
    """
    target_cut_len = max(MONTAGE_MIN_CUT, float(target_cut_len or MONTAGE_TARGET_CUT))
    max_cuts = max(1, int(max_cuts or MONTAGE_MAX_CUTS))
    zooms = list(zooms) if zooms else list(MONTAGE_PUNCH_ZOOMS)

    window_len = max(MONTAGE_MIN_CUT, float(window_len))
    src = max(0.2, float(source_duration))
    beats = sorted(b for b in (beat_times or []) if b is not None)

    k = int(round(window_len / target_cut_len))
    max_by_len = max(1, int(window_len // MONTAGE_MIN_CUT))
    k = max(1, min(k, max_cuts, max_by_len))

    # beats inside the window, expressed relative to the window start
    inner = sorted(
        b - window_start
        for b in beats
        if window_start < b < window_start + window_len
    )

    boundaries = [0.0]
    for i in range(1, k):
        ideal = i * window_len / k
        chosen = ideal
        if inner:
            nearest = min(inner, key=lambda x: abs(x - ideal))
            if abs(nearest - ideal) <= target_cut_len * 0.5:
                chosen = nearest
        # if snapping to a beat pulled the boundary too close to drop it, fall back
        # to the evenly-spaced position so the montage keeps its intended cut count
        if not (
            chosen - boundaries[-1] >= MONTAGE_MIN_CUT
            and window_len - chosen >= MONTAGE_MIN_CUT
        ):
            chosen = ideal
        # keep boundaries monotonic and every piece >= the minimum cut length
        if (
            chosen - boundaries[-1] >= MONTAGE_MIN_CUT
            and window_len - chosen >= MONTAGE_MIN_CUT
        ):
            boundaries.append(chosen)
    boundaries.append(window_len)

    cuts: list[dict] = []
    n = len(boundaries) - 1
    for j in range(n):
        # never request more footage than the source has (short clip uploaded for a
        # longer scene); offsets below then always keep src_offset + length <= src
        length = min(boundaries[j + 1] - boundaries[j], src)
        if n > 1 and src - length > 0.05:
            # spread cuts across the whole source for genuine jumps between frames
            offset = (j / (n - 1)) * (src - length)
        else:
            offset = min(boundaries[j], max(0.0, src - length))
        cuts.append(
            {
                "src_offset": round(max(0.0, offset), 3),
                "length": round(length, 3),
                "zoom": zooms[j % len(zooms)],
            }
        )
    return cuts


def montage_scene_windows(
    scene_durations: list[float],
    beat_times: list[float],
    target_cut_len: float = MONTAGE_TARGET_CUT,
) -> list[tuple]:
    """Lay scenes out on the video timeline and snap each scene's END to a beat.

    The output video starts at t=0 and the music is mixed in from t=0, so a librosa
    beat at absolute time ``b`` is *heard* at output time ``b``. We therefore place
    scene boundaries directly on those absolute beat times (no re-basing): each
    scene change — the most visible cut, where the source clip swaps — then lands on
    a beat the viewer can hear, and ``plan_scene_cuts`` / ``generate_ass_karaoke``,
    which both read the same absolute beats, stay on the exact same clock.

    Returns ``[(window_start, window_len), ...]`` in video time.
    """
    snap_tol = max(MONTAGE_MIN_CUT, float(target_cut_len or MONTAGE_TARGET_CUT))
    beats = sorted(b for b in (beat_times or []) if b is not None and b >= 0)
    windows: list[tuple] = []
    cursor = 0.0
    for d in scene_durations:
        target_len = max(MONTAGE_MIN_CUT, min(float(d), 12.0))
        target_end = cursor + target_len
        end = target_end
        if beats:
            cands = [b for b in beats if b >= cursor + MONTAGE_MIN_CUT]
            if cands:
                nearest = min(cands, key=lambda b: abs(b - target_end))
                # only accept the beat if it is reasonably near the planned end
                if abs(nearest - target_end) <= snap_tol:
                    end = nearest
        length = max(MONTAGE_MIN_CUT, end - cursor)
        windows.append((round(cursor, 4), round(length, 4)))
        cursor += length
    return windows


def build_scene_timings_from_cuts(
    cut_paths: list[str], scene_cut_counts: list[int], scenes: list[dict]
) -> list[dict]:
    """Regroup rendered sub-cuts back into scenes and measure each scene's real
    on-screen window from the actual cut durations, so the karaoke text lines up
    exactly with what ffmpeg produced (rounding and all)."""
    timed: list[dict] = []
    cursor = 0.0
    pos = 0
    for scene, count in zip(scenes, scene_cut_counts):
        seg = 0.0
        for _ in range(count):
            if pos < len(cut_paths):
                seg += get_duration(cut_paths[pos])
                pos += 1
        timed.append({**scene, "start_time": cursor, "duration_seconds": seg})
        cursor += seg
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


# Cinematic color-grade filter chains, shared by the full-clip grade and the
# per-cut montage extractor so both paths look identical.
COLOR_GRADES = {
    "dark_cinematic": "eq=brightness=-0.06:contrast=1.18:saturation=0.72,vignette=PI/5",
    "moody": "eq=brightness=-0.08:contrast=1.12:saturation=0.65,vignette=PI/4",
    "high_contrast": "eq=brightness=-0.03:contrast=1.35:saturation=0.85,vignette=PI/4",
}


def apply_color_grade(video_path: str, output_path: str, grade: str) -> str:
    """Apply cinematic color grade using FFmpeg filters."""
    f = COLOR_GRADES.get(grade, COLOR_GRADES["dark_cinematic"])
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


def extract_montage_cut(
    src_path: str,
    out_path: str,
    src_offset: float,
    length: float,
    zoom: float,
    grade: str,
    resolution: str = "1080:1920",
    fps: int = 30,
) -> str:
    """Produce one montage sub-cut in a single ffmpeg pass.

    Seeks to ``src_offset`` in the source, takes ``length`` seconds, applies the
    color grade and an optional centered punch-in zoom, then normalizes every cut
    to the same resolution / fps / pixel format with a silent stereo track. That
    uniformity is what lets clips from different phones concatenate cleanly and the
    1080x1920 ASS overlay land in the right place.
    """
    try:
        w, h = resolution.split(":")
    except ValueError:
        w, h = "1080", "1920"

    # `grade` may be a full ffmpeg filter string (per-template, tone-matched) or a
    # preset name from COLOR_GRADES.
    gf = grade or ""
    if gf and "=" not in gf:
        if gf not in COLOR_GRADES:  # typo / unknown name -> surface it, don't silently misgrade
            print(f"[grade] unknown grade '{gf}', falling back to dark_cinematic")
        gf = COLOR_GRADES.get(gf, COLOR_GRADES["dark_cinematic"])
    vf_parts = [gf] if gf else []

    z = max(1.0, float(zoom))
    if z > 1.001:
        # crop the centre then let the cover-scale below blow it back up = punch-in
        vf_parts.append(f"crop=iw/{z:.4f}:ih/{z:.4f}")

    # cover-fill the target frame (no letterbox bars), force constant fps/SAR/pixfmt
    vf_parts.append(
        f"scale={w}:{h}:force_original_aspect_ratio=increase,"
        f"crop={w}:{h},setsar=1,fps={fps},format=yuv420p"
    )
    vf = ",".join(vf_parts)

    seg = max(0.1, float(length))
    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        str(max(0.0, float(src_offset))),
        "-i",
        src_path,
        "-f",
        "lavfi",
        "-i",
        f"anullsrc=r=44100:cl=stereo:d={seg}",
        "-t",
        str(seg),
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-preset",
        "fast",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        out_path,
    ]
    _run(cmd)
    return out_path


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
