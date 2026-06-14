import type {
  BrollRenderRequest,
  IdeaRequest,
  IdeasResponse,
  RenderStatus,
  TemplateSampleResponse,
  TemplateTrack,
  VisualScriptRequest,
  VisualScriptResponse,
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
): Promise<{ clip_id: string; url: string }> {
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
