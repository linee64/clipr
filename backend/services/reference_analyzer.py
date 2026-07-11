import os
import re
import uuid
import subprocess
from pathlib import Path
from services.editor import _run, get_duration
from services.storage import upload_file

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BACKEND_DIR / "temp"

import yt_dlp

def download_reference_video(url: str) -> str:
    """Download video from URL (Instagram, TikTok, etc.) using yt-dlp."""
    os.makedirs(TEMP_DIR, exist_ok=True)
    out_id = str(uuid.uuid4())
    output_path = str(TEMP_DIR / f"{out_id}_ref.mp4")
    
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': output_path,
        'quiet': True,
        'no_warnings': True,
        'merge_output_format': 'mp4',
        'nocheckcertificate': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Mode': 'navigate',
        }
    }

    # Add custom cookies file if configured via environment or exists in project root
    cookies_file = os.getenv("YT_DLP_COOKIES_FILE") or str(BACKEND_DIR / "cookies.txt")
    cookies_file_txt_txt = str(BACKEND_DIR / "cookies.txt.txt")
    if os.path.exists(cookies_file):
        ydl_opts['cookiefile'] = cookies_file
    elif os.path.exists(cookies_file_txt_txt):
        ydl_opts['cookiefile'] = cookies_file_txt_txt
    
    # Try downloading with cookies from different local browsers if no cookies file is provided
    downloaded = False
    if 'cookiefile' not in ydl_opts:
        browsers = ['chrome', 'edge', 'firefox', 'opera', 'brave']
        for browser in browsers:
            opts = dict(ydl_opts)
            opts['cookiesfrombrowser'] = ((browser, None, None, None),)
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    ydl.download([url])
                downloaded = True
                break
            except Exception:
                continue
            
    if not downloaded:
        try:
            # Fallback to direct download using whatever settings we resolved (e.g. cookiefile if exists)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as e:
            raise RuntimeError(
                f"Ошибка загрузки Instagram/TikTok референса: {str(e)}. "
                f"Попробуйте загрузить видео файлом напрямую, если ссылка заблокирована Instagram."
            )
        
    if not os.path.exists(output_path):
        # In case merging did not create the file with .mp4 extension exactly or named differently
        # Look for the uuid file in the temp directory
        for f in os.listdir(TEMP_DIR):
            if f.startswith(out_id):
                return str(TEMP_DIR / f)
        raise RuntimeError("Не удалось сохранить загруженный файл референса.")
        
    return output_path

def extract_reference_audio(video_path: str) -> str:
    """Extract audio track as MP3 and upload to storage."""
    audio_id = str(uuid.uuid4())
    mp3_path = str(TEMP_DIR / f"{audio_id}_ref_audio.mp3")
    
    # Run ffmpeg to transcode video audio to clean mp3
    _run(["ffmpeg", "-y", "-i", video_path, "-vn", "-acodec", "libmp3lame", "-q:a", "2", mp3_path])
    
    return mp3_path

def extract_scene_keyframes(video_path: str, cuts: list[float], duration: float, frames_dir: Path) -> list[str]:
    """Extract one representative frame per scene (from the middle of each scene)."""
    from services.editor import _tool
    # Build scene midpoints
    boundaries = [0.0] + cuts + [duration]
    frame_paths: list[str] = []
    for idx in range(len(boundaries) - 1):
        t_start = boundaries[idx]
        t_end = boundaries[idx + 1]
        midpoint = round((t_start + t_end) / 2.0, 3)
        out_path = str(frames_dir / f"scene_{idx:03d}.jpg")
        try:
            _run([
                _tool("ffmpeg"), "-y",
                "-ss", str(midpoint),
                "-i", video_path,
                "-frames:v", "1",
                "-q:v", "3",
                "-vf", "scale=540:-1",
                out_path,
            ])
            if os.path.exists(out_path):
                frame_paths.append(out_path)
        except Exception:
            pass
    return frame_paths


def analyze_reference_cuts(video_path: str, duration: float) -> list[float]:
    """Determine cut timestamps from video using ffmpeg scene detection."""
    try:
        res = _run(
            [
                "ffmpeg",
                "-i",
                video_path,
                "-filter:v",
                "select='gt(scene,0.15)',showinfo",
                "-f",
                "null",
                "-",
            ],
            text=True,
        )
        times = [float(t) for t in re.findall(r"pts_time:([\d.]+)", res.stderr or "")]
    except Exception:
        times = []
    
    # Sort and filter timestamps
    times = sorted(list(set(times)))
    # Always bound timings to [0, duration]
    valid_times = [t for t in times if 0 < t < duration]
    return valid_times


