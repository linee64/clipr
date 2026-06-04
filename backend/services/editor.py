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

# Whisper (OpenAI) отключён — включить, когда появится OPENAI_API_KEY
WHISPER_ENABLED = False

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
):
    """Trim a single video clip using FFmpeg."""
    end_time = duration - trim_end if trim_end > 0 else duration
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
    """Mix background audio into video at specified volume."""
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-i",
        audio_path,
        "-filter_complex",
        f"[1:a]volume={volume}[bg];[0:a][bg]amix=inputs=2:duration=first[aout]",
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


def transcribe_audio(video_path: str) -> list[dict]:
    """Whisper-транскрипция (требует OpenAI API). Сейчас отключена."""
    raise RuntimeError("Whisper отключён. Добавьте OPENAI_API_KEY и WHISPER_ENABLED=True.")


def generate_srt(segments: list, output_path: str):
    """Convert Whisper segments to .srt subtitle file."""

    def format_time(seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    with open(output_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            f.write(f"{i}\n")
            f.write(f"{format_time(seg['start'])} --> {format_time(seg['end'])}\n")
            f.write(f"{seg['text'].strip()}\n\n")


def _escape_subtitles_path(path: str) -> str:
    return os.path.abspath(path).replace("\\", "/").replace(":", "\\:")


def burn_subtitles(video_path: str, srt_path: str, output_path: str, platform: str):
    """Burn subtitles into video with platform-specific styling."""
    styles = {
        "TikTok": "FontName=Inter,FontSize=18,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=80",
        "LinkedIn": "FontName=Inter,FontSize=14,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=1,Alignment=2,MarginV=40",
        "Reels": "FontName=Inter,FontSize=16,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=80",
    }
    style = styles.get(platform, styles["TikTok"])
    escaped_srt = _escape_subtitles_path(srt_path)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vf",
        f"subtitles={escaped_srt}:force_style='{style}'",
        "-c:a",
        "copy",
        output_path,
    ]
    _run(cmd)


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
