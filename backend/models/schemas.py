from pydantic import BaseModel


class IdeaRequest(BaseModel):
    topic: str
    platform: str  # "TikTok" | "LinkedIn" | "Reels"
    format: str    # "Tutorial" | "Story" | "Hot Take" | "List"
    niche: str
    tone: str      # "Casual founder" etc


class Idea(BaseModel):
    title: str
    hook_preview: str
    format: str
    platform: str
    potential: str  # "High potential" | "Trending topic" | "Viral format"


class IdeasResponse(BaseModel):
    ideas: list[Idea]


class ScriptRequest(BaseModel):
    idea_title: str
    hook_preview: str
    platform: str
    tone: str
    niche: str


class ScriptVariant(BaseModel):
    hook: str        # 0-3 sec
    problem: str     # 3-15 sec
    solution: str    # 15-45 sec
    cta: str         # 45-60 sec


class ScriptResponse(BaseModel):
    aggressive: ScriptVariant
    storytelling: ScriptVariant
    educational: ScriptVariant