def _detect_subtitle_pattern(per_frame_texts: list[list[dict]]) -> dict:
    """Detect static vs dynamic subtitle fields from per-frame OCR data.

    Each entry in per_frame_texts is a list of {"text": ..., "y": ...} dicts for
    one frame.  A line that appears (case-insensitive) in >50% of frames is
    "static"; the rest are "dynamic".  Returns a subtitle_pattern dict.
    """
    if not per_frame_texts:
        return {"type": "single", "static_line": None, "static_position": None,
                "dynamic_samples": [], "per_frame_texts": []}

    # Count how often each lowercased text appears across frames
    from collections import Counter
    text_counts: Counter = Counter()
    text_y_positions: dict[str, list[float]] = {}
    total_frames = len(per_frame_texts)

    for fi, frame_lines in enumerate(per_frame_texts):
        seen_in_frame: set[str] = set()
        for item in frame_lines:
            key = item["text"].strip().lower()
            if key and key not in seen_in_frame:
                text_counts[key] += 1
                seen_in_frame.add(key)
                text_y_positions.setdefault(key, []).append(item["y"])

    # A line present in >50% of frames is "static"
    threshold = max(2, total_frames * 0.50)
    static_candidates = [
        (txt, cnt) for txt, cnt in text_counts.items() if cnt >= threshold
    ]

    if not static_candidates:
        # No repeated line → single-field subtitles (all dynamic)
        all_dynamic: list[str] = []
        for frame_lines in per_frame_texts:
            for item in frame_lines:
                t = item["text"].strip()
                if t and (not all_dynamic or t.lower() != all_dynamic[-1].lower()):
                    all_dynamic.append(t)
        return {
            "type": "single",
            "static_line": None,
            "static_position": None,
            "dynamic_samples": all_dynamic[:15],
            "per_frame_texts": per_frame_texts,
        }

    # Pick the most frequent static line
    static_candidates.sort(key=lambda x: -x[1])
    static_key = static_candidates[0][0]
    # Find the original-case version from the frames
    static_original = static_key
    for frame_lines in per_frame_texts:
        for item in frame_lines:
            if item["text"].strip().lower() == static_key:
                static_original = item["text"].strip()
                break
        if static_original != static_key:
            break

    # Determine static position (top/bottom) from average Y
    static_avg_y = (
        sum(text_y_positions.get(static_key, [0]))
        / max(1, len(text_y_positions.get(static_key, [1])))
    )

    # Collect dynamic samples (non-static texts, deduplicated consecutively)
    dynamic_samples: list[str] = []
    for frame_lines in per_frame_texts:
        for item in frame_lines:
            t = item["text"].strip()
            if t.lower() != static_key:
                if not dynamic_samples or t.lower() != dynamic_samples[-1].lower():
                    dynamic_samples.append(t)

    # Determine relative position
    dynamic_y_values: list[float] = []
    for frame_lines in per_frame_texts:
        for item in frame_lines:
            if item["text"].strip().lower() != static_key:
                dynamic_y_values.append(item["y"])
    dynamic_avg_y = (
        sum(dynamic_y_values) / max(1, len(dynamic_y_values))
    ) if dynamic_y_values else static_avg_y

    static_position = "bottom" if static_avg_y > dynamic_avg_y else "top"

    pattern_type = "two_field" if dynamic_samples else "single"

    return {
        "type": pattern_type,
        "static_line": static_original,
        "static_position": static_position,
        "dynamic_samples": dynamic_samples[:15],
        "per_frame_texts": per_frame_texts,
    }


