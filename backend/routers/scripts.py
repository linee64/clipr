from fastapi import APIRouter, HTTPException
from models.schemas import VisualScriptRequest, VisualScriptResponse
from services.gemini import generate_visual_script

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


@router.post("/visual", response_model=VisualScriptResponse)
async def get_visual_script(request: VisualScriptRequest):
    try:
        script = generate_visual_script(
            idea_title=request.idea_title,
            hook_phrase=request.hook_phrase,
            platform=request.platform,
            tone=request.tone,
            niche=request.niche,
        )
        return VisualScriptResponse(**script)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
