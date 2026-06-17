"""LinkedIn connect + auto-posting endpoints.

Connect flow (OAuth2 Authorization Code, all owned by the backend):
  GET  /api/linkedin/login      -> { authorize_url } ; frontend sends the browser there
  GET  /api/linkedin/callback   -> LinkedIn redirects here (via the frontend passthrough
                                   route); we swap the code for a token, store it, and
                                   302 the browser back to the dashboard.
  GET  /api/linkedin/status     -> { connected, name, member_id, configured }
  POST /api/linkedin/post       -> fetch a rendered video, upload it, publish the post
  POST /api/linkedin/disconnect -> forget the connected account

Mirrors routers/twitter.py so the frontend can treat both the same way.
"""

import logging
import os
import uuid
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from models.schemas import LinkedInPostRequest
from services import linkedin
from services.storage import BUCKET, download_file

router = APIRouter(prefix="/api/linkedin", tags=["linkedin"])
logger = logging.getLogger("clipr.linkedin")

TEMP_DIR = str(Path(__file__).resolve().parent.parent / "temp")
os.makedirs(TEMP_DIR, exist_ok=True)


def _supabase_public_prefix() -> str:
    """Allowed prefix for an http(s) output_url — the bucket's public object path.

    Keeps the unauthenticated /post endpoint from being turned into an SSRF fetch
    primitive (only our own rendered videos can be fetched). Mirrors routers/twitter.
    """
    base = (os.getenv("SUPABASE_URL") or "").strip().strip('"').strip("'").rstrip("/")
    return f"{base}/storage/v1/object/public/{BUCKET}/" if base else ""


@router.get("/login")
async def login(cid: str = ""):
    """Return the LinkedIn authorize URL to send the user to (frontend redirects).

    cid scopes the connection to this browser (see services.linkedin).
    """
    try:
        return {"authorize_url": await linkedin.build_authorize_url(cid)}
    except linkedin.LinkedInNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except linkedin.LinkedInError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/callback")
async def callback(code: str = "", state: str = "", error: str = ""):
    """OAuth redirect target. Finish the exchange, then bounce back to the dashboard."""
    dashboard = linkedin._post_connect_url()

    def _to(params: str) -> RedirectResponse:
        sep = "&" if "?" in dashboard else "?"
        return RedirectResponse(url=f"{dashboard}{sep}{params}", status_code=302)

    if error:
        return _to(f"li_error={quote(error[:60])}")
    if not code or not state:
        return _to("li_error=missing_code")
    try:
        await linkedin.exchange_code(code, state)
        return _to("li_connected=1")
    except linkedin.LinkedInError as e:
        logger.warning("LinkedIn connect failed: %s", e)
        return _to(f"li_error={quote(str(e)[:160])}")
    except Exception:
        logger.exception("Unexpected error finishing LinkedIn OAuth")
        return _to("li_error=connect_failed")


@router.get("/status")
async def status(cid: str = ""):
    return await linkedin.get_status(cid)


@router.post("/disconnect")
async def disconnect(cid: str = ""):
    await linkedin.disconnect(cid)
    return {"connected": False}


async def _download_video(output_url: str, dest: str) -> None:
    """Pull the rendered video bytes to a local temp file (Supabase public URL in prod,
    /api/video/files/<remote> path in local dev). Mirrors routers/twitter."""
    if output_url.startswith("http://") or output_url.startswith("https://"):
        prefix = _supabase_public_prefix()
        if not prefix or not output_url.startswith(prefix):
            raise linkedin.LinkedInError("Refusing to fetch the video from an unrecognized location.")
        async with httpx.AsyncClient(timeout=180, follow_redirects=False) as client:
            resp = await client.get(output_url)
            if resp.status_code != 200:
                raise linkedin.LinkedInError(
                    f"Couldn't fetch the video ({resp.status_code}) from storage."
                )
            with open(dest, "wb") as f:
                f.write(resp.content)
        return
    remote = output_url.split("/api/video/files/", 1)[-1].lstrip("/")
    if not remote:
        raise linkedin.LinkedInError("Unrecognized video URL.")
    await download_file(remote, dest)


@router.post("/post")
async def post(request: LinkedInPostRequest):
    """Publish a rendered video to the connected LinkedIn account."""
    if not request.output_url:
        raise HTTPException(status_code=400, detail="output_url is required")

    local_path = os.path.join(TEMP_DIR, f"lipost_{uuid.uuid4().hex}.mp4")
    try:
        await _download_video(request.output_url, local_path)
        return await linkedin.post_video(local_path, request.caption, request.cid)
    except linkedin.LinkedInNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except linkedin.LinkedInNotConnected as e:
        raise HTTPException(status_code=400, detail=str(e))
    except linkedin.LinkedInError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)