def analyze_reference_subtitles(video_path: str, cuts: list[float] | None = None, duration: float | None = None) -> dict:
    """Analyze subtitle style and pattern using EasyOCR + Gemini Vision.

    EasyOCR gives pixel-accurate Y-coordinates for alignment math.
    Gemini Vision adds understanding of subtitle content, style (uppercase/bold/color)
    and visual context for each scene (e.g. 'мужчина бежит', 'сцена драки').
    """
    fallback = {
        "caption_style": "karaoke",
        "caption_alignment": 2,
        "caption_font": "Arial Black",
        "caption_uppercase": True,
        "detected_texts": [],
        "avg_words_per_line": 4,
        "subtitle_pattern": {
            "type": "single", "static_line": None, "static_position": None,
            "dynamic_samples": [], "per_frame_texts": [],
        },
        "scene_contexts": [],
    }

    frames_dir = TEMP_DIR / f"_ocr_ref_{os.getpid()}"
    frames_dir.mkdir(parents=True, exist_ok=True)

    try:
        from services.editor import _tool
        from services.vision import analyze_frames_batch, GEMINI_READY

        # ── Step 1: Sample frames at 1fps for EasyOCR alignment math ──────────
        _run([
            _tool("ffmpeg"), "-y",
            "-i", video_path,
            "-vf", "fps=1,scale=540:-1",
            str(frames_dir / "f_%03d.jpg"),
        ])

        all_frames_sorted = sorted(frames_dir.glob("f_*.jpg"))

        # ── Step 2: EasyOCR for Y-coord alignment + uppercase detection ────────
        detected_y_coords: list[float] = []
        is_uppercase = False
        total_words = 0
        detected_texts: list[str] = []
        per_frame_texts: list[list[dict]] = []

        try:
            import easyocr
            reader = easyocr.Reader(["en", "ru"], gpu=False, verbose=False)

            for img in all_frames_sorted[:12]:
                with open(img, "rb") as fh:
                    img_bytes = fh.read()
                results = reader.readtext(img_bytes)
                frame_texts: list[str] = []
                frame_structured: list[dict] = []
                for box, text, conf in results:
                    if conf > 0.4 and len(text.strip()) > 2:
                        top_y = box[0][1]
                        bottom_y = box[2][1]
                        center_y = (top_y + bottom_y) / 2.0
                        detected_y_coords.append(center_y)
                        if text.isupper():
                            is_uppercase = True
                        total_words += len(text.split())
                        frame_texts.append(text.strip())
                        frame_structured.append({"text": text.strip(), "y": center_y})
                if frame_texts:
                    detected_texts.append(" ".join(frame_texts))
                if frame_structured:
                    per_frame_texts.append(frame_structured)
        except Exception:
            pass  # EasyOCR optional; Gemini will still run

        # ── Step 3: Gemini Vision on scene keyframes ────────────────────────────
        scene_contexts: list[str] = []
        is_bold = False
        detected_colors = []
        
        if GEMINI_READY and (cuts is not None) and (duration is not None):
            # Extract one keyframe per scene for Vision analysis
            kf_dir = frames_dir / "kf"
            kf_dir.mkdir(exist_ok=True)
            keyframe_paths = extract_scene_keyframes(video_path, cuts, duration, kf_dir)
            if keyframe_paths:
                vision_results = analyze_frames_batch(keyframe_paths)
                for i, res in enumerate(vision_results):
                    ctx = res.get("scene_context", "")
                    sub_text = res.get("subtitle_text", "")
                    sub_pos = res.get("subtitle_position", "none")
                    style = res.get("subtitle_style", {})
                    
                    if style.get("bold"):
                        is_bold = True
                    if style.get("color"):
                        detected_colors.append(style.get("color").lower())
 
                    # Build a human-readable tag
                    label_parts = []
                    if ctx:
                        label_parts.append(ctx)
                    if sub_text:
                        label_parts.append(f'текст: "{sub_text}" ({sub_pos})')
                    if style.get("uppercase"):
                        is_uppercase = True
 
                    scene_contexts.append(" — ".join(label_parts) if label_parts else "")
 
                    # Feed Gemini-detected text into EasyOCR's per_frame_texts
                    # only if EasyOCR gave us nothing (fallback enrichment)
                    if sub_text and len(per_frame_texts) <= i:
                        # Use image height (~960 for 540w vertical video) to estimate y
                        y_approx = {"top": 80.0, "center": 480.0, "bottom": 880.0}.get(sub_pos, 880.0)
                        per_frame_texts.append([{"text": sub_text, "y": y_approx}])
                        detected_y_coords.append(y_approx)
                        if sub_text.isupper():
                            is_uppercase = True
                        total_words += len(sub_text.split())
        elif GEMINI_READY and all_frames_sorted:
            # No cuts provided — just run Gemini on the 1fps frames
            vision_results = analyze_frames_batch([str(p) for p in all_frames_sorted[:8]])
            for res in vision_results:
                ctx = res.get("scene_context", "")
                if ctx:
                    scene_contexts.append(ctx)
                sub_text = res.get("subtitle_text", "")
                style = res.get("subtitle_style", {})
                if style.get("bold"):
                    is_bold = True
                if style.get("color"):
                    detected_colors.append(style.get("color").lower())
                if sub_text and style.get("uppercase"):
                    is_uppercase = True

        # ── Step 4: Compute alignment from Y-coords ─────────────────────────────
        alignment = 2  # bottom (ASS default)
        margin_v = 150 # default
        if detected_y_coords:
            avg_y = sum(detected_y_coords) / len(detected_y_coords)
            if avg_y < 240:
                alignment = 8   # top
                margin_v = int(max(40, min(600, avg_y * 2.0)))
            elif avg_y < 480:
                alignment = 5   # center
                margin_v = 0
            else:
                alignment = 2   # bottom
                margin_v = int(max(40, min(800, 1920 - (avg_y * 2.0))))

        caption_style = "karaoke" if total_words > 5 else "broll_center"

        avg_words = 4
        if detected_texts:
            word_counts = [len(t.split()) for t in detected_texts]
            avg_words = max(2, round(sum(word_counts) / len(word_counts)))

        # Deduplicate similar consecutive texts
        unique_texts: list[str] = []
        for t in detected_texts:
            if not unique_texts or t.lower().strip() != unique_texts[-1].lower().strip():
                unique_texts.append(t)

        # Detect subtitle pattern (static vs dynamic fields)
        subtitle_pattern = _detect_subtitle_pattern(per_frame_texts)

        # Determine active color
        active_color = "&H9EE500&"  # Default mint highlight
        if detected_colors:
            color_counts = {}
            for col in detected_colors:
                color_counts[col] = color_counts.get(col, 0) + 1
            most_common = max(color_counts, key=color_counts.get)
            
            if "yellow" in most_common:
                active_color = "&H00FFFF&"
            elif "green" in most_common:
                active_color = "&H2ECC71&"
            elif "white" in most_common:
                active_color = "&HFFFFFF&"
            elif "red" in most_common:
                active_color = "&H0000FF&"
            elif "orange" in most_common:
                active_color = "&H00A5FF&"

        return {
            "caption_style": caption_style,
            "caption_alignment": alignment,
            "caption_marginv": margin_v,
            "caption_font": "Impact" if is_uppercase else "Arial Black",
            "caption_uppercase": is_uppercase,
            "caption_bold": is_bold,
            "caption_active_color": active_color,
            "detected_texts": unique_texts,
            "avg_words_per_line": avg_words,
            "subtitle_pattern": subtitle_pattern,
            "scene_contexts": scene_contexts,
        }
    except Exception:
        return fallback
    finally:
        import shutil
        shutil.rmtree(frames_dir, ignore_errors=True)


