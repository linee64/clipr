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


class VideoClip(BaseModel):
    clip_id: str
    order: int
    trim_start: float
    trim_end: float
    mute: bool = False


class RenderRequest(BaseModel):
    job_id: str
    clips: list[VideoClip]
    audio_file_id: str
    audio_volume: float = 0.3
    add_subtitles: bool = True
    subtitle_preset: str = "tiktok_bold"
    platform: str
    script_summary: str


class RenderStatus(BaseModel):
    job_id: str
    status: str
    progress: int
    output_url: str = ""
    description: str = ""
    error: str = ""


class BeatSyncRequest(BaseModel):
    job_id: str
    clip_ids: list[str]
    audio_file_id: str
    transition_type: str = "fade"
    fade_duration: float = 0.12
    add_subtitles: bool = False
    subtitle_preset: str = "tiktok_bold"


class SubtitleStyleRequest(BaseModel):
    job_id: str
    video_file_id: str
    preset: str = "tiktok_bold"
    custom_text: str | None = None
    audio_file_id: str | None = None


class SilenceDetectRequest(BaseModel):
    clip_id: str
    threshold: float = -35.0
    min_duration: float = 0.5


class SilenceRemoveRequest(BaseModel):
    clip_id: str
    threshold: float = -35.0
