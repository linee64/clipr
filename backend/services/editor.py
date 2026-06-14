import json
import os
import shutil
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

# Bundled .ttf/.otf fonts (e.g. high-contrast serif + calligraphy script for the
# "I don't care" reference look). Staged next to the .ass at burn time and made
# visible to libass via the ass filter's fontsdir, so a template can use a font
# that isn't installed on the host (local Windows OR the Linux render box).
ASSETS_FONTS_DIR = BACKEND_DIR / "assets" / "fonts"


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


def measure_brightness(path: str) -> float:
    """Average luma (YAVG, 0-255) of a clip via signalstats — used to normalize
    exposure before a moody grade so already-dark footage isn't crushed to black.
    Returns a neutral 60.0 when measurement fails."""
    import re

    try:
        res = _run(
            ["ffmpeg", "-i", path, "-vf", "fps=2,signalstats,metadata=print",
             "-an", "-f", "null", "-"],
            text=True,
        )
        text = (res.stderr or "") + (res.stdout or "")
        vals = [float(x) for x in re.findall(r"signalstats\.YAVG=([\d.]+)", text)]
        return round(sum(vals) / len(vals), 1) if vals else 60.0
    except Exception:
        return 60.0


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
    video_path: str, audio_path: str, output_path: str, volume: float = 0.6,
    start_offset: float = 0.0,
):
    """Replace video audio with background music only — source clip audio is discarded.

    start_offset > 0 seeks into the track first, so the video opens on the hook/drop
    (the viral part) instead of the intro; the track still loops to cover the video.
    """
    vol = max(0.05, min(float(volume), 2.0))
    seek = ["-ss", f"{max(0.0, float(start_offset)):.2f}"] if float(start_offset) > 0.01 else []
    # Small music fade-in at the start and fade-out at the very end of the video so
    # the track doesn't cut off abruptly.
    afilter = f"[1:a]volume={vol}"
    dur = get_duration(video_path)
    if dur and dur > 1.5:
        afilter += f",afade=t=in:st=0:d=0.4,afade=t=out:st={max(0.0, dur - 0.9):.2f}:d=0.9"
    afilter += "[aout]"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        # loop the music so a track shorter than the montage can't truncate it;
        # -shortest below then ends the output exactly at the video length
        "-stream_loop",
        "-1",
        *seek,
        "-i",
        audio_path,
        "-filter_complex",
        afilter,
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
        "Outline": "0",
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
        "Outline": "0",
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
        "Outline": "0",
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
        "Outline": "0",
        "Shadow": "1",
        "Alignment": "5",
        "MarginV": "0",
    },
    # --- "Locked in" reference look: bold lowercase white sans, centered, no mint ---
    # Heavy wide grotesque (Arial Black) over the dark gradient cards and graded
    # footage. Bold=0 because the face already supplies the weight.
    "card_phrase": {
        "Name": "Default",
        "Fontname": "Arial Black",
        "Fontsize": "84",
        "PrimaryColour": "&H00FFFFFF",
        "SecondaryColour": "&H00FFFFFF",
        "OutlineColour": "&H00000000",
        "BackColour": "&H00000000",
        "Bold": "0",
        "Italic": "0",
        "Outline": "0",
        "Shadow": "1",
        "Alignment": "5",
        "MarginV": "0",
    },
    # Same face, BLACK text — for the light film-grain cards (the dark/light flip).
    "card_phrase_light": {
        "Name": "Default",
        "Fontname": "Arial Black",
        "Fontsize": "84",
        "PrimaryColour": "&H00000000",
        "SecondaryColour": "&H00000000",
        "OutlineColour": "&H00FFFFFF",
        "BackColour": "&H00FFFFFF",
        "Bold": "0",
        "Italic": "0",
        "Outline": "0",
        "Shadow": "0",
        "Alignment": "5",
        "MarginV": "0",
    },
    # The single serif moment — small upright Georgia, the elegant opener line.
    "intro_serif": {
        "Name": "Default",
        "Fontname": "Georgia",
        "Fontsize": "80",
        "PrimaryColour": "&H00FFFFFF",
        "SecondaryColour": "&H00FFFFFF",
        "OutlineColour": "&H00000000",
        "BackColour": "&H00000000",
        "Bold": "0",
        "Italic": "0",
        "Outline": "0",
        "Shadow": "1",
        "Alignment": "5",
        "MarginV": "0",
    },
    # Base style for kinetic captions — per-Dialogue \\pos/\\fn/\\c/\\fs overrides do
    # the real work; this just sets sane defaults + outline for legibility over footage.
    "kinetic": {
        "Name": "Default",
        "Fontname": "Arial Black",
        "Fontsize": "150",
        "PrimaryColour": "&H00FFFFFF",
        "SecondaryColour": "&H00FFFFFF",
        "OutlineColour": "&H00000000",
        "BackColour": "&H00000000",
        "Bold": "0",
        "Italic": "0",
        "Outline": "0",
        "Shadow": "1",
        "Alignment": "5",
        "MarginV": "0",
    },
}

# Mint accent (#10B981) written as ASS &HBBGGRR for the currently-spoken word.
KARAOKE_ACTIVE_COLOR = "&H81B910&"

# --- Kinetic captions ("Break the pattern" reference) ---------------------------
# Multi-position word chunks that build on the beat at cycling screen anchors,
# mixing big white sans emphasis words with smaller red serif accent words.
KINETIC_ACCENT_COLOR = "&H1B06CC&"  # crimson #CC061B as ASS &HBBGGRR, sampled from the type fill
# Each LAYOUT is a set of 3 mutually NON-overlapping anchors (alignment, x_frac,
# y_frac) — the words are well separated vertically so they never collide. Scenes
# alternate between layouts for variety: a centered vertical stack, then a
# corners+center spread (mirrors the reference's two looks). Within a scene chunk j
# lands at layout[j % 3]; a 3-slot sliding window clears older chunks so at most 3
# are on screen at once.
KINETIC_LAYOUTS = [
    [(8, 0.50, 0.27), (5, 0.50, 0.49), (2, 0.50, 0.73)],   # vertical stack (pulled toward center)
    [(7, 0.16, 0.29), (5, 0.50, 0.49), (3, 0.84, 0.71)],   # corners + center
]
# Articles / connectives / prepositions render as red serif accents; the rest are
# white sans emphasis words.
_KINETIC_ACCENT_WORDS = {
    "the", "a", "an", "or", "and", "but", "of", "to", "in", "on", "for",
    "will", "is", "be", "your", "my", "it", "if", "so", "than", "then",
}


def _ass_time(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds % 1) * 100))
    if cs >= 100:  # rounding can push .995 -> 100; clamp so the field stays 2 digits
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _overrides_from_preset(preset: dict | None) -> dict | None:
    """Map a caption preset (from services.templates) to ASS style overrides."""
    if not preset:
        return None
    o: dict = {"Italic": "1" if preset.get("italic") else "0"}
    if preset.get("font"):
        o["Fontname"] = preset["font"]
    if preset.get("fontsize"):
        o["Fontsize"] = str(int(preset["fontsize"]))
    if preset.get("alignment") is not None:
        o["Alignment"] = str(preset["alignment"])
    if preset.get("outline") is not None:
        o["Outline"] = str(preset["outline"])
    if preset.get("marginv") is not None:
        o["MarginV"] = str(preset["marginv"])
    if preset.get("bold") is not None:
        o["Bold"] = str(int(preset["bold"]))
    if preset.get("shadow") is not None:
        o["Shadow"] = str(int(preset["shadow"]))
    return o


