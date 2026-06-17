export interface IdeaRequest {
  topic: string;
  platform: string;
  format: string;
  niche: string;
  tone: string;
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
}

/** An ElevenLabs voice available for AI voiceover (from GET /api/video/voices). */
export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

/** AI-voiceover choices the create flow carries from the upload step into render. */
export interface VoiceoverSettings {
  enabled: boolean;
  voiceId: string;
  /** playback speed multiplier; ElevenLabs honours ~0.7–1.2 */
  speed: number;
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
  /** work-in-progress style: shown but not selectable yet */
  wip?: boolean;
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
