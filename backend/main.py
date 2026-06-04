from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ideas, scripts

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


@app.get("/")
async def root():
    return {"status": "Clipr API running"}
