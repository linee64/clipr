"""Pexels stock-video search routes.

The clip *import* (download a picked Pexels video and store it as a render clip)
lives on the video router (/api/video/pexels-import) because it reuses that router's
clip-ingest pipeline; this router only owns the search.
"""

from fastapi import APIRouter, HTTPException, Query

from models.schemas import PexelsSearchResponse
from services import pexels

router = APIRouter(prefix="/api/pexels", tags=["pexels"])


@router.get("/search", response_model=PexelsSearchResponse)
async def search(
    query: str = Query(..., min_length=1, max_length=200),
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=40),
):
    """Search Pexels stock videos for a scene's "what to film" query."""
    try:
        return await pexels.search_videos(query, page=page, per_page=per_page)
    except pexels.PexelsNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except pexels.PexelsError as e:
        raise HTTPException(status_code=502, detail=str(e))
