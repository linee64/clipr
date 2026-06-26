"""Video-style templates: a small JSON-backed "database" of montage patterns.

Each template encodes how a video is built — scene count, cut pacing, caption
style, color grade, phrase length/tone, structure and shot variety — so the
storyboard generator and the montage worker can rotate among distinct looks
instead of producing the same edit every time. New templates are appended by the
reference-video extractor (scripts/build_templates.py)."""

import hashlib
import json
import os
import random
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_PATH = BACKEND_DIR / "templates" / "templates.json"

# Global rule: no finished video is longer than this. Enforced both when the
# storyboard is generated (services/gemini.py) and as a render-time safety net
# (workers/render.py + scripts/local_render.py), so every video — whatever the
# template, scene count, or how the scenes were supplied — stays within the cap.
MAX_VIDEO_SECONDS = 20.0

# Caption presets: each template gets a DISTINCT subtitle treatment, not just a
# font. We vary base font, an emphasis font for the active/highlighted word (so a
# single video shows two fonts, like the references do), text case, italic, and
# on-screen position (alignment 2=bottom, 5=middle, 8=top). All faces are from the
# msttcorefonts family (serif / mono / casual / heavy-sans for real contrast) so
# they exist on Windows AND on a Linux render host with msttcorefonts installed.
# NOTE (prod): a bare Linux image WITHOUT msttcorefonts substitutes one default face
# for all of these — captions still render but the variety is lost; install
# msttcorefonts (or bundle .ttf + fontsdir) on the render host.
# Each pair is intentionally HARMONIOUS — base + emphasis share a vibe (clean sans +
# heavier sans, or a classic serif + bold sans) — and sits in a normal short-form
# position (lower third = alignment 2 + marginV; or centered = alignment 5). No mono,
# no Comic Sans, no top placement: those read as "off" vs real references.
CAPTION_PRESETS = [
    {"font": "Verdana", "emphasis_font": "Arial Black", "uppercase": False, "italic": False, "alignment": 2, "outline": 0, "marginv": 300},
    {"font": "Impact", "emphasis_font": "Arial Black", "uppercase": True, "italic": False, "alignment": 2, "outline": 0, "marginv": 300},
    {"font": "Impact", "emphasis_font": "Impact", "uppercase": True, "italic": False, "alignment": 5, "outline": 0, "marginv": 0},
    {"font": "Georgia", "emphasis_font": "Arial Black", "uppercase": False, "italic": False, "alignment": 2, "outline": 0, "marginv": 300},
    {"font": "Trebuchet MS", "emphasis_font": "Georgia", "uppercase": False, "italic": False, "alignment": 5, "outline": 0, "marginv": 0},
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
_cache_mtime: float | None = None


def load_templates(force: bool = False) -> list:
    """Read templates.json (cached, auto-reloading when the file changes).

    The cache is invalidated whenever templates.json's modification time changes, so
    editing a template takes effect on the next render WITHOUT restarting a long-lived
    process (e.g. the FastAPI server) — otherwise a running server keeps serving the
    template values it read at startup. Returns [] if the file is missing/broken so
    callers fall back to DEFAULT_TEMPLATE rather than crashing."""
    global _cache, _cache_mtime
    try:
        mtime = os.path.getmtime(TEMPLATES_PATH)
    except OSError:
        mtime = None
    if _cache is not None and not force and mtime == _cache_mtime:
        return _cache
    try:
        with open(TEMPLATES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):  # a scalar/obj root must not crash callers
            data = []
        _cache = [t for t in data if isinstance(t, dict) and t.get("id")]
    except (FileNotFoundError, json.JSONDecodeError, OSError, TypeError, ValueError):
        _cache = []
    _cache_mtime = mtime
    return _cache


def get_template(template_id: str) -> dict | None:
    """Return the template with this id, or None."""
    if not template_id:
        return None
    for t in load_templates():
        if t.get("id") == template_id:
            return t
    return None


# Reference styles reserved for Pro subscribers — matched on the (clean) reference
# name so they gate by name regardless of template id, and so new references with
# these names become Pro-only automatically once added.
PREMIUM_REF_TITLES = ("locked in", "the feeling of building", "boring life")


def is_premium_template(t: dict) -> bool:
    title = ((t or {}).get("ref") or (t or {}).get("label") or "").strip().lower()
    if title.startswith("ref:"):
        title = title[4:].strip()
    return any(key in title for key in PREMIUM_REF_TITLES)


def is_premium_template_id(template_id: str) -> bool:
    return is_premium_template(get_template(template_id) or {})


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


def cap_total_duration(
    scenes: list,
    max_total: float = MAX_VIDEO_SECONDS,
    as_int: bool = False,
    min_scene: float = 2.0,
    allow_trim: bool = True,
) -> list:
    """Ensure the scenes' total duration never exceeds ``max_total`` seconds.

    If already within the cap the input is returned unchanged. Otherwise the
    montage is brought under the cap by (1) — only when ``allow_trim`` — trimming
    scene COUNT, keeping the opening scene(s) plus the final "punch", to at most
    ``max_total / min_scene`` scenes, then (2) scaling the remaining durations down
    proportionally (never below ``min_scene``).

    ``as_int`` rounds durations to whole seconds (the storyboard schema uses int
    seconds); the renderer uses floats for exactness. Set ``allow_trim=False`` at
    render time, where scenes are already paired 1:1 with uploaded clips and the
    count must NOT change (scale durations only). Scene ``order`` is renumbered.
    """
    items = [s for s in (scenes or []) if isinstance(s, dict)]
    if not items:
        return scenes if scenes is not None else []

    def _dur(s) -> float:
        try:
            return max(0.1, float(s.get("duration_seconds", 3) or 3))
        except (TypeError, ValueError):
            return 3.0

    if sum(_dur(s) for s in items) <= max_total:
        return scenes  # already within the cap — leave the objects untouched

    # 1) cap the number of scenes (keep the lead-in + the punch/last scene)
    if allow_trim:
        max_n = max(2, int(max_total // max(0.5, min_scene)))
        if len(items) > max_n:
            items = items[: max_n - 1] + [items[-1]]

    # 2) scale durations to fit. When trimming is disabled (render), allow a smaller
    #    floor so a high scene count can still be scaled under the cap.
    floor = min_scene if allow_trim else min(min_scene, 0.5)
    total = sum(_dur(s) for s in items)
    scale = min(1.0, max_total / total) if total > 0 else 1.0
    out: list = []
    for i, s in enumerate(items, 1):
        s2 = dict(s)
        v = max(floor, _dur(s) * scale)
        s2["duration_seconds"] = int(round(v)) if as_int else round(v, 3)
        s2["order"] = i
        out.append(s2)
    return out


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
    # Optional explicit caption treatment (read only when present so the hash-based
    # default for every other template is byte-identical). Lets a reference template
    # fully pin its caption look — e.g. "Locked in": Arial Black, bold off, white,
    # centered, no mint highlight, with a fade-in pop.
    if t.get("caption_bold") is not None:
        preset["bold"] = int(t["caption_bold"])
    if t.get("caption_alignment") is not None:
        preset["alignment"] = int(t["caption_alignment"])
    if t.get("caption_marginv") is not None:
        preset["marginv"] = int(t["caption_marginv"])
    if t.get("caption_outline") is not None:
        preset["outline"] = int(t["caption_outline"])
    if t.get("caption_shadow") is not None:
        preset["shadow"] = int(t["caption_shadow"])
    if t.get("caption_uppercase") is not None:
        preset["uppercase"] = bool(t["caption_uppercase"])
    if t.get("caption_italic") is not None:
        preset["italic"] = bool(t["caption_italic"])
    if t.get("caption_fade_ms"):
        preset["fade_ms"] = list(t["caption_fade_ms"])
    # Kinetic caption fields (caption_style "kinetic") — multi-position white-sans +
    # red-serif word chunks. Read only when present so other templates are unaffected.
    if t.get("caption_sans_font"):
        preset["sans_font"] = t["caption_sans_font"]
    if t.get("caption_serif_font"):
        preset["serif_font"] = t["caption_serif_font"]
    if t.get("caption_accent_color"):
        preset["accent_color"] = t["caption_accent_color"]
    if t.get("caption_accent_size"):
        preset["accent_size"] = int(t["caption_accent_size"])
    if t.get("caption_positions"):
        preset["positions"] = [tuple(pos) for pos in t["caption_positions"]]
    if t.get("caption_accent_words"):
        preset["accent_words"] = list(t["caption_accent_words"])
    if t.get("caption_uppercase_emphasis") is not None:
        preset["uppercase_emphasis"] = bool(t["caption_uppercase_emphasis"])
    if t.get("caption_kinetic_groups") is not None:
        preset["kinetic_groups"] = int(t["caption_kinetic_groups"])
    # Kinetic "stack" mode: build-and-hold left-stacked lines on the beat, mixing a
    # high-contrast serif body with a script accent face (the "I don't care" look).
    if t.get("caption_stack") is not None:
        preset["kinetic_stack"] = bool(t["caption_stack"])
    if t.get("caption_stack_wrap") is not None:
        preset["stack_wrap"] = int(t["caption_stack_wrap"])
    if t.get("caption_stack_maxchars") is not None:
        preset["stack_maxchars"] = int(t["caption_stack_maxchars"])
    if t.get("caption_stack_open_gap") is not None:
        preset["stack_open_gap"] = float(t["caption_stack_open_gap"])
    if t.get("caption_stack_open_until") is not None:
        preset["stack_open_until"] = float(t["caption_stack_open_until"])
    if t.get("caption_stack_bold") is not None:
        preset["stack_bold"] = bool(t["caption_stack_bold"])
    # Karaoke active-word controls: a template can disable the 2nd (emphasis) font
    # ("" = use the base font) and override the mint active colour (e.g. white for an
    # all-white word-by-word build).
    if t.get("caption_emphasis_font") is not None:
        preset["emphasis_font"] = t["caption_emphasis_font"]
    if t.get("caption_active_color"):
        preset["active_color"] = t["caption_active_color"]
    if t.get("caption_letter_spacing") is not None:
        preset["letter_spacing"] = float(t["caption_letter_spacing"])
    if t.get("caption_italic_words"):
        preset["italic_words"] = [str(w).lower() for w in t["caption_italic_words"]]
    if t.get("caption_scale_x") is not None:
        preset["scale_x"] = float(t["caption_scale_x"])
    if t.get("caption_scale_y") is not None:
        preset["scale_y"] = float(t["caption_scale_y"])
    if t.get("caption_chunk_words") is not None:
        preset["chunk_words"] = int(t["caption_chunk_words"])
    if t.get("caption_wrap_words") is not None:
        preset["wrap_words"] = int(t["caption_wrap_words"])
    if t.get("caption_fontcycle_intro"):
        preset["fontcycle_intro"] = t["caption_fontcycle_intro"]
    if t.get("caption_intro_text"):
        preset["intro_text"] = t["caption_intro_text"]
    if t.get("caption_intro_dur") is not None:
        preset["intro_dur"] = float(t["caption_intro_dur"])
    preset["fontsize"] = caption_size_of(t)
    return preset


def caption_size_of(template: dict):
    """Template's caption size, or one derived from pace (faster cut = bigger text)."""
    t = template or {}
    if t.get("caption_size"):
        return int(t["caption_size"])
    tcl = (t.get("pacing") or {}).get("target_cut_len", 0.9)
    return 80 if tcl < 0.7 else 68 if tcl <= 1.1 else 60
