"""Build montage templates from reference video FILES.

Drop your reference clips (the videos whose style you want to imitate) into
``backend/reference_videos/`` and run:

    cd backend
    python scripts/build_templates.py            # extract + merge into templates.json
    python scripts/build_templates.py --dry-run  # just print what it measured
    python scripts/build_templates.py --ocr      # also estimate caption density (needs easyocr)

What is MEASURED from each file (reliable): duration, hard-cut count and pacing
(ffmpeg scene detection), tempo/BPM (librosa), average brightness/saturation
(ffmpeg signalstats) -> color grade. What is DERIVED with sensible defaults tied
to the measured pace (not truly in the pixels): phrase length/tone, structure,
shot list, and caption style (unless --ocr is used). Seed templates already in
templates.json are preserved; re-running replaces only the entries for files it
re-processes.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Reference filenames often contain emoji/non-Latin chars; the default Windows
# console codec (cp1251) raises UnicodeEncodeError when we print them. Force UTF-8.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from services.editor import _run, get_duration  # noqa: E402  (needs sys.path first)

REF_DIR = BACKEND_DIR / "reference_videos"
TEMPLATES_PATH = BACKEND_DIR / "templates" / "templates.json"
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}

def _build_grade_filter(yavg, satavg, uavg, vavg):
    """An ffmpeg filter that roughly matches the reference's tone (brightness /
    saturation / warm-cool). Returns None when brightness wasn't measured so the
    caller falls back to a preset grade."""
    if yavg is None:
        return None
    # Calibrated to the real spread of short-form aesthetic refs (often dark, low-sat):
    # brightness centered ~58 luma so dark/bright refs diverge instead of all pinning
    # to the floor; mild saturation; warmth (V-U) is the main differentiator.
    sat = max(0.82, min(1.15, 0.85 + (satavg if satavg else 8) / 120.0))
    bright = max(-0.05, min(0.05, (yavg - 58) / 500.0))
    parts = [f"eq=contrast=1.05:brightness={bright:.3f}:saturation={sat:.2f}"]
    if uavg is not None and vavg is not None:
        warm = (vavg - 128) - (uavg - 128)  # >0 warm (red), <0 cool (blue)
        shift = max(-0.07, min(0.07, warm * 0.005))
        if abs(shift) >= 0.008:
            parts.append(f"colorbalance=rm={shift:.3f}:bm={-shift:.3f}")
    if yavg < 45:  # only genuinely dark refs get a (light) vignette
        parts.append("vignette=PI/6")
    return ",".join(parts)


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "clip"


def measure_cuts(path: str, duration: float) -> dict:
    """Count hard cuts via ffmpeg scene detection -> pacing signals."""
    try:
        res = _run(
            [
                "ffmpeg",
                "-i",
                path,
                "-filter:v",
                "select='gt(scene,0.4)',showinfo",
                "-f",
                "null",
                "-",
            ],
            text=True,
        )
        times = re.findall(r"pts_time:([\d.]+)", res.stderr or "")
        cuts = len(times)
    except Exception:
        cuts = 0
    segments = cuts + 1  # N cuts split the clip into N+1 segments
    avg_cut_len = (duration / segments) if segments > 0 else duration
    return {"cuts": cuts, "avg_cut_len": round(avg_cut_len, 3)}


def measure_color(path: str) -> dict:
    """Average brightness (YAVG 0-255) and saturation (SATAVG) via signalstats.

    The metadata is parsed from ffmpeg's log (stderr) rather than written with
    ``metadata=print:file=<path>``: an absolute Windows path inside a filtergraph
    breaks the parser (the drive ':' is the option separator and '\\' is an escape).
    """
    try:
        res = _run(
            [
                "ffmpeg",
                "-i",
                path,
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
            "brightness": avg("YAVG"),   # 0-255 luma
            "saturation": avg("SATAVG"),
            "u": avg("UAVG"),            # ~128 neutral; >128 cool/blue
            "v": avg("VAVG"),            # ~128 neutral; >128 warm/red
        }
    except Exception:
        return {"brightness": None, "saturation": None, "u": None, "v": None}


def measure_bpm(path: str) -> float | None:
    """Tempo in BPM via librosa on the extracted audio (None if no/undecodable audio)."""
    wav = str(BACKEND_DIR / "temp" / f"_bpm_{os.getpid()}.wav")
    os.makedirs(os.path.dirname(wav), exist_ok=True)
    try:
        _run(["ffmpeg", "-y", "-i", path, "-vn", "-ac", "1", "-ar", "22050", wav])
        import librosa

        y, sr = librosa.load(wav, sr=None)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo if not hasattr(tempo, "__len__") else tempo[0])
        return round(bpm, 1) if bpm > 0 else None
    except Exception:
        return None
    finally:
        if os.path.exists(wav):
            os.remove(wav)


def measure_caption_density(path: str, duration: float):
    """Optional OCR: average words of on-screen text per sampled frame.

    Returns None if easyocr isn't installed. Light sampling (a few frames)."""
    try:
        import easyocr  # type: ignore
    except Exception:
        return None
    import shutil

    frames_dir = BACKEND_DIR / "temp" / f"_ocr_{os.getpid()}"
    try:
        reader = easyocr.Reader(["en", "ru"], gpu=False, verbose=False)
        frames_dir.mkdir(parents=True, exist_ok=True)
        _run(
            [
                "ffmpeg",
                "-y",
                "-i",
                path,
                "-vf",
                "fps=1,scale=540:-1",
                str(frames_dir / "f_%03d.jpg"),
            ]
        )
        counts = []
        for img in sorted(frames_dir.glob("*.jpg"))[:30]:
            words = 0
            for _box, text, conf in reader.readtext(str(img)):
                if conf and conf > 0.4:
                    words += len(str(text).split())
            counts.append(words)
        return round(sum(counts) / len(counts), 2) if counts else 0.0
    except Exception:
        return None
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)


