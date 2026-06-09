from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ideas, scripts, templates, video

app = FastAPI(title="Clipr API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
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
