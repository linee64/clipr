import type {
  IdeaRequest,
  IdeasResponse,
  RenderRequest,
  RenderStatus,
  ScriptRequest,
  ScriptResponse,
} from "./types";

export const API_BASE = "http://localhost:8000";

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

export async function startRender(
  payload: RenderRequest
): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/api/video/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<RenderStatus>(res);
  return { job_id: data.job_id };
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

export async function generateScript(
  payload: ScriptRequest
): Promise<ScriptResponse> {
  const res = await fetch(`${API_BASE}/api/scripts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}
