"""Pexels stock-video search + per-video file resolution.

Lets a creator fill a scene's clip slot from Pexels' free stock library instead of
shooting/uploading their own footage. The service only talks to Pexels' own API/CDN;
the import route (routers/video.py) re-resolves the download link here from a video
id so the server never fetches an arbitrary client-supplied URL (SSRF-safe).

Config: PEXELS_API_KEY in backend/.env. Missing key -> is_configured() is False and
the search/import routes return a clear 503 instead of crashing the server.
"""

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _env(name: str) -> str:
    # .env values may be quoted — strip wrapping quotes/whitespace (mirrors the
    # other services so a copy-pasted, quoted key still works).
    return (os.getenv(name) or "").strip().strip('"').strip("'")


PEXELS_API_KEY = _env("PEXELS_API_KEY")
_API = "https://api.pexels.com/videos"
# A b-roll clip never needs more than ~1080p (the render caps there); aim for a
# vertical file near this long edge so we don't download 4K we'd only downscale.
_TARGET_LONG_EDGE = 1920


class PexelsNotConfigured(RuntimeError):
    """PEXELS_API_KEY is missing/placeholder."""


class PexelsError(RuntimeError):
    """Pexels API returned an error or unexpected payload."""


def is_configured() -> bool:
    return bool(PEXELS_API_KEY) and PEXELS_API_KEY not in (
        "your_pexels_api_key",
        "your_key_here",
    )


def _require_configured() -> None:
    if not is_configured():
        raise PexelsNotConfigured(
            "PEXELS_API_KEY is not configured on the server. Add it to backend/.env."
        )


def _headers() -> dict:
    return {"Authorization": PEXELS_API_KEY}


def _as_int(value) -> int:
    """Coerce a possibly-missing/odd Pexels field to int, never raising — the API is
    external, so a malformed width/duration must not 500 the request. Rounds floats
    (Pexels durations are floats, e.g. 5.8 -> 6) instead of truncating."""
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def _long_edge(f: dict) -> int:
    return max(_as_int(f.get("width")), _as_int(f.get("height")))


def _is_portrait(f: dict) -> bool:
    return _as_int(f.get("height")) >= _as_int(f.get("width"))


def pick_download_file(video: dict) -> str:
    """Choose the best mp4 file link from a Pexels video's `video_files`.

    Prefers a vertical (9:16-ish) file whose long edge is closest to 1080-1920, so the
    montage gets portrait footage without pulling a needlessly huge 4K source. Falls
    back to any mp4, then to whatever's available.
    """
    files = video.get("video_files") or []
    mp4s = [
        f
        for f in files
        if (f.get("file_type") == "video/mp4")
        or str(f.get("link", "")).split("?")[0].lower().endswith(".mp4")
    ]
    pool = mp4s or files
    if not pool:
        raise PexelsError("Pexels video has no downloadable files.")
    portrait = [f for f in pool if _is_portrait(f)]
    pool = portrait or pool
    best = min(pool, key=lambda f: abs(_long_edge(f) - _TARGET_LONG_EDGE))
    link = best.get("link")
    if not link:
        raise PexelsError("Pexels video file has no link.")
    return link


def _preview_link(video: dict) -> str:
    """A small mp4 (sd, smallest) for an inline hover/click preview in the picker."""
    files = video.get("video_files") or []
    mp4s = [f for f in files if f.get("file_type") == "video/mp4"]
    pool = mp4s or files
    if not pool:
        return ""
    sd = [f for f in pool if str(f.get("quality")) == "sd"] or pool
    return min(sd, key=_long_edge).get("link", "")


def _normalize(video: dict) -> dict:
    """Shape a Pexels video into the lean object the frontend picker needs."""
    user = video.get("user") or {}
    return {
        "id": _as_int(video.get("id")),
        "image": str(video.get("image") or ""),
        "preview": _preview_link(video),
        "duration": _as_int(video.get("duration")),
        "width": _as_int(video.get("width")),
        "height": _as_int(video.get("height")),
        "user_name": str(user.get("name") or ""),
    }


async def search_videos(
    query: str, page: int = 1, per_page: int = 15, orientation: str = "portrait"
) -> dict:
    """Search Pexels for stock videos matching `query` (the scene's "what to film")."""
    _require_configured()
    q = (query or "").strip()
    if not q:
        raise PexelsError("Empty search query.")
    params = {
        "query": q,
        "page": max(1, int(page)),
        "per_page": min(40, max(1, int(per_page))),
        "orientation": orientation,
        "size": "medium",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{_API}/search", params=params, headers=_headers()
            )
    except httpx.HTTPError as e:
        raise PexelsError(f"Pexels request failed: {e}") from e
    if resp.status_code == 401:
        raise PexelsNotConfigured("Pexels rejected the API key (401).")
    if resp.status_code != 200:
        raise PexelsError(f"Pexels search failed ({resp.status_code}).")
    data = resp.json()
    videos = [_normalize(v) for v in (data.get("videos") or [])]
    return {
        "videos": videos,
        "page": int(data.get("page") or page),
        "total_results": int(data.get("total_results") or len(videos)),
    }


async def get_download_url(video_id: int) -> str:
    """Resolve a single Pexels video id to its best mp4 CDN link (server-side, so the
    import route never downloads an arbitrary client URL)."""
    _require_configured()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{_API}/videos/{int(video_id)}", headers=_headers()
            )
    except httpx.HTTPError as e:
        raise PexelsError(f"Pexels request failed: {e}") from e
    if resp.status_code == 404:
        raise PexelsError(f"Pexels video {video_id} not found.")
    if resp.status_code == 401:
        raise PexelsNotConfigured("Pexels rejected the API key (401).")
    if resp.status_code != 200:
        raise PexelsError(f"Pexels lookup failed ({resp.status_code}).")
    return pick_download_file(resp.json())
