import asyncio

from fastapi import APIRouter, HTTPException
from models.schemas import VisualScriptRequest, VisualScriptResponse
from services import usage
from pydantic import BaseModel
from services.gemini import generate_visual_script, generate_byoc_script
from services.templates import pick_template

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


class BYOCScriptRequest(BaseModel):
    context: str
    scene_count: int
    email: str = None
    ref_subtitles: list[str] | None = None
    avg_words_per_line: int = 4
    subtitle_pattern: dict | None = None
    scene_contexts: list[str] | None = None


@router.post("/byoc")
async def get_byoc_script(request: BYOCScriptRequest):
    try:
        script = await asyncio.to_thread(
            generate_byoc_script,
            context=request.context,
            scene_count=request.scene_count,
            ref_subtitles=request.ref_subtitles,
            avg_words_per_line=request.avg_words_per_line,
            subtitle_pattern=request.subtitle_pattern,
            scene_contexts=request.scene_contexts,
        )
        return {"script": script}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        # generate_visual_script makes a blocking (multi-second) DeepSeek HTTP call; run it
        # off the event loop so it doesn't freeze every other request (e.g. render polls).
        script = await asyncio.to_thread(
            generate_visual_script,
            idea_title=request.idea_title,
            hook_phrase=request.hook_phrase,
            platform=request.platform,
            tone=request.tone,
            niche=request.niche,
            product=request.product,
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
