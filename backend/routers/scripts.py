from fastapi import APIRouter, HTTPException
from models.schemas import ScriptRequest, ScriptResponse
from services.gemini import generate_script

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


@router.post("/", response_model=ScriptResponse)
async def get_script(request: ScriptRequest):
    try:
        script = generate_script(
            idea_title=request.idea_title,
            hook_preview=request.hook_preview,
            platform=request.platform,
            tone=request.tone,
            niche=request.niche
        )
        return ScriptResponse(**script)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
