from typing import List

from pydantic import BaseModel, Field


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
    product: str = ""
    # Billing identity (clipr_email) for server-side free-tier metering. Optional so
    # anonymous/local use still works; when present and the user is on free, a
    # `regenerate` call is counted against the regen allowance.
    email: str = ""
    # True when this is a user-triggered regeneration (counted), not the first
    # storyboard generation for an idea (free).
    regenerate: bool = False


class BrollRenderRequest(BaseModel):
    job_id: str
    scenes: list[Scene]
    clip_ids: list[str]
    audio_file_id: str
    # Billing identity (clipr_email) for server-side free-tier enforcement: premium
    # voices/reference styles are blocked and AI-voiceover renders are metered for
    # free accounts. Optional so anonymous/local use still works.
    email: str = ""
    audio_volume: float = 0.6
    color_grade: str = "dark_cinematic"
    platform: str = "TikTok"
    beats_per_clip: int = 2  # how many beats each clip is held for (1 = cut on every beat)
    template_id: str = ""  # style template driving pacing + caption style
    # User-chosen start offset (seconds) into the track — the segment they picked in
    # the trimmer. None = auto (template music_start / hook detection). Wins over both.
    music_start: float | None = None
    # --- AI voiceover (ElevenLabs) ---
    # Off by default so existing renders are byte-identical. When on, each scene's
    # phrase is spoken at its timestamp and the music ducks under the voice. voice_id
    # defaults to "" (rather than being required) so a request that doesn't opt into
    # voiceover still validates; it's required only when add_voiceover is True.
    add_voiceover: bool = False
    voice_id: str = ""
    # Bounds reject obvious garbage (negative/NaN/huge) at the API edge; the services
    # still clamp to their exact working ranges (speed 0.7–1.2 in tts) downstream.
    vo_speed: float = Field(default=1.0, ge=0.5, le=2.0)  # ElevenLabs honours ~0.7–1.2
    vo_volume: float = Field(default=1.0, ge=0.0, le=3.0)  # voiceover level in the mix
    bg_music_volume: float = Field(default=0.2, ge=0.0, le=2.0)  # music bed under voice


class VoiceoverPreviewRequest(BaseModel):
    voice_id: str
    # Short sample line the user hears in the picker before committing to a voice.
    # Capped so a preview can't synthesize a huge clip (the base64 mp3 rides back in
    # the JSON body) or burn API quota.
    text: str = Field(
        default="This is how your voiceover will sound on your next video.",
        min_length=1,
        max_length=300,
    )
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


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


class PexelsVideo(BaseModel):
    id: int
    image: str  # thumbnail/poster for the picker grid
    preview: str = ""  # small mp4 for inline hover/click preview
    duration: int = 0
    width: int = 0
    height: int = 0
    user_name: str = ""  # creator credit (Pexels attribution is appreciated)


class PexelsSearchResponse(BaseModel):
    videos: list[PexelsVideo]
    page: int = 1
    total_results: int = 0


class PexelsImportRequest(BaseModel):
    # The frontend only sends the Pexels video id; the backend re-resolves the actual
    # mp4 link from Pexels itself (never downloads a client-supplied URL).
    video_id: int = Field(..., gt=0)


class ClipUploadResponse(BaseModel):
    clip_id: str
    url: str
    storage: str = ""  # "local" | "supabase"


class TwitterPostRequest(BaseModel):
    # The rendered video to publish — the same output_url the render returns and the
    # frontend persists in "My Content" (a Supabase public URL, or a /api/video/files
    # path in local dev). caption becomes the post text (trimmed to 280 chars).
    output_url: str
    caption: str = ""
    # Per-browser client id — scopes the post to that browser's connected X account.
    cid: str = ""


class LinkedInPostRequest(BaseModel):
    # Same shape as TwitterPostRequest: the rendered video to publish, the post text,
    # and the per-browser client id that scopes it to that browser's LinkedIn account.
    output_url: str
    caption: str = ""
    cid: str = ""


class InstagramPostRequest(BaseModel):
    # Rendered Reel video URL (Supabase public HTTPS), caption, and per-browser cid.
    output_url: str
    caption: str = ""
    cid: str = ""


class ScheduleCreateRequest(BaseModel):
    # Schedule a rendered video to auto-post to a social network at a given time.
    cid: str
    platform: str  # "twitter" | "linkedin" | "instagram"
    output_url: str
    caption: str = ""
    title: str = ""
    scheduled_at: float  # epoch seconds (absolute) when the post should go out


class ScheduleCancelRequest(BaseModel):
    cid: str
    id: str


class CheckoutRequest(BaseModel):
    # Start a Polar checkout for this user. The email is the billing identity (Polar
    # customer) — it's what the webhook later maps the subscription back onto. Stored
    # client-side as clipr_email since there's no per-user auth yet.
    email: str = ""


class BillingPortalRequest(BaseModel):
    # Open the Polar customer portal (manage / cancel) for an existing customer,
    # identified by the same email used at checkout.
    email: str = ""
