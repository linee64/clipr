import asyncio

from fastapi import APIRouter, HTTPException
from models.schemas import IdeaRequest, IdeasResponse
from services.gemini import generate_ideas

router = APIRouter(prefix="/api/ideas", tags=["ideas"])


@router.post("/", response_model=IdeasResponse)
async def get_ideas(request: IdeaRequest):
    try:
        # Blocking Gemini call — run off the event loop so it can't freeze concurrent
        # requests (e.g. render-status polls) on the single worker.
        ideas = await asyncio.to_thread(
            generate_ideas,
            topic=request.topic,
            platform=request.platform,
            format=request.format,
            niche=request.niche,
            tone=request.tone,
        )
        return IdeasResponse(ideas=ideas)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
