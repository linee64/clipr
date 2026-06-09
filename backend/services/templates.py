"""Video-style templates: a small JSON-backed "database" of montage patterns.

Each template encodes how a video is built — scene count, cut pacing, caption
style, color grade, phrase length/tone, structure and shot variety — so the
storyboard generator and the montage worker can rotate among distinct looks
instead of producing the same edit every time. New templates are appended by the
reference-video extractor (scripts/build_templates.py)."""

import hashlib
import json
import random
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_PATH = BACKEND_DIR / "templates" / "templates.json"

# Caption presets: each template gets a DISTINCT subtitle treatment, not just a
# font. We vary base font, an emphasis font for the active/highlighted word (so a
# single video shows two fonts, like the references do), text case, italic, and
# on-screen position (alignment 2=bottom, 5=middle, 8=top). All faces are from the
# msttcorefonts family (serif / mono / casual / heavy-sans for real contrast) so
# they exist on Windows AND on a Linux render host with msttcorefonts installed.
# NOTE (prod): a bare Linux image WITHOUT msttcorefonts substitutes one default face
# for all of these — captions still render but the variety is lost; install
# msttcorefonts (or bundle .ttf + fontsdir) on the render host.
CAPTION_PRESETS = [
    {"font": "Impact", "emphasis_font": "Georgia", "uppercase": True, "italic": False, "alignment": 2, "outline": 4, "marginv": 300},
    {"font": "Verdana", "emphasis_font": "Impact", "uppercase": False, "italic": False, "alignment": 5, "outline": 3, "marginv": 0},
    {"font": "Georgia", "emphasis_font": "Impact", "uppercase": False, "italic": True, "alignment": 8, "outline": 3, "marginv": 260},
    {"font": "Arial Black", "emphasis_font": "Comic Sans MS", "uppercase": False, "italic": False, "alignment": 2, "outline": 3, "marginv": 340},
    {"font": "Trebuchet MS", "emphasis_font": "Georgia", "uppercase": True, "italic": False, "alignment": 5, "outline": 3, "marginv": 0},
    {"font": "Times New Roman", "emphasis_font": "Impact", "uppercase": False, "italic": True, "alignment": 2, "outline": 3, "marginv": 300},
    {"font": "Courier New", "emphasis_font": "Arial Black", "uppercase": True, "italic": False, "alignment": 5, "outline": 3, "marginv": 0},
]

# Fallback used when no template is selected or an id is unknown. Matches the
# pipeline's built-in defaults so behavior is unchanged without a template.
DEFAULT_TEMPLATE = {
    "id": "default",
    "label": "Default",
    "platforms": ["TikTok", "Reels", "LinkedIn"],
    "scene_count": [8, 10],
    "pacing": {"target_cut_len": 0.9, "max_cuts_per_scene": 5, "zooms": [1.0, 1.12]},
    "phrase": {"min_words": 4, "max_words": 8, "tone": "conversational, real, not motivational poster"},
    "caption_style": "karaoke",
    "color_grade": "dark_cinematic",
    "music_vibe": "dark ambient",
    "structure": ["hook", "body", "body", "punch"],
    "shots": ["close-up", "wide", "over-the-shoulder", "screen recording", "detail", "reaction"],
    "source": "builtin",
}

_cache: list | None = None


def load_templates(force: bool = False) -> list:
    """Read templates.json (cached). Returns [] if the file is missing/broken so
    callers fall back to DEFAULT_TEMPLATE rather than crashing."""
    global _cache
    if _cache is not None and not force:
        return _cache
    try:
        with open(TEMPLATES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):  # a scalar/obj root must not crash callers
            data = []
        _cache = [t for t in data if isinstance(t, dict) and t.get("id")]
    except (FileNotFoundError, json.JSONDecodeError, OSError, TypeError, ValueError):
        _cache = []
    return _cache


def get_template(template_id: str) -> dict | None:
    """Return the template with this id, or None."""
    if not template_id:
        return None
    for t in load_templates():
        if t.get("id") == template_id:
            return t
    return None


def pick_template(platform: str = "") -> dict:
    """Pick a random template that fits the platform, for variety across videos.

    Falls back to DEFAULT_TEMPLATE when no templates are available.
    """
    templates = load_templates()
    if not templates:
        return DEFAULT_TEMPLATE

    def fits(t: dict) -> bool:
        plats = t.get("platforms") or []
        return not plats or "all" in plats or platform in plats

    eligible = [t for t in templates if fits(t)] or templates
    return random.choice(eligible)


# --- helpers that read template fields safely, applying DEFAULT_TEMPLATE gaps ---


def scene_count_range(template: dict) -> tuple:
    sc = (template or {}).get("scene_count") or DEFAULT_TEMPLATE["scene_count"]
    try:
        lo, hi = int(sc[0]), int(sc[1])
    except (TypeError, ValueError, IndexError):
        lo, hi = DEFAULT_TEMPLATE["scene_count"]
    lo = max(2, min(lo, 20))
    hi = max(lo, min(hi, 20))
    return lo, hi


def pacing_of(template: dict) -> dict:
    p = dict(DEFAULT_TEMPLATE["pacing"])
    p.update((template or {}).get("pacing") or {})
    return p


def caption_style_of(template: dict) -> str:
    return (template or {}).get("caption_style") or DEFAULT_TEMPLATE["caption_style"]


def caption_preset_of(template: dict) -> dict:
    """A full per-template caption treatment: base font, emphasis font (for the
    active/highlighted word -> two fonts in one video), text case, italic, position
    and size. Stable per template id so each template looks distinct."""
    t = template or {}
    key = (t.get("id") or t.get("label") or "default").encode("utf-8")
    preset = dict(CAPTION_PRESETS[int(hashlib.md5(key).hexdigest(), 16) % len(CAPTION_PRESETS)])
    if t.get("caption_font"):  # explicit template override of the base font
        preset["font"] = t["caption_font"]
    preset["fontsize"] = caption_size_of(t)
    return preset


def caption_size_of(template: dict):
    """Template's caption size, or one derived from pace (faster cut = bigger text)."""
    t = template or {}
    if t.get("caption_size"):
        return int(t["caption_size"])
    tcl = (t.get("pacing") or {}).get("target_cut_len", 0.9)
    return 80 if tcl < 0.7 else 68 if tcl <= 1.1 else 60
