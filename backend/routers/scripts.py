from fastapi import APIRouter, HTTPException
from models.schemas import VisualScriptRequest, VisualScriptResponse
from services.gemini import generate_visual_script
from services.templates import pick_template

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


@router.post("/visual", response_model=VisualScriptResponse)
async def get_visual_script(request: VisualScriptRequest):
    try:
        # Pick a style template so each storyboard (and its montage) varies.
        template = pick_template(request.platform)
        script = generate_visual_script(
            idea_title=request.idea_title,
            hook_phrase=request.hook_phrase,
            platform=request.platform,
            tone=request.tone,
            niche=request.niche,
            template=template,
        )
        script["template_id"] = template.get("id", "")
        return VisualScriptResponse(**script)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
