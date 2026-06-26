import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import (
    billing,
    ideas,
    instagram,
    linkedin,
    pexels,
    schedule,
    scripts,
    templates,
    twitter,
    video,
    byoc,
)

app = FastAPI(title="Clipr API", version="1.0.0")

# Allowed browser origins. Set CORS_ORIGINS (comma-separated) on the server to your
# deployed frontend URL(s), e.g. "https://clipr.vercel.app". Falls back to localhost
# for development. "*" allows any origin (note: with credentials disabled below).
_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,https://clipr-ai.xyz,https://www.clipr-ai.xyz"
    ).split(",")
    if o.strip()
]
_allow_all = _origins == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # credentials can't be combined with the "*" wildcard per the CORS spec
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ideas.router)
app.include_router(pexels.router)
app.include_router(scripts.router)
app.include_router(templates.router)
app.include_router(twitter.router)
app.include_router(linkedin.router)
app.include_router(instagram.router)
app.include_router(schedule.router)
app.include_router(video.router)
app.include_router(billing.router)
app.include_router(byoc.router)


@app.on_event("startup")
async def _start_scheduler():
    """Kick off the background loop that auto-posts scheduled videos when due. Runs in
    this (single) uvicorn worker for the life of the process."""
    import asyncio

    from services import scheduler

    asyncio.create_task(scheduler.run_loop())


@app.get("/")
async def root():
    return {"status": "Clipr API running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
