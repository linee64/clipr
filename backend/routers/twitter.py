"""X (Twitter) auto-posting endpoints.

Connect flow (OAuth2 PKCE, all owned by the backend):
  GET  /api/twitter/login     -> { authorize_url } ; frontend sends the browser there
  GET  /api/twitter/callback  -> X redirects here (via the frontend passthrough route);
                                 we swap the code for tokens, store them, and 302 the
                                 browser back to the dashboard.
  GET  /api/twitter/status    -> { connected, username, name, configured }
  POST /api/twitter/post      -> fetch a rendered video, upload it, publish the post
  POST /api/twitter/disconnect-> forget the connected account
"""

import logging
import os
import uuid
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from models.schemas import TwitterPostRequest
from services import twitter
from services.storage import BUCKET, download_file

router = APIRouter(prefix="/api/twitter", tags=["twitter"])
logger = logging.getLogger("clipr.twitter")

TEMP_DIR = str(Path(__file__).resolve().parent.parent / "temp")
os.makedirs(TEMP_DIR, exist_ok=True)


def _supabase_public_prefix() -> str:
    """Allowed prefix for an http(s) output_url — the bucket's public object path.

    The renderer's output_url is always a Supabase public URL (prod) under this
    prefix, so anything else on the http(s) branch is rejected. This keeps the
    unauthenticated /post endpoint from being turned into an SSRF fetch primitive.
    """
    base = (os.getenv("SUPABASE_URL") or "").strip().strip('"').strip("'").rstrip("/")
    return f"{base}/storage/v1/object/public/{BUCKET}/" if base else ""


@router.get("/login")
async def login(cid: str = ""):
    """Return the X authorize URL to send the user to (frontend redirects).

    cid scopes the connection to this browser (see services.twitter).
    """
    try:
        return {"authorize_url": await twitter.build_authorize_url(cid)}
    except twitter.TwitterNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except twitter.TwitterError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/callback")
async def callback(code: str = "", state: str = "", error: str = ""):
    """OAuth redirect target. Finish the exchange, then bounce back to the dashboard."""
    dashboard = twitter._post_connect_url()

    def _to(params: str) -> RedirectResponse:
        sep = "&" if "?" in dashboard else "?"
        return RedirectResponse(url=f"{dashboard}{sep}{params}", status_code=302)

    if error:
        # `error` is a provider OAuth error code (e.g. access_denied) — safe & short.
        return _to(f"x_error={quote(error[:60])}")
    if not code or not state:
        return _to("x_error=missing_code")
    try:
        await twitter.exchange_code(code, state)
        return _to("x_connected=1")
    except twitter.TwitterError as e:
        # TwitterError messages are curated/safe (no raw provider bodies or secrets).
        logger.warning("X connect failed: %s", e)
        return _to(f"x_error={quote(str(e)[:160])}")
    except Exception:
        logger.exception("Unexpected error finishing X OAuth")
        return _to("x_error=connect_failed")


@router.get("/status")
async def status(cid: str = ""):
    return await twitter.get_status(cid)


@router.post("/disconnect")
async def disconnect(cid: str = ""):
    await twitter.disconnect(cid)
    return {"connected": False}


async def _download_video(output_url: str, dest: str) -> None:
    """Pull the rendered video bytes to a local temp file.

    output_url is whatever the render returned: a full Supabase public URL (prod) or
    a /api/video/files/<remote> path (local dev). Handle both.
    """
    if output_url.startswith("http://") or output_url.startswith("https://"):
        prefix = _supabase_public_prefix()
        if not prefix or not output_url.startswith(prefix):
            raise twitter.TwitterError("Refusing to fetch the video from an unrecognized location.")
        # follow_redirects=False so an allowed URL can't 30x into an internal host.
        async with httpx.AsyncClient(timeout=180, follow_redirects=False) as client:
            resp = await client.get(output_url)
            if resp.status_code != 200:
                raise twitter.TwitterError(
                    f"Couldn't fetch the video ({resp.status_code}) from storage."
                )
            with open(dest, "wb") as f:
                f.write(resp.content)
        return
    # Relative path served locally — map back to the storage remote key.
    remote = output_url.split("/api/video/files/", 1)[-1].lstrip("/")
    if not remote:
        raise twitter.TwitterError("Unrecognized video URL.")
    await download_file(remote, dest)


@router.post("/post")
async def post(request: TwitterPostRequest):
    """Publish a rendered video to the connected X account."""
    if not request.output_url:
        raise HTTPException(status_code=400, detail="output_url is required")

    local_path = os.path.join(TEMP_DIR, f"xpost_{uuid.uuid4().hex}.mp4")
    try:
        await _download_video(request.output_url, local_path)
        result = await twitter.post_video(local_path, request.caption, request.cid)
        return result
    except twitter.TwitterNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except twitter.TwitterNotConnected as e:
        raise HTTPException(status_code=400, detail=str(e))
    except twitter.TwitterError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)
