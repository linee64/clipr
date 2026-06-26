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
  ScheduledPost,
} from "./types";

let rawApiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
if (rawApiBase.startsWith("http://") && !rawApiBase.includes("localhost") && !rawApiBase.includes("127.0.0.1")) {
  rawApiBase = rawApiBase.replace("http://", "https://");
}
export const API_BASE = rawApiBase.replace(/\/+$/, "");

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
    const err = new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail)
    ) as Error & { status?: number };
    err.status = res.status; // lets callers detect 402/403/429 (upgrade-required)
    throw err;
  }
  return res.json() as Promise<T>;
}

/** True when an error from parseJson is a "needs Pro" rejection (premium/quota). */
export function isUpgradeError(e: unknown): boolean {
  const s = (e as { status?: number })?.status;
  return s === 402 || s === 403 || s === 429;
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

export async function uploadBYOCClip(
  userId: string,
  sessionId: string,
  file: File
): Promise<{ clip_id: string; url: string; storage?: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API_BASE}/api/byoc/upload?user_id=${encodeURIComponent(userId)}&session_id=${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
      body: form,
    }
  );
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
    // Attach the billing email so the backend can gate premium voices/styles and
    // meter free-tier AI-voiceover renders.
    body: JSON.stringify({ email: getBillingEmail(), ...payload }),
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
    // Attach the billing email so the backend can meter free-tier regenerations.
    body: JSON.stringify({ email: getBillingEmail(), ...payload }),
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
 * Whether the X / Twitter integration is shown. ON by default; set
 * NEXT_PUBLIC_X_ENABLED="false" to hide it. Connections are scoped per browser
 * (the clipr_cid client id), so one browser's account isn't visible to others.
 */
export const X_ENABLED = process.env.NEXT_PUBLIC_X_ENABLED !== "false";

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

// ----------------------------------------------------------------------------
// LinkedIn connect + auto-posting (mirrors the X integration above)
// ----------------------------------------------------------------------------

export interface LinkedInStatus {
  connected: boolean;
  /** the connected member's display name, when known */
  name?: string;
  /** opaque member id (LinkedIn has no public @handle) */
  member_id?: string;
  /** false when the backend is missing LinkedIn credentials (connect can't work yet) */
  configured?: boolean;
  /** true when a stored session has expired and the user must reconnect */
  expired?: boolean;
}

/**
 * Whether the LinkedIn integration is shown. ON by default; set
 * NEXT_PUBLIC_LINKEDIN_ENABLED="false" to hide it. Connections are scoped per browser
 * by the shared client id, like X.
 */
export const LINKEDIN_ENABLED = process.env.NEXT_PUBLIC_LINKEDIN_ENABLED !== "false";

/** Whether a LinkedIn account is connected for this browser, and which member. */
export async function getLinkedInStatus(): Promise<LinkedInStatus> {
  const res = await fetch(
    `${API_BASE}/api/linkedin/status?cid=${encodeURIComponent(getClientId())}`,
    { cache: "no-store" }
  );
  return parseJson(res);
}

/** Kick off the LinkedIn OAuth connect (same passthrough pattern as X). */
export async function startLinkedInConnect(): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/linkedin/login?cid=${encodeURIComponent(getClientId())}`,
    { cache: "no-store" }
  );
  const { authorize_url } = await parseJson<{ authorize_url: string }>(res);
  window.location.href = authorize_url;
}

/** Result of publishing to LinkedIn (post URN + a link to the post). */
export interface LinkedInPostResult {
  id: string;
  url: string;
}

/** Publish a rendered video to LinkedIn with the given caption. */
export async function postToLinkedIn(payload: {
  output_url: string;
  caption: string;
}): Promise<LinkedInPostResult> {
  const res = await fetch(`${API_BASE}/api/linkedin/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, cid: getClientId() }),
  });
  return parseJson(res);
}

/** Forget the connected LinkedIn account for this browser. */
export async function disconnectLinkedIn(): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/linkedin/disconnect?cid=${encodeURIComponent(getClientId())}`,
    { method: "POST" }
  );
  await parseJson(res);
}

// ----------------------------------------------------------------------------
// Instagram Reels auto-posting (Meta Graph API)
// ----------------------------------------------------------------------------

export interface InstagramStatus {
  connected: boolean;
  username?: string;
  name?: string;
  ig_user_id?: string;
  configured?: boolean;
  expired?: boolean;
}

/**
 * Set NEXT_PUBLIC_INSTAGRAM_ENABLED=true when Meta app is ready; off by default (shown as in development).
 */
export const INSTAGRAM_ENABLED = process.env.NEXT_PUBLIC_INSTAGRAM_ENABLED === "true";

export async function getInstagramStatus(): Promise<InstagramStatus> {
  const res = await fetch(
    `${API_BASE}/api/instagram/status?cid=${encodeURIComponent(getClientId())}`,
    { cache: "no-store" }
  );
  return parseJson(res);
}

export async function startInstagramConnect(): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/instagram/login?cid=${encodeURIComponent(getClientId())}`,
    { cache: "no-store" }
  );
  const { authorize_url } = await parseJson<{ authorize_url: string }>(res);
  window.location.href = authorize_url;
}

