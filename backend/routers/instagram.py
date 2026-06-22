"""Instagram Reels connect + auto-posting endpoints.

Mirrors routers/linkedin.py — same five endpoints and OAuth passthrough pattern.
"""

import logging
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from models.schemas import InstagramPostRequest
from services import instagram

router = APIRouter(prefix="/api/instagram", tags=["instagram"])
logger = logging.getLogger("clipr.instagram")


@router.get("/login")
async def login(cid: str = ""):
    try:
        return {"authorize_url": await instagram.build_authorize_url(cid)}
    except instagram.InstagramNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except instagram.InstagramError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/callback")
async def callback(code: str = "", state: str = "", error: str = ""):
    dashboard = instagram._post_connect_url()

    def _to(params: str) -> RedirectResponse:
        sep = "&" if "?" in dashboard else "?"
        return RedirectResponse(url=f"{dashboard}{sep}{params}", status_code=302)

    if error:
        return _to(f"ig_error={quote(error[:60])}")
    if not code or not state:
        return _to("ig_error=missing_code")
    try:
        await instagram.exchange_code(code, state)
        return _to("ig_connected=1")
    except instagram.InstagramError as e:
        logger.warning("Instagram connect failed: %s", e)
        return _to(f"ig_error={quote(str(e)[:160])}")
    except Exception:
        logger.exception("Unexpected error finishing Instagram OAuth")
        return _to("ig_error=connect_failed")


@router.get("/status")
async def status(cid: str = ""):
    return await instagram.get_status(cid)


@router.post("/disconnect")
async def disconnect(cid: str = ""):
    await instagram.disconnect(cid)
    return {"connected": False}


@router.post("/post")
async def post(request: InstagramPostRequest):
    """Publish a rendered video as an Instagram Reel."""
    if not request.output_url:
        raise HTTPException(status_code=400, detail="output_url is required")
    try:
        return await instagram.post_reel(request.output_url, request.caption, request.cid)
    except instagram.InstagramNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except instagram.InstagramNotConnected as e:
        raise HTTPException(status_code=400, detail=str(e))
    except instagram.InstagramError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
