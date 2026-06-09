"""Video-style templates: a small JSON-backed "database" of montage patterns.

Each template encodes how a video is built — scene count, cut pacing, caption
style, color grade, phrase length/tone, structure and shot variety — so the
storyboard generator and the montage worker can rotate among distinct looks
instead of producing the same edit every time. New templates are appended by the
reference-video extractor (scripts/build_templates.py)."""

import json
import random
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_PATH = BACKEND_DIR / "templates" / "templates.json"

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