def _ass_style_line(style: str, overrides: dict | None = None) -> str:
    chosen = dict(ASS_STYLES.get(style, ASS_STYLES["tiktok_bold"]))
    if overrides:
        for k, v in overrides.items():
            if v is not None and v != "":
                chosen[k] = str(v)
    return (
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


def _write_ass_header(
    f, style: str, play_w: int = 1080, play_h: int = 1920, overrides: dict | None = None
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
    f.write(_ass_style_line(style, overrides) + "\n\n")
    f.write("[Events]\n")
    f.write(
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )


def _italicize_words(text: str, italic_words: set) -> str:
    """Wrap each word whose lowercased, punctuation-stripped form is in italic_words
    in an ASS italic run {\\i1}word{\\r}, preserving \\N line breaks."""
    out_lines = []
    for line in text.split("\\N"):
        toks = []
        for wrd in line.split(" "):
            key = wrd.strip(",.!?;:'\"“”‘’").lower()
            toks.append(f"{{\\i1}}{wrd}{{\\r}}" if key and key in italic_words else wrd)
        out_lines.append(" ".join(toks))
    return "\\N".join(out_lines)


def _chunk_segment(seg: dict, n: int) -> list[dict]:
    """Split one held caption into chunks of <= n words, spread evenly across the
    segment's time span — so fewer words show at once (the reference's one/two-word
    punch). n<=0 returns the segment unchanged."""
    words = str(seg.get("text", "")).split()
    if n <= 0 or len(words) <= n:
        return [seg]
    groups = [words[i:i + n] for i in range(0, len(words), n)]
    start, end = float(seg["start"]), float(seg["end"])
    step = max(0.1, (end - start) / len(groups))
    return [
        {"start": start + i * step, "end": start + (i + 1) * step, "text": " ".join(g)}
        for i, g in enumerate(groups)
    ]


def generate_ass_simple(
    segments: list,
    output_path: str,
    style: str = "tiktok_bold",
    resolution: str = "1080:1920",
    preset: dict | None = None,
    fontcycle=None,
    fontcycle_dur=None,
):
    """
    Generate .ass subtitle file with advanced styling.

    style options:
    - tiktok_bold: large bold white text, black outline, bottom center
    - plaque: white text on dark semi-transparent background plaque
    - center_caps: uppercase, center screen, thick outline, aggressive

    preset (from services.templates.caption_preset_of) overrides font/size/position/
    case so each template gets its own caption look.
    """
    try:
        play_w, play_h = (int(float(x)) for x in resolution.split(":"))
    except (ValueError, TypeError):
        play_w, play_h = 1080, 1920
    overrides = _overrides_from_preset(preset)
    upper = bool(preset and preset.get("uppercase")) or style == "center_caps"
    # Optional per-phrase fade-in/out pop (the reference's text appears with a quick
    # fade). preset["fade_ms"] = [in_ms, out_ms]; absent -> no fade (unchanged).
    fade = ""
    if preset and preset.get("fade_ms"):
        try:
            fin, fout = (int(x) for x in preset["fade_ms"][:2])
            fade = f"{{\\fad({fin},{fout})}}"
        except (TypeError, ValueError, IndexError):
            fade = ""
    # Optional letter-spacing/tracking (the tracked-caps statement look) via \fsp.
    sp = ""
    lsp = (preset or {}).get("letter_spacing")
    if lsp:
        sp = f"{{\\fsp{float(lsp):g}}}"
    # Optional glyph stretch via \fscx (wider) / \fscy (taller) — default 100.
    scale_tag = ""
    if (preset or {}).get("scale_x"):
        scale_tag += f"\\fscx{int(float(preset['scale_x']))}"
    if (preset or {}).get("scale_y"):
        scale_tag += f"\\fscy{int(float(preset['scale_y']))}"
    sx = f"{{{scale_tag}}}" if scale_tag else ""
    # Optional: show fewer words at a time by splitting each held phrase into
    # n-word timed chunks (the reference's one/two-word punch).
    chunk_n = int((preset or {}).get("chunk_words") or 0)
    # Optional: gently break the phrase onto new lines every n words.
    wrap_n = int((preset or {}).get("wrap_words") or 0)
    # Optional per-word italic accents (editorial serif look): words in this set are
    # wrapped in {\i1}word{\r} while the rest stay upright.
    italic_words = set((preset or {}).get("italic_words") or [])
    # Optional intros (applied before the normal captions on the first segment):
    #  - intro_text: a fixed word that reveals left-to-right then fades out.
    #  - fontcycle_intro: flip the first phrase rapidly through many fonts, then settle.
    intro_text = (preset or {}).get("intro_text")
    intro_dur = float((preset or {}).get("intro_dur") or 1.0)
    cycle_fonts = fontcycle or (preset or {}).get("fontcycle_intro")
    _CYCLE_FONTS = ["Arial Black", "Impact", "Georgia", "Verdana", "Trebuchet MS",
                    "Comic Sans MS", "Times New Roman", "Courier New"]
    with open(output_path, "w", encoding="utf-8") as f:
        _write_ass_header(f, style, play_w, play_h, overrides)
        clamp_start = 0.0
        if intro_text and segments:
            cx, cy = play_w // 2, play_h // 2
            itxt = intro_text.upper() if upper else intro_text
            rev = max(150, int(intro_dur * 450))  # left-to-right reveal time (ms)
            f.write(
                f"Dialogue: 0,{_ass_time(0.0)},{_ass_time(intro_dur)},Default,,0,0,0,,"
                f"{{\\an5\\pos({cx},{cy})\\clip(0,0,0,{play_h})"
                f"\\t(0,{rev},\\clip(0,0,{play_w},{play_h}))\\fad(0,200)}}{itxt}\n"
            )
            clamp_start = intro_dur
        if cycle_fonts and segments:
            seg0 = segments[0]
            t0 = max(float(seg0["start"]), clamp_start)
            cyc = cycle_fonts if isinstance(cycle_fonts, list) else _CYCLE_FONTS
            avail = float(seg0["end"]) - t0
            # How long the font-flipping effect runs. Default: a quick ~0.4-0.8s
            # flicker. A template/card can request a longer, more deliberate cycle
            # (fontcycle_dur), clamped to the time the segment is actually on screen.
            fc_dur = fontcycle_dur if fontcycle_dur is not None else (preset or {}).get("fontcycle_dur")
            if fc_dur:
                cdur = max(0.2, min(float(fc_dur), avail))
            else:
                cdur = min(0.8, max(0.4, avail * 0.5))
            # Keep each font visible for a snappy ~0.14s and repeat the font list as
            # needed to fill the whole cycle, so a longer cycle stays lively instead
            # of just holding each font longer.
            n_slices = max(len(cyc), round(cdur / 0.14))
            step = cdur / n_slices
            # strip any embedded override block (e.g. a \fad longer than a cycle slice
            # would keep the text invisible) so each font flashes fully opaque
            import re as _re
            txt0 = _re.sub(r"\{[^}]*\}", "", str(seg0["text"])).strip()
            if upper:
                txt0 = txt0.upper()
            for i in range(n_slices):
                fn = cyc[i % len(cyc)]
                f.write(
                    f"Dialogue: 0,{_ass_time(t0 + i * step)},{_ass_time(t0 + (i + 1) * step)},"
                    f"Default,,0,0,0,,{{\\fn{fn}}}{sx}{sp}{txt0}\n"
                )
            clamp_start = t0 + cdur
        for si, seg in enumerate(segments):
            if si == 0 and clamp_start > float(seg["start"]):
                seg = {**seg, "start": min(clamp_start, float(seg["end"]) - 0.1)}
            for part in (_chunk_segment(seg, chunk_n) if chunk_n else [seg]):
                text = str(part["text"]).strip()
                if upper:
                    text = text.upper()
                if wrap_n:
                    words = text.split()
                    if len(words) > wrap_n:
                        text = "\\N".join(
                            " ".join(words[i:i + wrap_n]) for i in range(0, len(words), wrap_n)
                        )
                if italic_words:
                    text = _italicize_words(text, italic_words)
                f.write(
                    f"Dialogue: 0,{_ass_time(part['start'])},{_ass_time(part['end'])},"
                    f"Default,,0,0,0,,{fade}{sx}{sp}{text}\n"
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


def _render_cumulative(
    lines_struct, visible: int, active: int, upper: bool = False, emph: str = "",
    active_col: str = KARAOKE_ACTIVE_COLOR,
) -> str:
    """Render the first `visible` words across wrapped lines. The `active` (newest)
    word is drawn in `active_col` (mint by default; a template can force white for an
    all-white build) and, when `emph` is set, in a second font. `\\r` resets back to
    the base style for anything after it."""
    out_lines: list[str] = []
    gi = 0
    for line in lines_struct:
        toks: list[str] = []
        for w in line:
            if gi < visible:
                ww = w.upper() if upper else w
                if gi == active:
                    fn = f"\\fn{emph}" if emph else ""
                    toks.append(f"{{{fn}\\c{active_col}}}{ww}{{\\r}}")
                else:
                    toks.append(ww)
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
    preset: dict | None = None,
):
    """Write an .ass where each scene's phrase reveals word-by-word, in time with
    the beat, the newest word highlighted in mint — a montage caption look.

    preset (from services.templates.caption_preset_of) sets the per-template font,
    size, position, case, and an emphasis font for the active word.
    """
    try:
        play_w, play_h = (int(float(x)) for x in resolution.split(":"))
    except (ValueError, TypeError):
        play_w, play_h = 1080, 1920

    overrides = _overrides_from_preset(preset)
    upper = bool(preset and preset.get("uppercase"))
    emph = (preset or {}).get("emphasis_font") or ""
    # A template can force the active word to a custom colour (e.g. white for an
    # all-white build instead of the mint highlight) and add a per-word fade-in pop.
    active_col = (preset or {}).get("active_color") or KARAOKE_ACTIVE_COLOR
    fade = ""
    if preset and preset.get("fade_ms"):
        try:
            fin, fout = (int(x) for x in preset["fade_ms"][:2])
            fade = f"{{\\fad({fin},{fout})}}"
        except (TypeError, ValueError, IndexError):
            fade = ""

    beats = sorted(b for b in (beat_times or []) if b is not None and b >= 0)
    with open(output_path, "w", encoding="utf-8") as f:
        _write_ass_header(f, style, play_w, play_h, overrides)
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
                text = _render_cumulative(
                    lines_struct, visible=j + 1, active=j, upper=upper, emph=emph,
                    active_col=active_col,
                )
                f.write(
                    f"Dialogue: 0,{_ass_time(seg_start)},{_ass_time(seg_end)},"
                    f"Default,,0,0,0,,{fade}{text}\n"
                )


def _kinetic_chunks(words: list[str], accent_set: set) -> list[list[tuple]]:
    """Group a leading accent word (article/connective) with the following content
    word into one on-screen chunk ("The"+"Pattern"); standalone/trailing accent
    words stand alone. Each chunk is a list of (word, is_accent)."""
    def is_accent(w: str) -> bool:
        return w.strip(",.!?;:’'\"").lower() in accent_set

    chunks: list[list[tuple]] = []
    i, n = 0, len(words)
    while i < n:
        w = words[i]
        if is_accent(w) and i + 1 < n and not is_accent(words[i + 1]):
            chunks.append([(w, True), (words[i + 1], False)])
            i += 2
        else:
            chunks.append([(w, is_accent(w))])
            i += 1
    return chunks


def _kinetic_chunk_text(
    chunk: list[tuple], sans_font: str, serif_font: str, accent_col: str,
    base_size: int, accent_size: int, upper_emph: bool,
) -> str:
    """Render one chunk: accent words as small red serif italic, content words as
    big white sans (uppercased when upper_emph). \\r resets to the base style."""
    runs = []
    for word, is_accent in chunk:
        if is_accent:
            runs.append(
                f"{{\\fn{serif_font}\\i1\\b0\\fs{accent_size}\\bord0\\shad1"
                f"\\c{accent_col}}}{word}{{\\r}}"
            )
        else:
            w = word.upper() if upper_emph else word
            runs.append(
                f"{{\\fn{sans_font}\\i0\\b0\\fs{base_size}\\bord0\\shad1"
                f"\\c&H00FFFFFF&}}{w}{{\\r}}"
            )
    return " ".join(runs)


def _kinetic_chunk_times(
    start: float, end: float, n: int, beats: list[float], min_gap: float = 0.2
) -> list[float]:
    """Reveal chunk j on the beats right after the scene start (a punchy, beat-synced
    build that holds once shown) — not spread across the whole scene, which made later
    words appear late and feel laggy.

    ``min_gap`` is the minimum spacing between consecutive reveals: 0.2 (default) lands
    on every beat; a larger value (e.g. 0.9) skips to a later beat so each word holds
    longer — still ON a beat, just a calmer cadence (used to slow the opening build)."""
    if n <= 1:
        return [start]
    bs = sorted(b for b in (beats or []) if b is not None and b > start + 0.12)
    times = [start]
    bi = 0
    for _ in range(1, n):
        prev = times[-1]
        nxt = None
        while bi < len(bs):
            if bs[bi] >= prev + min_gap:
                nxt = bs[bi]
                bi += 1
                break
            bi += 1
        if nxt is None:
            nxt = prev + max(0.42, min_gap)  # ran out of beats -> steady fallback gap
        nxt = min(nxt, end - 0.12)
        nxt = max(nxt, prev + 0.12)  # strictly increasing, min readable gap
        times.append(nxt)
    return times


def _write_kinetic_groups(
    f, phrase: str, start: float, end: float, beats: list[float], group_size: int,
    play_w: int, play_h: int, sans_font: str, serif_font: str, accent_col: str,
    base_size: int, accent_size: int, upper_emph: bool, fin: int, fout: int,
) -> None:
    """Render one scene as centered word-stacks (the "groups" kinetic look): the phrase
    is split into groups of ``group_size``; within each group the first 3 words are big
    white sans (one per line) and any trailing word is small red serif. Words pop in ONE
    BY ONE on consecutive beats — each holds at its fixed line as the stack builds — and
    the whole group clears when the next group's first word appears. Mirrors the
    "3 words + a red 4th" reference treatment with a sequential build (not all at once)."""
    words = phrase.split()
    if not words:
        return
    groups = [words[i:i + group_size] for i in range(0, len(words), group_size)]
    # One reveal time per WORD (consecutive beats) so words appear sequentially.
    wtimes = _kinetic_chunk_times(start, end, len(words), beats)
    cx = play_w // 2
    step = max(1, int(round(base_size * 1.15)))  # vertical gap between stacked lines
    gidx = 0  # running global word index into wtimes
    for gi, group in enumerate(groups):
        m = len(group)
        # the group holds until its last word's slot ends: the next group's first word
        # (or the scene end for the final group) — so the stack clears as a unit.
        next_global = gidx + m
        group_end = wtimes[next_global] if next_global < len(words) else end
        top = (play_h // 2) - (m - 1) * step // 2  # center the m-line stack
        last_group = gi == len(groups) - 1
        for lj, word in enumerate(group):
            seg_start = wtimes[gidx + lj]
            # Very short scene + many words can push a word's beat past the scene end
            # (consecutive-beat spacing overruns); drop it rather than emit an inverted
            # interval, and guarantee seg_end > seg_start for the words that do fit.
            if seg_start >= end - 0.05:
                continue
            seg_end = group_end
            if seg_end <= seg_start:
                seg_end = min(end, seg_start + 0.2)
            y = top + lj * step
            if lj >= 3:  # the 4th (overflow) word -> small red serif
                style = (
                    f"\\fn{serif_font}\\i1\\b0\\fs{accent_size}\\bord0\\shad1\\c{accent_col}"
                )
                shown = word
            else:  # up to 3 big white emphasis words, one per line
                style = (
                    f"\\fn{sans_font}\\i0\\b1\\fs{base_size}\\bord0\\shad1\\c&H00FFFFFF&"
                )
                shown = word.upper() if upper_emph else word
            fout_w = fout if last_group else 0  # only the final group fades out
            f.write(
                f"Dialogue: 0,{_ass_time(seg_start)},{_ass_time(seg_end)},"
                f"Default,,0,0,0,,"
                f"{{\\an5\\pos({cx},{y})\\fad({fin},{fout_w}){style}}}{shown}\n"
            )
        gidx += m


def _stack_accent_key(word: str) -> str:
    return word.strip(",.!?;:’'\"“”‘’«»…—-").lower()


def _write_kinetic_stack(
    f, phrase: str, start: float, end: float, beats: list[float],
    play_w: int, play_h: int, main_font: str, script_font: str, accent_col: str,
    base_size: int, accent_size: int, accent_set: set, wrap_words: int,
    max_chars: int, upper_emph: bool, fin: int, fout: int, reveal_gap: float = 0.2,
    body_bold: bool = False,
) -> None:
    """Render one scene as a CENTRED, build-and-hold caption (the "I don't care"
    reference look): the phrase wraps into short, frame-fitting lines that reveal
    one-by-one on CONSECUTIVE beats and HOLD — accumulating into a vertically- and
    horizontally-centred block — then fade together as the next phrase begins.
    Designated accent words render in a flowing script face; the rest in a
    high-contrast serif (both white).

    Two robustness points: lines wrap by character budget (so long words — e.g.
    Russian — stay on-frame and centred), and if NO word matches the accent set
    (e.g. a non-English phrase), the final word still gets the script face so the
    two-font look never collapses to a single font."""
    words = phrase.split()
    if not words:
        return
    # Which word indices use the script face. Curated accent words win; if none match
    # (e.g. the phrase is in Russian and the list is English), fall back to the last
    # word so a script accent is always present.
    accent_idx = {
        i for i, w in enumerate(words)
        if _stack_accent_key(w) and _stack_accent_key(w) in accent_set
    }
    if not accent_idx and len(words) > 1:
        accent_idx = {len(words) - 1}
    # Wrap to centred lines that fit the frame width (≤ max_chars or wrap_words each).
    lines = _wrap_words(words, max_chars=max_chars, max_words_per_line=max(1, int(wrap_words)))
    ltimes = _kinetic_chunk_times(start, end, len(lines), beats, min_gap=reveal_gap)
    step = max(1, int(round(base_size * 1.16)))            # gap between stacked lines
    top = max(step // 2, (play_h - step * len(lines)) // 2)  # vertically centre block
    cx = play_w // 2
    gi = 0  # running word index across the flattened lines (matches `words` order)
    for i, line in enumerate(lines):
        seg_start = ltimes[i]
        if seg_start >= end - 0.05:  # a beat that overruns the scene -> drop the line
            gi += len(line)
            continue
        y = top + i * step
        runs = []
        for word in line:
            if gi in accent_idx:  # flowing script accent word
                runs.append(
                    f"{{\\fn{script_font}\\i0\\b0\\fs{accent_size}\\bord0\\shad1"
                    f"\\c{accent_col}}}{word}{{\\r}}"
                )
            else:  # high-contrast serif body word
                shown = word.upper() if upper_emph else word
                runs.append(
                    f"{{\\fn{main_font}\\i0\\b{1 if body_bold else 0}\\fs{base_size}"
                    f"\\bord0\\shad1\\c&H00FFFFFF&}}{shown}{{\\r}}"
                )
            gi += 1
        # Each line holds to the scene end so the block accumulates; the whole stack
        # fades out together over the last `fout` ms as the next phrase takes over.
        f.write(
            f"Dialogue: 0,{_ass_time(seg_start)},{_ass_time(end)},"
            f"Default,,0,0,0,,"
            f"{{\\an8\\pos({cx},{y})\\fad({fin},{fout})}}{' '.join(runs)}\n"
        )


def generate_ass_kinetic(
    scenes_timed: list,
    beat_times: list,
    output_path: str,
    resolution: str = "1080:1920",
    preset: dict | None = None,
):
    """Kinetic multi-position captions (the "Break the pattern" reference look):
    each scene's phrase is split into chunks that appear on consecutive beats at
    NON-overlapping anchors (alternating layout per scene), mixing big white sans
    emphasis words with smaller red serif accents. A 3-slot sliding window clears
    older chunks so at most 3 are on screen at once (no stacking/overlap).

    preset keys (from caption_preset_of): sans_font, serif_font, accent_color,
    fontsize (base sans size), accent_size, layouts, accent_words, uppercase_emphasis,
    fade_ms."""
    try:
        play_w, play_h = (int(float(x)) for x in resolution.split(":"))
    except (ValueError, TypeError):
        play_w, play_h = 1080, 1920

    p = preset or {}
    sans_font = p.get("sans_font") or "Arial Black"
    serif_font = p.get("serif_font") or "Georgia"
    accent_col = p.get("accent_color") or KINETIC_ACCENT_COLOR
    base_size = int(p.get("fontsize") or 150)
    accent_size = int(p.get("accent_size") or round(base_size * 0.64))
    layouts = p.get("layouts") or KINETIC_LAYOUTS
    accent_set = set(p.get("accent_words") or _KINETIC_ACCENT_WORDS)
    upper_emph = bool(p.get("uppercase_emphasis", True))
    # "Groups" mode (caption_kinetic_groups = N): instead of article-accented chunks at
    # scattered anchors, show the phrase as centered stacks of up to N words — the first
    # 3 big white (one per line), the 4th small red — one group popping in per beat.
    # 0/absent keeps the classic sliding-window chunk behaviour (other kinetic uses).
    group_size = int(p.get("kinetic_groups") or 0)
    # "Stack" mode (caption_stack = true): the phrase wraps into short lines that
    # reveal on consecutive beats and HOLD as a vertically-centred left block, with
    # accent words in a script face (the "I don't care" editorial-serif look). Other
    # kinetic modes (chunks / groups) are untouched when this is off.
    stack_mode = bool(p.get("kinetic_stack"))
    stack_wrap = max(1, int(p.get("stack_wrap") or 2))
    stack_maxchars = max(6, int(p.get("stack_maxchars") or 16))
    # Opening cadence: scenes that START before `stack_open_until` reveal each line
    # with at least `stack_open_gap` between them (slower, holds each word longer);
    # later scenes keep the default snappy every-beat build.
    stack_open_gap = float(p.get("stack_open_gap") or 0.0)
    stack_open_until = float(p.get("stack_open_until") or 0.0)
    stack_bold = bool(p.get("stack_bold"))  # bold weight on the body (serif) font only
    try:
        fin, fout = (int(x) for x in (p.get("fade_ms") or (120, 0))[:2])
    except (TypeError, ValueError, IndexError):
        fin, fout = 120, 0

    beats = sorted(b for b in (beat_times or []) if b is not None and b >= 0)
    with open(output_path, "w", encoding="utf-8") as f:
        _write_ass_header(f, "kinetic", play_w, play_h, _overrides_from_preset(preset))
        for si, scene in enumerate(scenes_timed):
            phrase = str(scene.get("phrase", "")).strip()
            if not phrase:
                continue
            start = float(scene.get("start_time", 0.0))
            dur = max(0.3, float(scene.get("duration_seconds", 3.0)))
            end = start + dur
            if stack_mode:
                reveal_gap = (
                    stack_open_gap
                    if (stack_open_gap > 0 and start < stack_open_until)
                    else 0.2
                )
                _write_kinetic_stack(
                    f, phrase, start, end, beats, play_w, play_h,
                    sans_font, serif_font, accent_col, base_size, accent_size,
                    accent_set, stack_wrap, stack_maxchars, upper_emph, fin, fout,
                    reveal_gap, stack_bold,
                )
                continue
            if group_size > 0:
                _write_kinetic_groups(
                    f, phrase, start, end, beats, group_size, play_w, play_h,
                    sans_font, serif_font, accent_col, base_size, accent_size,
                    upper_emph, fin, fout,
                )
                continue
            chunks = _kinetic_chunks(phrase.split(), accent_set)
            if not chunks:
                continue
            layout = layouts[si % len(layouts)]
            slots = len(layout)
            times = _kinetic_chunk_times(start, end, len(chunks), beats)
            for j, chunk in enumerate(chunks):
                seg_start = times[j]
                # A chunk clears when the next chunk reusing its slot appears, so at
                # most `slots` chunks are visible at once (no overlap when cycling).
                seg_end = times[j + slots] if j + slots < len(chunks) else end
                if seg_end <= seg_start:
                    seg_end = min(end, seg_start + 0.2)
                an, xf, yf = layout[j % slots]
                x, y = int(play_w * xf), int(play_h * yf)
                # only the chunks that survive to the cut fade out; cleared ones hard-cut
                fout_j = fout if j + slots >= len(chunks) else 0
                text = _kinetic_chunk_text(
                    chunk, sans_font, serif_font, accent_col,
                    base_size, accent_size, upper_emph,
                )
                f.write(
                    f"Dialogue: 0,{_ass_time(seg_start)},{_ass_time(seg_end)},"
                    f"Default,,0,0,0,,"
                    f"{{\\an{an}\\pos({x},{y})\\fad({fin},{fout_j})}}{text}\n"
                )


def apply_end_fade(
    input_path: str,
    output_path: str,
    fade_dur: float = 1.0,
    color: str = "black",
) -> str:
    """Fade the picture to ``color`` over the last ``fade_dur`` seconds — a darkening
    outro as the video ends. Audio is left as-is (it already gets its own fade-out in
    add_background_audio_only), so we copy the audio stream and only re-encode video.
    """
    dur = get_duration(input_path)
    fd = max(0.1, min(float(fade_dur), max(0.1, dur)))
    st = max(0.0, dur - fd)
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", f"fade=t=out:st={st:.3f}:d={fd:.3f}:color={color}",
        "-c:v", "libx264", "-preset", "fast", "-c:a", "copy",
        output_path,
    ]
    _run(cmd)
    return output_path


def _stage_bundled_fonts(work_dir: str) -> bool:
    """Copy bundled fonts (ASSETS_FONTS_DIR) into ``work_dir`` so libass can find
    them via the ass filter's ``fontsdir=.`` (the filter runs with cwd=work_dir).

    Returns True if at least one font was staged. Using a relative ``.`` fontsdir
    sidesteps Windows filtergraph escaping of an absolute path's drive colon.
    """
    try:
        if not ASSETS_FONTS_DIR.is_dir():
            return False
        staged = False
        for font in ASSETS_FONTS_DIR.iterdir():
            if font.suffix.lower() not in (".ttf", ".otf", ".ttc"):
                continue
            dest = os.path.join(work_dir, font.name)
            if not os.path.exists(dest):
                shutil.copy2(font, dest)
            staged = True
        return staged
    except OSError:
        return False


def burn_subtitles_ass(
    video_path: str,
    ass_path: str,
    output_path: str,
    blend_mode: str | None = None,
    blend_opacity: float = 0.85,
    use_bundled_fonts: bool = False,
) -> str:
    """Burn .ass subtitles into video using FFmpeg.

    blend_mode (e.g. "difference") renders the caption as WHITE text on a black
    canvas and composites it onto the video with ffmpeg's blend filter, so the text
    inverts/shifts the colours behind it (a frosted "glass" caption: light over dark
    areas, dark over bright areas). None = the normal opaque `over` burn (unchanged).
    blend_opacity (<1) lets some of the original show through for a translucent feel.

    use_bundled_fonts stages backend/assets/fonts into the work dir and points
    libass at it (``fontsdir=.``) so a template can render with a bundled face that
    isn't installed on the host. Default False keeps the command byte-identical for
    every existing caller/template.
    """
    work_dir = os.path.dirname(os.path.abspath(ass_path))
    vbase = os.path.basename(video_path)
    abase = os.path.basename(ass_path)
    obase = os.path.basename(output_path)
    ass_opt = abase
    if use_bundled_fonts and _stage_bundled_fonts(work_dir):
        ass_opt = f"{abase}:fontsdir=."
    if blend_mode:
        op = max(0.1, min(1.0, float(blend_opacity)))
        # The blend MUST run in RGB: in YUV a black canvas has chroma 128, so
        # `difference` would corrupt the U/V planes and tint the whole frame.
        fc = (
            f"[0:v]split=2[v0][v1];"
            f"[v1]drawbox=color=black:t=fill[blk];"
            f"[blk]ass={ass_opt}[txt];"
            f"[v0]format=gbrp[v0f];"
            f"[txt]format=gbrp[txtf];"
            f"[v0f][txtf]blend=all_mode={blend_mode}:all_opacity={op:g},format=yuv420p[vout]"
        )
        cmd = [
            "ffmpeg", "-y", "-i", vbase,
            "-filter_complex", fc,
            "-map", "[vout]", "-map", "0:a?",
            "-c:a", "copy", obase,
        ]
    else:
        cmd = ["ffmpeg", "-y", "-i", vbase, "-vf", f"ass={ass_opt}", "-c:a", "copy", obase]
    cmd = [_tool(cmd[0])] + cmd[1:]
    try:
        subprocess.run(cmd, check=True, capture_output=True, cwd=work_dir)
    except FileNotFoundError as e:
        raise RuntimeError(_FFMPEG_HINT) from e
    return output_path


def _card_bg_command(bg: str, w: int, h: int, fps: int, dur: float, out_path: str) -> list[str]:
    """ffmpeg command for a footage-less 'text card' background. Stream params
    (1080x1920, SAR 1, fps, yuv420p, stereo aac 44100) match extract_montage_cut
    so cards concatenate with montage cuts with no re-encode mismatch."""
    if bg == "light_grain":
        # bright neutral gray + heavy film grain + faint vignette (the light cards).
        # Heavier grain so the texture survives x264 (alls=14 was smoothed away).
        src = ["-f", "lavfi", "-i", f"color=c=0x969696:s={w}x{h}"]
        vf = f"format=gray,noise=alls=22:allf=t+u,vignette=PI/6,setsar=1,fps={fps},format=yuv420p"
    else:
        # dark_gradient: a broad soft charcoal wash — mid-gray base darkened by an
        # off-center vignette so the bright lobe sits upper-center-left and fades to
        # near-black on the right and bottom (matches the reference's broad falloff).
        # A `gradients` radial made a tight spotlight; color + vignette gives the
        # broad soft fill and scales cleanly to any resolution.
        x0, y0 = int(w * 0.30), int(h * 0.32)
        src = ["-f", "lavfi", "-i", f"color=c=0x4d4d4d:s={w}x{h}"]
        vf = (
            f"format=gray,noise=alls=12:allf=t+u,"
            f"vignette=a=PI/3.6:x0={x0}:y0={y0},setsar=1,fps={fps},format=yuv420p"
        )
    return [
        "ffmpeg", "-y", *src,
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", vf, "-t", f"{max(0.3, float(dur)):.3f}",
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-c:a", "aac",
        "-pix_fmt", "yuv420p", "-shortest", out_path,
    ]


def _ensure_card_mask(w: int, h: int, radius: int) -> str:
    """A cached grayscale rounded-rectangle alpha mask (white rounded-rect on black)
    for the card-frame fit. Generated once per (w,h,radius) with Pillow."""
    path = os.path.join(TEMP_DIR, f"_cardmask_{w}x{h}_r{radius}.png")
    if not os.path.isfile(path):
        try:
            from PIL import Image, ImageDraw
        except ImportError as e:
            raise RuntimeError("Pillow is required for the card_frame fit (pip install pillow)") from e
        m = Image.new("L", (w, h), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
        m.save(path)
    return path


def render_text_card(
    out_path: str,
    duration: float,
    text: str,
    bg: str = "dark_gradient",
    style: str = "card_phrase",
    resolution: str = "1080:1920",
    fps: int = 30,
    fade_ms: tuple = (120, 80),
    fontcycle=None,
    fontcycle_dur=None,
) -> str:
    """Render one 'text card' — a generated dark-gradient (or light-grain)
    background with a single centered phrase burned in — matching the "Locked in"
    reference's intro cards. Reuses generate_ass_simple + burn_subtitles_ass."""
    try:
        w, h = (int(float(x)) for x in resolution.split(":"))
    except (ValueError, TypeError):
        w, h = 1080, 1920
    dur = max(0.3, float(duration))
    work = os.path.dirname(os.path.abspath(out_path)) or TEMP_DIR
    base = os.path.splitext(os.path.basename(out_path))[0]

    bg_path = os.path.join(work, f"{base}_bg.mp4")
    _run(_card_bg_command(bg, w, h, fps, dur, bg_path))

    phrase = (text or "").strip()
    # Wrap long phrases to ≤2-3 short centered lines so user-supplied scene text
    # can't run off-frame at the heavy card font size.
    if phrase:
        phrase = "\\N".join(
            " ".join(line) for line in _wrap_words(phrase.split(), max_chars=16)
        )
    fade = ""
    if fade_ms:
        try:
            fin, fout = (int(x) for x in tuple(fade_ms)[:2])
            fade = f"{{\\fad({fin},{fout})}}"
        except (TypeError, ValueError, IndexError):
            fade = ""
    segments = [{"start": 0.0, "end": dur, "text": f"{fade}{phrase}"}]
    ass_path = os.path.join(work, f"{base}.ass")
    generate_ass_simple(
        segments, ass_path, style, resolution, preset=None,
        fontcycle=fontcycle, fontcycle_dur=fontcycle_dur,
    )
    burn_subtitles_ass(bg_path, ass_path, out_path)
    return out_path


def detect_beats(audio_path: str) -> list[float]:
    """Analyze audio file and return timestamps (in seconds) of beat hits."""
    import librosa

    y, sr = librosa.load(audio_path, sr=None)
    _, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    return beat_times


def detect_hook_offset(audio_path: str) -> float:
    """Find the start of the track's highest-energy section (the hook/drop — the
    'viral' part), skipping the intro, snapped to a beat. Returns a seconds offset
    to seek to so the video opens on the hook instead of the quiet intro. Returns
    0.0 on any failure."""
    try:
        import librosa
        import numpy as np

        y, sr = librosa.load(audio_path, sr=None, mono=True)
        if y is None or len(y) == 0:
            return 0.0
        dur = len(y) / sr
        if dur < 8:  # too short to bother skipping an intro
            return 0.0
        hop = 512
        rms = librosa.feature.rms(y=y, hop_length=hop)[0]
        times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
        # smooth over ~2s so we pick a sustained loud section, not a single transient
        win = max(1, int(2.0 * sr / hop))
        smooth = np.convolve(rms, np.ones(win) / win, mode="same")
        # The "viral" part is usually the FIRST chorus/drop, not the loudest single
        # point (which is often a late climax/outro). So search the early-to-mid range
        # and take the first time the energy crosses into the loud band; only fall back
        # to the window max if it never gets there.
        lo = int(np.searchsorted(times, 0.10 * dur))
        hi = int(np.searchsorted(times, min(dur - 1.5, 0.60 * dur)))
        if hi <= lo:
            hi = int(np.searchsorted(times, max(0.10 * dur, dur - 1.5)))
        if hi <= lo:
            return 0.0
        thr = float(np.percentile(smooth, 80))  # "loud" level for this track
        above = smooth[lo:hi] >= thr
        idx = lo + int(np.argmax(above)) if bool(above.any()) else lo + int(np.argmax(smooth[lo:hi]))
        offset = float(times[idx])
        # snap to the nearest beat for a clean entry
        try:
            _, bf = librosa.beat.beat_track(y=y, sr=sr)
            bt = librosa.frames_to_time(bf, sr=sr)
            if len(bt):
                offset = float(min(bt, key=lambda b: abs(b - offset)))
        except Exception:
            pass
        return max(0.0, min(offset, dur - 0.5))
    except Exception:
        return 0.0


def apply_music_hook_lead(
    audio_start: float, template: dict, beat_times: list[float], is_recommended: bool
) -> float:
    """Start the music a touch before the auto-detected hook.

    Used only when the music was auto-matched to the reference (the user skipped
    picking their own track, so `is_recommended` is true) AND the template sets
    `music_hook_lead` (seconds). For some recommended tracks the energy-based hook
    detector lands mid-build instead of on the recognizable "drop" — beginning a
    few seconds earlier opens the video on the more viral moment. The result is
    re-snapped to the nearest beat at or before the detected hook for a clean entry.
    Returns audio_start unchanged when not applicable.
    """
    lead = float(template.get("music_hook_lead") or 0.0)
    if lead <= 0 or not is_recommended:
        return audio_start
    target = max(0.0, audio_start - lead)
    earlier = [b for b in beat_times if b <= audio_start + 0.01]
    return min(earlier, key=lambda b: abs(b - target)) if earlier else target


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
    min_cut: float = MONTAGE_MIN_CUT,
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
    # min_cut is the shortest allowed sub-cut; a template can lower it (below the
    # 0.45 default) for a faster, more frequent beat-cut montage.
    min_cut = max(0.15, float(min_cut or MONTAGE_MIN_CUT))
    target_cut_len = max(min_cut, float(target_cut_len or MONTAGE_TARGET_CUT))
    max_cuts = max(1, int(max_cuts or MONTAGE_MAX_CUTS))
    zooms = list(zooms) if zooms else list(MONTAGE_PUNCH_ZOOMS)

    window_len = max(min_cut, float(window_len))
    src = max(0.2, float(source_duration))
    beats = sorted(b for b in (beat_times or []) if b is not None)

    k = int(round(window_len / target_cut_len))
    max_by_len = max(1, int(window_len // min_cut))
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
            chosen - boundaries[-1] >= min_cut
            and window_len - chosen >= min_cut
        ):
            chosen = ideal
        # keep boundaries monotonic and every piece >= the minimum cut length
        if (
            chosen - boundaries[-1] >= min_cut
            and window_len - chosen >= min_cut
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
    snap_tol: float | None = None,
) -> list[tuple]:
    """Lay scenes out on the video timeline and snap each scene's END to a beat.

    The output video starts at t=0 and the music is mixed in from t=0, so a librosa
    beat at absolute time ``b`` is *heard* at output time ``b``. We therefore place
    scene boundaries directly on those absolute beat times (no re-basing): each
    scene change — the most visible cut, where the source clip swaps — then lands on
    a beat the viewer can hear, and ``plan_scene_cuts`` / ``generate_ass_karaoke``,
    which both read the same absolute beats, stay on the exact same clock.

    ``snap_tol`` caps how far a scene end may move to reach a beat. It defaults to
    ``target_cut_len`` (loose), but a template can pass a smaller value so scene
    windows stay close to their intended durations — e.g. to keep a held opener
    short instead of letting it balloon to a distant beat.

    Returns ``[(window_start, window_len), ...]`` in video time.
    """
    snap_tol = (
        max(MONTAGE_MIN_CUT, float(target_cut_len or MONTAGE_TARGET_CUT))
        if snap_tol is None else max(0.05, float(snap_tol))
    )
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


def plan_beat_cut_montage(
    clip_durations: list[float],
    beat_times: list[float],
    card_total: float,
    montage_total: float,
    zooms: list | tuple | None = None,
    every: int = 1,
    min_seg: float = 0.18,
) -> list[dict]:
    """Tile the montage span on the *heard* beats, giving each beat-slot the NEXT
    clip (cycling through the provided clips in sets) so the source CLIP swaps every
    ``every`` beats — a fast beat-cut montage where clips repeat in sets.

    The montage plays back starting at ``card_total`` (right after the intro cards),
    so cuts land on the beats that fall in [card_total, card_total + montage_total]
    and each segment's length is the gap to the next beat. Each clip keeps its own
    running read offset and advances it every time it comes back around (wrapping
    when it runs out), so a repeated clip doesn't always show the same frames.

    Returns ``[{"clip_index", "src_offset", "length", "zoom"}, ...]`` in play order.
    """
    n = len(clip_durations)
    if n == 0 or montage_total <= 0.05:
        return []
    every = max(1, int(every or 1))
    end = card_total + montage_total
    beats = sorted(b for b in (beat_times or []) if card_total + 1e-3 < b < end - 1e-3)
    picked = beats[::every]
    # Build segment boundaries: montage start, every Nth beat, montage end. Drop any
    # boundary that would make a sub-min_seg sliver.
    cleaned = [float(card_total)]
    for b in picked:
        if b - cleaned[-1] >= min_seg:
            cleaned.append(float(b))
    if end - cleaned[-1] >= min_seg:
        cleaned.append(float(end))
    else:
        cleaned[-1] = float(end)
    # No usable beats -> fall back to an even ~0.4s tiling so the effect still works.
    if len(cleaned) < 3:
        k = max(1, int(round(montage_total / 0.4)))
        cleaned = [card_total + montage_total * j / k for j in range(k + 1)]
    zlist = list(zooms) if zooms else [1.0, 1.08]
    plan: list[dict] = []
    offsets: dict[int, float] = {}
    for k in range(len(cleaned) - 1):
        slot = cleaned[k + 1] - cleaned[k]
        if slot <= 0.01:
            continue
        ci = k % n
        sdur = max(0.2, float(clip_durations[ci]))
        length = round(min(slot, sdur), 3)
        off = offsets.get(ci, 0.0)
        if off + length > sdur:
            off = 0.0
        offsets[ci] = off + length
        plan.append(
            {
                "clip_index": ci,
                "src_offset": round(off, 3),
                "length": length,
                "zoom": zlist[k % len(zlist)],
            }
        )
    return plan


def plan_accel_cut_montage(
    clip_durations: list[float],
    beat_times: list[float],
    window_start: float,
    window_len: float,
    zooms: list | tuple | None = None,
    ramp_start: float = 0.0,
    hold_start: float = 0.0,
    slow_seg: float = 1.5,
    fast_seg: float = 0.5,
    min_seg: float = 0.18,
) -> list[dict]:
    """Beat-cut montage whose cut length RAMPS over time, then HOLDS constant.

    Within [window_start, window_start+window_len] cuts are laid sequentially. The
    target length of each cut is a function of its start time t:
      - t <= ramp_start          -> slow_seg (calm)
      - ramp_start < t < hold_start -> linearly interpolated slow_seg -> fast_seg
                                       (a GRADUAL acceleration)
      - t >= hold_start          -> fast_seg (one steady fast tempo, e.g. the last
                                     N seconds of the video)
    Each cut end is snapped to the nearest heard beat so the swaps stay musical.
    Clips cycle (like plan_beat_cut_montage), each keeping its own read offset.

    Returns ``[{"clip_index", "src_offset", "length", "zoom"}, ...]`` in play order.
    """
    n = len(clip_durations)
    if n == 0 or window_len <= 0.05:
        return []
    w_end = window_start + window_len
    span = max(1e-6, float(hold_start) - float(ramp_start))
    beats = sorted(b for b in (beat_times or []) if b is not None)
    zlist = list(zooms) if zooms else [1.0, 1.08]

    def seg_len_at(t: float) -> float:
        if t >= hold_start:
            return fast_seg
        if t <= ramp_start:
            return slow_seg
        frac = (t - ramp_start) / span  # 0 at ramp start -> 1 at hold start
        return slow_seg + (fast_seg - slow_seg) * frac

    plan: list[dict] = []
    offsets: dict[int, float] = {}
    t = float(window_start)
    k = 0
    while t < w_end - min_seg and k < 4000:
        target_end = t + max(min_seg, seg_len_at(t))
        cands = [b for b in beats if t + min_seg <= b <= w_end]
        end_t = min(cands, key=lambda b: abs(b - target_end)) if cands else min(target_end, w_end)
        if end_t - t < min_seg:  # nearest beat too close -> use the target length
            end_t = min(t + max(min_seg, seg_len_at(t)), w_end)
        ci = k % n
        sdur = max(0.2, float(clip_durations[ci]))
        length = round(min(end_t - t, sdur), 3)
        if length < min_seg:
            break
        off = offsets.get(ci, 0.0)
        if off + length > sdur:
            off = 0.0
        offsets[ci] = off + length
        plan.append({
            "clip_index": ci, "src_offset": round(off, 3),
            "length": length, "zoom": zlist[k % len(zlist)],
        })
        t = end_t
        k += 1
    return plan


def build_scene_timings_from_cuts(
    cut_paths: list[str],
    scene_cut_counts: list[int],
    scenes: list[dict],
    start_offset: float = 0.0,
) -> list[dict]:
    """Regroup rendered sub-cuts back into scenes and measure each scene's real
    on-screen window from the actual cut durations, so the karaoke text lines up
    exactly with what ffmpeg produced (rounding and all).

    start_offset shifts every scene's start_time forward (used when generated
    intro cards are prepended ahead of the footage cuts); defaults to 0.0 so
    existing callers are unaffected."""
    timed: list[dict] = []
    cursor = float(start_offset)
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
    # "Locked in" reference: dark, punchy, desaturated, teal-shadow/warm-highlight
    # split, crushed toe, vignette. Templates normally pass this as grade_filter;
    # the named entry is a convenience/fallback.
    "locked_in": "eq=contrast=1.18:brightness=0.02:saturation=0.80:gamma=1.0,colorbalance=rs=-0.05:gs=-0.01:bs=0.08:rm=-0.02:bm=0.02:rh=0.05:gh=0.0:bh=-0.03,curves=all='0/0 0.06/0.04 0.5/0.52 0.92/0.98 1/1',vignette=PI/5.5",
    # "Break the pattern" reference: warm, amber-lit, lifted toe, gentle contrast +
    # warm midtone/highlight push (orange-in-highlights, slightly warm shadows).
    "moody_warm": "eq=contrast=1.07:brightness=0.02:saturation=1.0:gamma=0.98,colorbalance=rs=0.03:bs=-0.04:rm=0.17:gm=0.02:bm=-0.20:rh=0.13:bh=-0.13,curves=all='0/0.015 0.25/0.23 0.5/0.5 0.85/0.9 1/1',vignette=PI/5",
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
    exposure: float = 0.0,
    fit: str = "cover",
    flash: float = 0.0,
    card_opts: dict | None = None,
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
    # Normalize exposure BEFORE the grade so a moody/crushed grade lands on the
    # same tone regardless of how bright/dark the source clip was (prevents already
    # -dark footage from being crushed to black). exposure is an eq brightness delta.
    vf_parts = []
    if abs(float(exposure)) > 0.001:
        vf_parts.append(f"eq=brightness={float(exposure):.3f}")
    if gf:
        vf_parts.append(gf)

    z = max(1.0, float(zoom))
    if z > 1.001:
        # crop the centre then let the cover-scale below blow it back up = punch-in
        vf_parts.append(f"crop=iw/{z:.4f}:ih/{z:.4f}")

    if fit == "card":
        # Rounded-card frame: footage in a rounded-rect card centered on black (the
        # "you versus you" look). The graded/zoomed footage is scaled to fill the
        # card, given rounded corners via a cached alpha mask (alphamerge), then
        # overlaid on a black background. Caption is added later by the ASS pass.
        wi, hi = int(float(w)), int(float(h))
        co = card_opts or {}
        cw = int(round(wi * float(co.get("w_frac", 0.889)))); cw -= cw % 2
        ch = int(round(hi * float(co.get("h_frac", 0.394)))); ch -= ch % 2
        radius = int(co.get("radius", 60))
        cx = (wi - cw) // 2
        cy = int(round(hi * float(co.get("y_frac", 0.272))))
        mask = _ensure_card_mask(cw, ch, radius)
        seg = max(0.1, float(length))
        footage = list(vf_parts) + [
            f"scale={cw}:{ch}:force_original_aspect_ratio=increase",
            f"crop={cw}:{ch}",
        ]
        # Optional white flash-cut: the cut opens white and resolves over `flash` sec.
        # Applied to the FOOTAGE (before the rounded mask + composite), so the flash
        # happens INSIDE the card only — the black background around it stays black.
        if float(flash) > 0.001:
            footage.append(f"fade=t=in:st=0:d={float(flash):.3f}:color=white")
        footage.append("format=rgba")
        fc = (
            f"[0:v]{','.join(footage)}[fg];"
            f"[fg][2:v]alphamerge[card];"
            f"color=c=black:s={wi}x{hi}[bg];"
            f"[bg][card]overlay={cx}:{cy},setsar=1,fps={fps},format=yuv420p[vout]"
        )
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(max(0.0, float(src_offset))), "-i", src_path,
            "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={seg}",
            "-loop", "1", "-i", mask,
            "-t", str(seg),
            "-filter_complex", fc,
            "-map", "[vout]", "-map", "1:a",
            "-c:v", "libx264", "-c:a", "aac", "-preset", "fast",
            "-pix_fmt", "yuv420p", "-shortest", out_path,
        ]
        _run(cmd)
        return out_path

    if fit == "letterbox":
        # Cinematic letterbox: FILL a 16:9 band at full width with footage, then pad
        # to the full frame with pure-black bars top/bottom (the "came from nothing"
        # signature). Cover-fill the band so it's always full of footage — a 16:9
        # source fills it exactly; a portrait/landscape source is cropped to the band
        # strip (the cinematic intent) rather than shrunk to a tiny pillarboxed clip.
        # The grade above runs BEFORE the pad, so the black bars stay pure black.
        wi, hi = int(float(w)), int(float(h))
        band_h = (wi * 9) // 16
        if band_h % 2:
            band_h += 1
        vf_parts.append(
            f"scale={wi}:{band_h}:force_original_aspect_ratio=increase,"
            f"crop={wi}:{band_h},"
            f"pad={wi}:{hi}:(ow-iw)/2:(oh-ih)/2:black,"
            f"setsar=1,fps={fps},format=yuv420p"
        )
    else:
        # cover-fill the target frame (no letterbox bars), force constant fps/SAR/pixfmt
        vf_parts.append(
            f"scale={w}:{h}:force_original_aspect_ratio=increase,"
            f"crop={w}:{h},setsar=1,fps={fps},format=yuv420p"
        )
    # Optional white flash-cut: the cut opens fully white and resolves to footage over
    # `flash` seconds (a quick downbeat flash, the energetic-edit signature).
    if float(flash) > 0.001:
        vf_parts.append(f"fade=t=in:st=0:d={float(flash):.3f}:color=white")
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
