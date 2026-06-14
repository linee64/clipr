import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ideas, scripts, templates, video

app = FastAPI(title="Clipr API", version="1.0.0")

# Allowed browser origins. Set CORS_ORIGINS (comma-separated) on the server to your
# deployed frontend URL(s), e.g. "https://clipr.vercel.app". Falls back to localhost
# for development. "*" allows any origin (note: with credentials disabled below).
_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
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
app.include_router(scripts.router)
app.include_router(templates.router)
app.include_router(video.router)


@app.get("/")
async def root():
    return {"status": "Clipr API running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
