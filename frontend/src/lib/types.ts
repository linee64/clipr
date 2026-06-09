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
  file: File;
  clip_id?: string;
  previewUrl?: string;
}
