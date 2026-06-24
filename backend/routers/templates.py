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

from services.storage import use_local_storage
from services.templates import is_premium_template, load_templates

router = APIRouter(prefix="/api/templates", tags=["templates"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
REF_DIR = BACKEND_DIR / "reference_videos"


def _platform_ok(t: dict, platform: str) -> bool:
    plats = t.get("platforms") or []
    return (not plats) or ("all" in plats) or (not platform) or (platform in plats)


def _ref_bucket_url(template_id: str) -> str:
    """Public URL for this template's reference video in the storage bucket.

    On a deploy the `reference_videos/*.mp4` aren't shipped (they're not in git),
    so the preview is served from storage at `references/<id>.mp4` (seeded once
    from a machine that has the files), mirroring how template tracks work.
    """
    if not template_id:
        return ""
    remote = f"references/{template_id}.mp4"
    if use_local_storage():
        return f"/api/video/files/{remote}"
    try:
        from services.storage import BUCKET, _get_supabase

        return _get_supabase().storage.from_(BUCKET).get_public_url(remote)
    except Exception:
        return ""


def _has_preview(t: dict) -> bool:
    preview = t.get("preview_file")
    if not preview:
        return False
    # Local file present (dev) OR a storage bucket to serve it from (deploy).
    return (REF_DIR / preview).is_file() or not use_local_storage()


def _preview_url(t: dict) -> str:
    """Where the frontend should load this reference video from.

    Prefer the on-disk file via the API (dev); fall back to the storage bucket
    when the file isn't shipped (deploy). Local filenames have spaces / '#' /
    emoji, so they're URL-encoded (else the browser treats '#' as a fragment).
    """
    preview = t.get("preview_file") or ""
    if preview and (REF_DIR / preview).is_file():
        return f"/api/templates/preview/{quote(preview, safe='')}"
    return _ref_bucket_url(t.get("id") or "")


def _public(t: dict) -> dict:
    return {
        "id": t.get("id"),
        "label": t.get("label"),
        # Pro-only reference style; the picker shows a lock for free users.
        "premium": is_premium_template(t),
        "caption_style": t.get("caption_style"),
        "color_grade": t.get("color_grade"),
        "music_vibe": t.get("music_vibe"),
        # The built-in track id that best fits this reference's vibe; the create flow
        # auto-selects it when the user picks this style (overridable).
        "recommended_track": t.get("recommended_track") or "",
        # When true, the create flow does NOT auto-pick music for this style — the
        # user must choose a track (library or upload) before rendering.
        "music_manual": bool(t.get("music_manual")),
        # Some reference styles depend on spoken phrases landing before/through their
        # signature text-card section, so the frontend must require AI voiceover.
        "require_voiceover": bool(t.get("require_voiceover")),
        "voiceover_message": t.get("voiceover_message") or "",
        # Work-in-progress style: shown in the picker but not selectable yet.
        "wip": bool(t.get("wip")),
        "pacing": t.get("pacing"),
        "measured": t.get("measured"),
        "preview_url": _preview_url(t) if _has_preview(t) else "",
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
