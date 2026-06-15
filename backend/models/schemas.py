from typing import List

from pydantic import BaseModel


class IdeaRequest(BaseModel):
    topic: str
    platform: str  # "TikTok" | "LinkedIn" | "Reels"
    format: str    # "Tutorial" | "Story" | "Hot Take" | "List"
    niche: str
    tone: str      # "Casual founder" etc


class Idea(BaseModel):
    title: str
    hook_phrase: str
    vibe: str
    platform: str
    potential: str  # "High potential" | "Trending topic" | "Viral format"


class IdeasResponse(BaseModel):
    ideas: list[Idea]


class Scene(BaseModel):
    order: int
    phrase: str
    film_suggestion: str
    duration_seconds: int
    role: str  # "hook" | "body" | "punch"


class VisualScriptResponse(BaseModel):
    title: str
    platform: str
    scenes: list[Scene]
    music_vibe: str
    color_grade: str
    caption: str = ""
    template_id: str = ""  # which style template this storyboard was built from


class VisualScriptRequest(BaseModel):
    idea_title: str
    hook_phrase: str
    platform: str
    tone: str
    niche: str


class BrollRenderRequest(BaseModel):
    job_id: str
    scenes: list[Scene]
    clip_ids: list[str]
    audio_file_id: str
    audio_volume: float = 0.6
    color_grade: str = "dark_cinematic"
    platform: str = "TikTok"
    beats_per_clip: int = 2  # how many beats each clip is held for (1 = cut on every beat)
    template_id: str = ""  # style template driving pacing + caption style
    # User-chosen start offset (seconds) into the track — the segment they picked in
    # the trimmer. None = auto (template music_start / hook detection). Wins over both.
    music_start: float | None = None


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
    clip_ids: List[str]
    threshold: float = -35.0


class TwitterPostRequest(BaseModel):
    # The rendered video to publish — the same output_url the render returns and the
    # frontend persists in "My Content" (a Supabase public URL, or a /api/video/files
    # path in local dev). caption becomes the post text (trimmed to 280 chars).
    output_url: str
    caption: str = ""
