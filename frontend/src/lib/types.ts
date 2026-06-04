export interface IdeaRequest {
  topic: string;
  platform: string;
  format: string;
  niche: string;
  tone: string;
}

export interface Idea {
  title: string;
  hook_preview: string;
  format: string;
  platform: string;
  potential: string;
}

export interface IdeasResponse {
  ideas: Idea[];
}

export interface ScriptRequest {
  idea_title: string;
  hook_preview: string;
  platform: string;
  tone: string;
  niche: string;
}

export interface ScriptVariant {
  hook: string;
  problem: string;
  solution: string;
  cta: string;
}

export interface ScriptResponse {
  aggressive: ScriptVariant;
  storytelling: ScriptVariant;
  educational: ScriptVariant;
}

export type ScriptVariantKey = keyof ScriptResponse;

export interface VideoClip {
  clip_id: string;
  order: number;
  trim_start: number;
  trim_end: number;
}

export interface RenderRequest {
  job_id: string;
  clips: VideoClip[];
  audio_file_id: string;
  audio_volume: number;
  add_subtitles: boolean;
  platform: string;
  script_summary: string;
}

export interface RenderStatus {
  job_id: string;
  status: string;
  progress: number;
  output_url: string;
  description: string;
  error: string;
}

export interface UploadedClip {
  id: string;
  file: File;
  clip_id?: string;
  order: number;
  trim_start: number;
  trim_end: number;
  duration?: number;
  uploading?: boolean;
}
