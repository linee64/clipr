import type {
  BrollRenderRequest,
  IdeaRequest,
  IdeasResponse,
  PexelsSearchResponse,
  RenderStatus,
  TemplateSampleResponse,
  TemplateTrack,
  VisualScriptRequest,
  VisualScriptResponse,
  Voice,
} from "./types";

// Backend (FastAPI on Railway) base URL. Set NEXT_PUBLIC_API_BASE in the deploy
// environment (Vercel) to the Railway domain; falls back to localhost for dev.
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
).replace(/\/+$/, "");

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.detail ?? json.error ?? text;
    } catch {
      /* use raw text */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

export function resolveBackendUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function uploadClip(
  file: File
): Promise<{ clip_id: string; url: string; storage?: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/video/upload/clip`, {
    method: "POST",
    body: form,
  });
  return parseJson(res);
}

export async function uploadAudio(
  file: File
): Promise<{ audio_file_id: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/video/upload/audio`, {
    method: "POST",
    body: form,
  });
  return parseJson(res);
}

export async function searchPexelsVideos(
  query: string,
  page = 1
): Promise<PexelsSearchResponse> {
  const params = new URLSearchParams({ query, page: String(page) });
  const res = await fetch(`${API_BASE}/api/pexels/search?${params.toString()}`);
  return parseJson(res);
}

/** Import a picked Pexels video server-side and get back a render-ready clip_id. */
export async function importPexelsClip(
  videoId: number
): Promise<{ clip_id: string; url: string; storage?: string }> {
  const res = await fetch(`${API_BASE}/api/video/pexels-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId }),
  });
  return parseJson(res);
}

export async function fetchTracks(): Promise<TemplateTrack[]> {
  const res = await fetch(`${API_BASE}/api/video/tracks`);
  const data = await parseJson<{ tracks: TemplateTrack[] }>(res);
  return data.tracks.map((t) => ({ ...t, url: resolveBackendUrl(t.url) }));
}

export async function startBrollRender(
  payload: BrollRenderRequest
): Promise<{ job_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/video/broll-render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

/** List the ElevenLabs voices available for AI voiceover. Throws (with the backend's
 *  message) if voiceover isn't configured on the server — callers surface that. */
export async function getVoices(): Promise<{ voices: Voice[] }> {
  const res = await fetch(`${API_BASE}/api/video/voices`);
  return parseJson(res);
}

/** Synthesize a short sample line in a voice and get back a base64 mp3 to play in the
 *  picker (no render needed). */
export async function previewVoiceover(payload: {
  voice_id: string;
  text?: string;
  speed?: number;
}): Promise<{ audio_base64: string; content_type: string }> {
  const res = await fetch(`${API_BASE}/api/video/voiceover/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function sampleTemplates(
  platform: string,
  exclude: string[] = [],
  count = 3
): Promise<TemplateSampleResponse> {
  const params = new URLSearchParams({ platform, count: String(count) });
  if (exclude.length) params.set("exclude", exclude.join(","));
  const res = await fetch(`${API_BASE}/api/templates/sample?${params.toString()}`);
  return parseJson(res);
}

export async function listReferences(): Promise<TemplateSampleResponse> {
  const res = await fetch(`${API_BASE}/api/templates/all`);
  return parseJson(res);
}

export async function getRenderStatus(jobId: string): Promise<RenderStatus> {
  const res = await fetch(`${API_BASE}/api/video/render/${jobId}`);
  return parseJson(res);
}

export async function generateIdeas(
  payload: IdeaRequest
): Promise<IdeasResponse> {
  const res = await fetch(`${API_BASE}/api/ideas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function generateVisualScript(
  payload: VisualScriptRequest
): Promise<VisualScriptResponse> {
  const res = await fetch(`${API_BASE}/api/scripts/visual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

// ----------------------------------------------------------------------------
// X / Twitter auto-posting
// ----------------------------------------------------------------------------

export interface TwitterStatus {
  connected: boolean;
  username?: string;
  name?: string;
  /** false when the backend is missing X credentials (connect can't work yet) */
  configured?: boolean;
}

export interface TwitterPostResult {
  id: string;
  url: string;
}

/**
 * Whether the X / Twitter integration is shown at all. OFF unless
 * NEXT_PUBLIC_X_ENABLED is exactly "true", so the whole feature is hidden on
 * public deploys (no connect, no account, no post buttons) until per-user auth
 * exists. Flip the env var on to bring it back.
 */
export const X_ENABLED = process.env.NEXT_PUBLIC_X_ENABLED === "true";

/**
 * A stable per-browser client id. X connections are scoped to it server-side, so
 * one browser's connected account isn't visible to other visitors on the deploy.
 * (Not real auth — it just prevents the accidental global leak until user auth exists.)
 */
function getClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let cid = localStorage.getItem("clipr_cid");
    if (!cid) {
      cid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `c${Date.now()}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("clipr_cid", cid);
    }
    return cid;
  } catch {
    return "";
  }
}

/** Whether an X account is connected for this browser, and which handle. */
export async function getTwitterStatus(): Promise<TwitterStatus> {
  const res = await fetch(
    `${API_BASE}/api/twitter/status?cid=${encodeURIComponent(getClientId())}`,
    { cache: "no-store" }
  );
  return parseJson(res);
}

/**
 * Kick off the OAuth connect: ask the backend for the X authorize URL, then send
 * the browser there. X redirects back through the frontend passthrough route to
 * the backend, which finishes the exchange and returns to /dashboard.
 */
export async function startTwitterConnect(): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/twitter/login?cid=${encodeURIComponent(getClientId())}`,
    { cache: "no-store" }
  );
  const { authorize_url } = await parseJson<{ authorize_url: string }>(res);
  window.location.href = authorize_url;
}

/** Publish a rendered video to X with the given caption. */
export async function postToTwitter(payload: {
  output_url: string;
  caption: string;
}): Promise<TwitterPostResult> {
  const res = await fetch(`${API_BASE}/api/twitter/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, cid: getClientId() }),
  });
  return parseJson(res);
}

/** Forget the connected X account for this browser. */
export async function disconnectTwitter(): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/twitter/disconnect?cid=${encodeURIComponent(getClientId())}`,
    { method: "POST" }
  );
  await parseJson(res);
}