def analyze_reference_colors(video_path: str) -> dict:
    """Analyze color values to build a custom color-grade filter."""
    try:
        res = _run(
            [
                "ffmpeg",
                "-i",
                video_path,
                "-vf",
                "fps=2,signalstats,metadata=print",
                "-an",
                "-f",
                "null",
                "-",
            ],
            text=True,
        )
        text = (res.stderr or "") + (res.stdout or "")
        
        def avg(tag):
            vals = [float(x) for x in re.findall(rf"signalstats\.{tag}=([\d.]+)", text)]
            return round(sum(vals) / len(vals), 1) if vals else None

        return {
            "brightness": avg("YAVG"),
            "saturation": avg("SATAVG"),
            "u": avg("UAVG"),
            "v": avg("VAVG"),
        }
    except Exception:
        return {"brightness": None, "saturation": None, "u": None, "v": None}

def build_custom_grade_filter(colors: dict) -> str:
    """Build eq & colorbalance ffmpeg string based on measured reference colors."""
    yavg = colors.get("brightness")
    satavg = colors.get("saturation")
    uavg = colors.get("u")
    vavg = colors.get("v")
    
    if yavg is None:
        return "eq=contrast=1.05:brightness=0.0:saturation=1.0"
        
    sat = max(0.82, min(1.15, 0.85 + (satavg if satavg else 8) / 120.0))
    bright = max(-0.05, min(0.05, (yavg - 58) / 500.0))
    parts = [f"eq=contrast=1.05:brightness={bright:.3f}:saturation={sat:.2f}"]
    
    if uavg is not None and vavg is not None:
        warm = (vavg - 128) - (uavg - 128)
        shift = max(-0.07, min(0.07, warm * 0.005))
        if abs(shift) >= 0.008:
            parts.append(f"colorbalance=rm={shift:.3f}:bm={-shift:.3f}")
            
    if yavg < 45:
        parts.append("vignette=PI/6")
        
    return ",".join(parts)
