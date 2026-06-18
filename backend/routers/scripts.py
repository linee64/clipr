import asyncio

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
        # Reserve the credit atomically up front (429 if over the limit) so concurrent
        # regens can't slip past the cap; we refund below if generation fails, so a
        # transient model/format error never costs the user a free regeneration.
        try:
            await usage.reserve(request.email, "regen")
        except usage.QuotaExceeded as e:
            raise HTTPException(
                status_code=429,
                detail=f"You've used your {e.limit} free storyboard regenerations. Upgrade to Pro for unlimited.",
            )
    try:
        # Pick a style template so each storyboard (and its montage) varies.
        template = pick_template(request.platform)
        # generate_visual_script makes a blocking (multi-second) Gemini HTTP call; run it
        # off the event loop so it doesn't freeze every other request (e.g. render polls).
        script = await asyncio.to_thread(
            generate_visual_script,
            idea_title=request.idea_title,
            hook_phrase=request.hook_phrase,
            platform=request.platform,
            tone=request.tone,
            niche=request.niche,
            template=template,
        )
        script["template_id"] = template.get("id", "")
        response = VisualScriptResponse(**script)
    except Exception as e:
        # Release the reserved regen so a failed generation doesn't burn a free credit.
        if request.regenerate:
            await usage.refund(request.email, "regen")
        raise HTTPException(status_code=500, detail=str(e))
    return response