export interface InstagramPostResult {
  id: string;
  url: string;
}

export async function postToInstagram(payload: {
  output_url: string;
  caption: string;
}): Promise<InstagramPostResult> {
  const res = await fetch(`${API_BASE}/api/instagram/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, cid: getClientId() }),
  });
  return parseJson(res);
}

export async function disconnectInstagram(): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/instagram/disconnect?cid=${encodeURIComponent(getClientId())}`,
    { method: "POST" }
  );
  await parseJson(res);
}

// ----------------------------------------------------------------------------
// Billing (Polar subscription)
// ----------------------------------------------------------------------------

export interface BillingStatus {
  /** "pro" when an active subscription exists, otherwise "free" */
  plan: "pro" | "free";
  active: boolean;
  /** raw Polar status: active | trialing | canceled | past_due | ... */
  status?: string;
  /** ISO timestamp the current paid period ends */
  current_period_end?: string;
  /** true when the sub is set to end at period end (cancelled but still active) */
  cancel_at_period_end?: boolean;
  /** false when the backend is missing Polar credentials (checkout can't work yet) */
  configured?: boolean;
  // --- server-side free-tier trial + usage (from the accounts table) ---
  /** whole days left in the server trial (authoritative; survives cache clears) */
  trial_days_left?: number;
  /** true once the server trial has elapsed */
  trial_expired?: boolean;
  /** free-tier storyboard regenerations used / allowed */
  regen_used?: number;
  regen_limit?: number;
  /** free-tier AI-voiceover renders used / allowed */
  voiceover_used?: number;
  voiceover_limit?: number;
  /** monthly video renders used / allowed (plan-specific cap; null = unlimited) */
  videos_used?: number;
  videos_limit?: number | null;
  /** lifetime unlimited Pro (founder / server allowlist) */
  unlimited?: boolean;
}

/** The user's billing identity — the email captured at onboarding (clipr_email). */
function getBillingEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem("clipr_email") || "").trim();
  } catch {
    return "";
  }
}

/** Whether this account currently has an active Pro subscription (per the backend). */
export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await fetch(
    `${API_BASE}/api/billing/status?email=${encodeURIComponent(getBillingEmail())}`,
    { cache: "no-store" }
  );
  return parseJson(res);
}

/**
 * Start a Polar checkout for Pro and send the browser to the hosted checkout page.
 * Polar returns to POLAR_SUCCESS_URL (the dashboard with ?billing=success) when done.
 */
export async function startCheckout(): Promise<void> {
  const email = getBillingEmail();
  if (!email) throw new Error("Add your email first so we can link your subscription.");
  const res = await fetch(`${API_BASE}/api/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const { url } = await parseJson<{ url: string }>(res);
  window.location.href = url;
}

/** Open the Polar customer portal (manage / cancel) for the current subscriber. */
export async function openBillingPortal(): Promise<void> {
  const email = getBillingEmail();
  if (!email) throw new Error("No email on file for this account.");
  const res = await fetch(`${API_BASE}/api/billing/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const { url } = await parseJson<{ url: string }>(res);
  window.location.href = url;
}

// ----------------------------------------------------------------------------
// Scheduled auto-posting (Calendar)
// ----------------------------------------------------------------------------

/** Schedule a rendered video to auto-post to X/LinkedIn at an absolute time. */
export async function createSchedule(payload: {
  platform: "twitter" | "linkedin" | "instagram";
  output_url: string;
  caption: string;
  title: string;
  /** epoch seconds */
  scheduled_at: number;
}): Promise<ScheduledPost> {
  const res = await fetch(`${API_BASE}/api/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, cid: getClientId() }),
  });
  return parseJson(res);
}

/** This browser's scheduled posts (pending + history). */
export async function listSchedules(): Promise<{ schedules: ScheduledPost[] }> {
  const res = await fetch(
    `${API_BASE}/api/schedule?cid=${encodeURIComponent(getClientId())}`,
    { cache: "no-store" }
  );
  return parseJson(res);
}

/** Cancel a pending (or failed) scheduled post. */
export async function cancelSchedule(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/schedule/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, cid: getClientId() }),
  });
  await parseJson(res);
}

export interface BYOCCreateRequest {
  job_id: string;
  email?: string;
  clip_ids: string[];
  script: string;
  subtitles_file?: string | null;
  burn_subtitles: boolean;
  template_id: string;
  platform: string;
  audio_file_id?: string | null;
}

export async function startBYOCCreate(
  payload: BYOCCreateRequest
): Promise<{ job_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/byoc/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: getBillingEmail(), ...payload }),
  });
  return parseJson(res);
}