def signals_to_template(name: str, signals: dict) -> dict:
    """Map measured signals -> a template dict (pure function, easy to test)."""
    duration = max(1.0, float(signals.get("duration") or 1.0))
    avg_cut_len = float(signals.get("avg_cut_len") or 0.9)
    bpm = signals.get("bpm")
    brightness = signals.get("brightness")
    saturation = signals.get("saturation")
    cap_density = signals.get("caption_density")

    def clamp(v, lo, hi):
        return max(lo, min(hi, v))

    # scene count: ~one scene per ~3.2s of reference, kept in a sane band
    scene_center = clamp(round(duration / 3.2), 6, 12)
    scene_count = [max(2, scene_center - 1), scene_center + 1]

    target_cut_len = round(clamp(avg_cut_len, 0.4, 1.6), 2)
    scene_avg_len = duration / scene_center
    max_cuts = int(clamp(round(scene_avg_len / target_cut_len), 2, 6))

    if target_cut_len < 0.7:
        zooms = [1.0, 1.15, 1.0, 1.18]
        phrase = {"min_words": 3, "max_words": 6}
    elif target_cut_len <= 1.1:
        zooms = [1.0, 1.12]
        phrase = {"min_words": 4, "max_words": 8}
    else:
        zooms = [1.0, 1.06]
        phrase = {"min_words": 5, "max_words": 9}
    phrase["tone"] = "matched to the pacing of a reference montage"

    # color grade from brightness/saturation (best-effort)
    grade = "dark_cinematic"
    if brightness is not None:
        if brightness < 70:
            grade = "moody"
        elif saturation is not None and saturation > 110:
            grade = "high_contrast"
        elif brightness < 95 and (saturation is None or saturation < 80):
            grade = "dark_cinematic"
        else:
            grade = "high_contrast"

    # caption style: OCR-informed when available, else karaoke default
    caption_style = "karaoke"
    if cap_density is not None:
        caption_style = "karaoke" if cap_density >= 2.0 else "broll_center"

    if bpm is None:
        music_vibe = "dark ambient"
    elif bpm > 120:
        music_vibe = "energetic / trap"
    elif bpm >= 90:
        music_vibe = "lo-fi beats"
    else:
        music_vibe = "dark ambient"

    uavg, vavg = signals.get("u"), signals.get("v")
    # tone-matched grade built from the reference's real colors (caption font/size/
    # position now come from a per-template preset in services.templates)
    grade_filter = _build_grade_filter(brightness, saturation, uavg, vavg)

    return {
        "id": f"ref-{_slug(name)}",
        "label": f"Ref: {name}",
        # a montage style (pacing/captions/grade) is orientation-agnostic, so it
        # applies to any platform; resolution is handled separately at render time
        "platforms": ["all"],
        "scene_count": scene_count,
        "pacing": {
            "target_cut_len": target_cut_len,
            "max_cuts_per_scene": max_cuts,
            "zooms": zooms,
        },
        "phrase": phrase,
        "caption_style": caption_style,
        "color_grade": grade,
        "grade_filter": grade_filter,
        "music_vibe": music_vibe,
        "structure": ["hook", "body", "body", "body", "punch"],
        "shots": [
            "close-up hands",
            "wide establishing",
            "over-the-shoulder",
            "screen recording",
            "detail",
            "reaction",
        ],
        "source": "extracted",
        "ref": name,
        "preview_file": signals.get("preview_file"),
        "measured": {
            "duration": round(duration, 2),
            "cuts": signals.get("cuts"),
            "avg_cut_len": avg_cut_len,
            "bpm": bpm,
            "brightness": brightness,
            "saturation": saturation,
            "u": uavg,
            "v": vavg,
            "caption_density": cap_density,
        },
    }


