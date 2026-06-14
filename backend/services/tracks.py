"""Built-in template tracks.

Any `.mp3` dropped into `backend/assets/tracks/` is auto-exposed as a selectable
template track, so creators without their own music can pick one. Optional
`tracks.json` next to the files overrides display name / vibe per track:

    { "<slug>": { "name": "Midnight Drive", "vibe": "dark ambient" } }

Tracks are lazily seeded into the same storage bucket the renderer reads from
(`audio/<slug>.mp3`), so the existing render path works unchanged whether the
selected audio came from an upload or a template.

On a deploy the `.mp3` files aren't shipped (they're gitignored). There the
CATALOG comes from `tracks.json` and the audio is served from the storage bucket
(seeded once from a machine that has the files), so the music library still works.
"""

import json
import re
import shutil
from pathlib import Path

from services.storage import (
    BACKEND_DIR,
    local_file_path,
    upload_file,
    use_local_storage,
)


def _bucket_url(remote_path: str) -> str | None:
    """Public URL for an object already in the storage bucket (no upload)."""
    if use_local_storage():
        return f"/api/video/files/{remote_path}"
    try:
        from services.storage import BUCKET, _get_supabase

        return _get_supabase().storage.from_(BUCKET).get_public_url(remote_path)
    except Exception:
        return None

ASSETS_TRACKS_DIR = BACKEND_DIR / "assets" / "tracks"
_OVERRIDES_FILE = ASSETS_TRACKS_DIR / "tracks.json"

# Track id -> playable url, cached once seeded this process so /tracks calls
# don't re-upload the same bytes.
_seeded: dict[str, str] = {}


def _slugify(stem: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return slug or "track"


def _display_name(stem: str) -> str:
    cleaned = re.sub(r"[_\-]+", " ", stem).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.title() if cleaned else stem


def _load_overrides() -> dict:
    if not _OVERRIDES_FILE.is_file():
        return {}
    try:
        data = json.loads(_OVERRIDES_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _track_files() -> list[Path]:
    if not ASSETS_TRACKS_DIR.is_dir():
        return []
    return sorted(p for p in ASSETS_TRACKS_DIR.glob("*.mp3") if p.is_file())


def _id_to_file() -> dict[str, Path]:
    """Map of track id -> source file, de-duplicating slug collisions."""
    mapping: dict[str, Path] = {}
    for path in _track_files():
        track_id = _slugify(path.stem)
        suffix = 2
        unique = track_id
        while unique in mapping:
            unique = f"{track_id}-{suffix}"
            suffix += 1
        mapping[unique] = path
    return mapping


def get_tracks() -> list[dict]:
    """Metadata for all template tracks (no storage side effects).

    Catalog = local `.mp3` files UNION `tracks.json` entries. On a deploy (no local
    files) the list comes entirely from `tracks.json`.
    """
    overrides = _load_overrides()
    out: dict[str, dict] = {}
    for track_id, path in _id_to_file().items():
        meta = overrides.get(track_id) or {}
        out[track_id] = {
            "id": track_id,
            "name": meta.get("name") or _display_name(path.stem),
            "vibe": meta.get("vibe") or "atmospheric",
        }
    for track_id, meta in overrides.items():
        if track_id not in out and isinstance(meta, dict):
            out[track_id] = {
                "id": track_id,
                "name": meta.get("name") or _display_name(track_id),
                "vibe": meta.get("vibe") or "atmospheric",
            }
    return list(out.values())


def is_template_track(track_id: str) -> bool:
    return track_id in _id_to_file() or track_id in _load_overrides()


async def ensure_track_seeded(track_id: str) -> str | None:
    """Copy the template track into storage at `audio/<id>.mp3` if absent.

    Returns a playable URL for the seeded track, or None if the id is unknown.
    Idempotent: skips work once seeded in this process (or already on local disk).
    """
    if track_id in _seeded:
        return _seeded[track_id]

    remote_path = f"audio/{track_id}.mp3"
    source = _id_to_file().get(track_id)
    if source is None:
        # No local file (e.g. on the deploy). If it's a known catalog track, its
        # audio already lives in the bucket — hand back the URL. Unknown ids
        # (e.g. a user-uploaded UUID) return None: a no-op, the render downloads
        # the already-uploaded file directly.
        if track_id not in _load_overrides():
            return None
        url = _bucket_url(remote_path)
        if url:
            _seeded[track_id] = url
        return url

    if use_local_storage():
        dest = local_file_path(remote_path)
        if not dest.is_file():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
        url = f"/api/video/files/{remote_path}"
    else:
        url = await upload_file(str(source), remote_path)

    _seeded[track_id] = url
    return url


async def get_tracks_with_urls() -> list[dict]:
    """Template tracks, each seeded into storage and given a playable url."""
    result: list[dict] = []
    for track in get_tracks():
        url = await ensure_track_seeded(track["id"])
        result.append({**track, "url": url or ""})
    return result
