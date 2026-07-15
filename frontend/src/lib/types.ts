import type { ContentVariation } from "./contentVariations";

export type { ContentVariation };

export interface IdeaRequest {
  topic: string;
  platform: string;
  format: string;
  niche: string;
  tone: string;
  /** organic | digital | ads — shapes idea angles + ad copy strategy */
  variation?: ContentVariation;
}

export interface Idea {
  title: string;
  hook_phrase: string;
  vibe: string;
  platform: string;
  potential: string;
}

export interface IdeasResponse {
  ideas: Idea[];
}

export interface Scene {
  order: number;
  phrase: string;
  film_suggestion: string;
  duration_seconds: number;
  role: "hook" | "body" | "punch";
}

export interface VisualScriptRequest {
  idea_title: string;
  hook_phrase: string;
  platform: string;
  tone: string;
  niche: string;
  product?: string;
  /** organic | digital | ads — shapes storyboard phrase + shot strategy */
  variation?: ContentVariation;
  /** billing email (auto-attached by the API client) for free-tier metering */
  email?: string;
  /** true for a user-triggered regeneration (metered on free), not the first gen */
  regenerate?: boolean;
}

export interface VisualScriptResponse {
  title: string;
  platform: string;
  scenes: Scene[];
  music_vibe: string;
  color_grade: string;
  caption?: string;
  template_id?: string;
}

export interface BrollRenderRequest {
  job_id: string;
  /** billing email (auto-attached by the API client) for free-tier enforcement */
  email?: string;
  scenes: Scene[];
  clip_ids: string[];
  audio_file_id: string;
  audio_volume: number;
  color_grade: string;
  platform: string;
  template_id?: string;
  /** user-picked start offset (seconds) into the track, from the trimmer */
  music_start?: number;
  // --- AI voiceover (ElevenLabs) — omitted unless the user turns it on ---
  add_voiceover?: boolean;
  voice_id?: string;
  vo_speed?: number;
  vo_volume?: number;
  bg_music_volume?: number;
  /** "script" = AI-generated scene phrases (default), "lyrics" = extract text from song via Whisper */
  subtitle_source?: "script" | "lyrics";
}

/** An ElevenLabs voice available for AI voiceover (from GET /api/video/voices). */
export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  /** Pro-only voice — the picker shows a lock and blocks selection for free users */
  premium?: boolean;
}

/** AI-voiceover choices the create flow carries from the upload step into render. */
export interface VoiceoverSettings {
  enabled: boolean;
  voiceId: string;
  /** playback speed multiplier; ElevenLabs honours ~0.7–1.2 */
  speed: number;
}

/** A rendered video scheduled to auto-post to a social network at a set time. */
export interface ScheduledPost {
  id: string;
  platform: "twitter" | "linkedin" | "instagram";
  output_url: string;
  caption: string;
  title: string;
  /** epoch seconds (absolute) when it should post */
  scheduled_at: number;
  status: "pending" | "processing" | "posted" | "error";
  result_url?: string;
  error?: string;
  created_at?: number;
  posted_at?: number;
}

export interface RenderStatus {
  job_id: string;
  status: string;
  progress: number;
  output_url: string;
  description: string;
  error: string;
}

export interface UploadedClipSlot {
  /** present for a user-uploaded file; absent for a Pexels-imported clip */
  file?: File;
  clip_id?: string;
  previewUrl?: string;
  /** display name shown in the slot (file name, or a Pexels label) */
  name?: string;
  source?: "file" | "pexels";
}

export interface PexelsVideo {
  id: number;
  image: string;
  preview: string;
  duration: number;
  width: number;
  height: number;
  user_name: string;
}

export interface PexelsSearchResponse {
  videos: PexelsVideo[];
  page: number;
  total_results: number;
}

export interface TemplateTrack {
  id: string;
  name: string;
  vibe: string;
  url: string;
}

/**
 * Either an uploaded file (needs uploadAudio before render) or a built-in
 * template track (already seeded in storage, has a stable audio_file_id).
 */
export interface AudioSelection {
  file?: File;
  audio_file_id?: string;
  name: string;
  url?: string;
  isTemplate?: boolean;
  /** user-picked start offset (seconds) into the track, from the trimmer */
  start?: number;
}

export interface TemplateOption {
  id: string;
  label: string;
  caption_style: string;
  color_grade: string;
  music_vibe: string;
  /** built-in track id that best fits this reference (auto-selected on pick) */
  recommended_track?: string;
  /** when true, the create flow won't auto-pick music — the user must choose it */
  music_manual?: boolean;
  /** when true, render must include AI voice for this style's dedicated black subtitle block */
  require_voiceover?: boolean;
  /** optional UI hint explaining how the style uses AI voice */
  voiceover_message?: string;
  /** work-in-progress style: shown but not selectable yet */
  wip?: boolean;
  /** Pro-only reference style — the picker shows a lock and blocks free users */
  premium?: boolean;
  pacing?: {
    target_cut_len?: number;
    max_cuts_per_scene?: number;
    zooms?: number[];
  };
  measured?: {
    duration?: number;
    cuts?: number;
    bpm?: number;
    [key: string]: unknown;
  };
  preview_url: string;
}

export interface TemplateSampleResponse {
  templates: TemplateOption[];
  total: number;
}