def extract_one(path: Path, use_ocr: bool) -> dict:
    duration = get_duration(str(path))
    signals = {"duration": duration, "preview_file": path.name}
    signals.update(measure_cuts(str(path), duration))
    signals.update(measure_color(str(path)))
    signals["bpm"] = measure_bpm(str(path))
    signals["caption_density"] = (
        measure_caption_density(str(path), duration) if use_ocr else None
    )
    return signals_to_template(path.stem, signals)


def _locked_ids() -> set:
    """Ids of templates flagged ``"locked": true`` — manually tuned entries that
    the auto-extractor must never overwrite."""
    if not TEMPLATES_PATH.exists():
        return set()
    try:
        data = json.loads(TEMPLATES_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, ValueError):
        return set()
    return {
        t["id"]
        for t in (data if isinstance(data, list) else [])
        if isinstance(t, dict) and t.get("locked") and t.get("id")
    }


def merge_into_file(new_templates: list):
    existing = []
    if TEMPLATES_PATH.exists():
        try:
            existing = json.loads(TEMPLATES_PATH.read_text(encoding="utf-8"))
            if not isinstance(existing, list):
                existing = []
        except (json.JSONDecodeError, OSError, ValueError):
            existing = []
    # Defense-in-depth: never let an auto-extracted entry replace a locked one,
    # even if a locked id slipped through to here.
    locked = {
        t["id"]
        for t in existing
        if isinstance(t, dict) and t.get("locked") and t.get("id")
    }
    incoming = [t for t in new_templates if t.get("id") not in locked]
    new_ids = {t["id"] for t in incoming}
    kept = [t for t in existing if t.get("id") not in new_ids]
    merged = kept + incoming
    TEMPLATES_PATH.parent.mkdir(parents=True, exist_ok=True)
    TEMPLATES_PATH.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return merged


def main():
    ap = argparse.ArgumentParser(description="Build montage templates from reference videos.")
    ap.add_argument("--dir", default=str(REF_DIR), help="folder with reference videos")
    ap.add_argument("--ocr", action="store_true", help="estimate caption density via OCR (needs easyocr)")
    ap.add_argument("--dry-run", action="store_true", help="print results without writing templates.json")
    args = ap.parse_args()

    ref_dir = Path(args.dir)
    if not ref_dir.is_dir():
        print(f"No reference folder at {ref_dir}. Create it and add video files.")
        ref_dir.mkdir(parents=True, exist_ok=True)
        return

    files = sorted(p for p in ref_dir.iterdir() if p.suffix.lower() in VIDEO_EXTS)
    if not files:
        print(f"No video files in {ref_dir} (looked for {sorted(VIDEO_EXTS)}).")
        return

    print(f"Found {len(files)} reference video(s) in {ref_dir}\n")
    locked = _locked_ids()
    templates = []
    for p in files:
        tid = f"ref-{_slug(p.stem)}"
        if tid in locked:
            print(f"- {p.name}: SKIPPED (locked manual template '{tid}' — not re-extracting)")
            continue
        try:
            t = extract_one(p, args.ocr)
            templates.append(t)
            m = t["measured"]
            print(
                f"- {p.name}: {m['duration']}s, cuts={m['cuts']}, "
                f"avg_cut={m['avg_cut_len']}s, bpm={m['bpm']}, "
                f"grade={t['color_grade']}, scenes={t['scene_count']}, "
                f"max_cuts/scene={t['pacing']['max_cuts_per_scene']}, "
                f"caption={t['caption_style']} -> id={t['id']}"
            )
        except Exception as e:
            print(f"- {p.name}: SKIPPED ({e})")

    if not templates:
        print("\nNothing extracted.")
        return

    if args.dry_run:
        print("\n--dry-run: not writing templates.json")
        return

    merged = merge_into_file(templates)
    print(f"\nWrote {len(templates)} extracted template(s); {len(merged)} total in {TEMPLATES_PATH}")


if __name__ == "__main__":
    main()
