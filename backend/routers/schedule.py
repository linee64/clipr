"""Scheduled auto-posting endpoints.

  POST /api/schedule          -> create a scheduled post; returns the schedule
  GET  /api/schedule?cid=...  -> list this browser's schedules
  POST /api/schedule/cancel   -> cancel a pending/failed schedule

The actual posting is done by the background loop in services.scheduler (started on
app startup), which publishes each due schedule via the same twitter/linkedin flow as
manual posting.
"""

from fastapi import APIRouter, HTTPException

from models.schemas import ScheduleCancelRequest, ScheduleCreateRequest
from services import scheduler

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


@router.post("")
async def create(request: ScheduleCreateRequest):
    try:
        return await scheduler.create_schedule(
            cid=request.cid,
            platform=request.platform,
            output_url=request.output_url,
            caption=request.caption,
            title=request.title,
            scheduled_at=request.scheduled_at,
        )
    except scheduler.ScheduleError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def list_all(cid: str = ""):
    return {"schedules": await scheduler.list_schedules(cid)}


@router.post("/cancel")
async def cancel(request: ScheduleCancelRequest):
    await scheduler.cancel_schedule(request.cid, request.id)
    return {"ok": True}
