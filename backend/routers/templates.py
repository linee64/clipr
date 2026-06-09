"""Endpoints for the style-template picker shown before render.

The frontend shows a few example videos (the reference clips a template was
extracted from); the user picks the look they want and that template_id is sent
to /broll-render, which wraps their footage in that template's pacing / captions /
grade.
"""

import random
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from services.templates import load_templates

router = APIRouter(prefix="/api/templates", tags=["templates"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
REF_DIR = BACKEND_DIR / "reference_videos"


def _platform_ok(t: dict, platform: str) -> bool:
    plats = t.get("platforms") or []
    return (not plats) or ("all" in plats) or (not platform) or (platform in plats)


def _has_preview(t: dict) -> bool:
    preview = t.get("preview_file")
    return bool(preview) and (REF_DIR / preview).is_file()


def _public(t: dict) -> dict:
    preview = t.get("preview_file") or ""
    # Only expose a preview URL when the file actually exists, so a stale entry
    # shows the frontend placeholder instead of a broken <video>. Filenames have
    # spaces / '#' / emoji, so they must be URL-encoded (else the browser treats
    # '#' as a fragment and never reaches the server).
    return {
        "id": t.get("id"),
        "label": t.get("label"),
        "caption_style": t.get("caption_style"),
        "color_grade": t.get("color_grade"),
        "music_vibe": t.get("music_vibe"),
        "pacing": t.get("pacing"),
        "measured": t.get("measured"),
        "preview_url": (
            f"/api/templates/preview/{quote(preview, safe='')}" if _has_preview(t) else ""
        ),
    }


def _previewable(platform: str = "") -> list:
    """Templates that have an existing reference video to show as a preview."""
    return [t for t in load_templates() if _has_preview(t) and _platform_ok(t, platform)]


@router.get("/all")
async def all_templates(platform: str = ""):
    """All reference-backed templates (for the References tab)."""
    pool = _previewable(platform)
    return {"templates": [_public(t) for t in pool], "total": len(pool)}


@router.get("/sample")
async def sample_templates(platform: str = "", count: int = 3, exclude: str = ""):
    """Return up to `count` random preview-able templates, skipping `exclude` ids.

    `exclude` is a comma-separated id list so the UI's "shuffle" button can ask for
    different ones; when the pool runs out we wrap around to the full set.
    """
    excluded = {x for x in exclude.split(",") if x}
    pool = _previewable(platform)
    if not pool:
        # no reference videos for this platform -> text-only cards, still platform-filtered
        pool = [t for t in load_templates() if _platform_ok(t, platform)]
    if not pool:
        return {"templates": [], "total": 0}

    remaining = [t for t in pool if t.get("id") not in excluded]
    if len(remaining) < count:
        remaining = pool  # exhausted the un-seen set; allow repeats again

    k = max(0, min(count, len(remaining)))  # clamp: negative count must not crash
    picks = random.sample(remaining, k)
    return {"templates": [_public(t) for t in picks], "total": len(pool)}


@router.get("/preview/{filename}")
async def template_preview(filename: str):
    """Stream a reference video. Only filenames that belong to a known template are
    served (whitelist), which also prevents path traversal."""
    allowed = {t.get("preview_file") for t in load_templates() if t.get("preview_file")}
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="Unknown preview")
    path = REF_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Preview not found")
    return FileResponse(path, media_type="video/mp4")
