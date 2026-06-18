from fastapi import APIRouter, HTTPException
from models.schemas import VisualScriptRequest, VisualScriptResponse
from services import usage
from services.gemini import generate_visual_script
from services.templates import pick_template

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


@router.post("/visual", response_model=VisualScriptResponse)
async def get_visual_script(request: VisualScriptRequest):
    # Server-side free-tier gate: a regeneration is metered (the first generation of
    # an idea is free). Pro is unlimited; over the limit returns 429 so the frontend
    # can prompt an upgrade.
    if request.regenerate:
        try:
            await usage.consume(request.email, "regen")
        except usage.QuotaExceeded as e:
            raise HTTPException(
                status_code=429,
                detail=f"You've used your {e.limit} free storyboard regenerations. Upgrade to Pro for unlimited.",
            )
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
