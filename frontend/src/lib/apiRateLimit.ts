// Best-effort, in-memory throttle for the public AI-proxy API routes
// (/api/generate-ideas, /api/generate-script). These routes spend the server's DeepSeek
// budget on every call, so an unthrottled anonymous caller is a budget-drain primitive.
//
// This is a SPEED BUMP, not a hard guarantee: on Vercel each (possibly ephemeral)
// instance has its own module memory, so the window isn't shared across instances. For a
// real limit, put a shared store (e.g. Upstash Redis) in front. It still stops trivial
// scripted abuse from a single client hitting a warm instance, at zero infra cost.

const HITS = new Map<string, number[]>();

/** Returns true if the call is allowed, false if it should be rejected (429). */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const since = now - windowMs;
  const recent = (HITS.get(key) || []).filter((t) => t > since);
  if (recent.length >= limit) {
    HITS.set(key, recent);
    return false;
  }
  recent.push(now);
  HITS.set(key, recent);
  // Opportunistic GC so a long-lived instance can't grow the Map without bound.
  if (HITS.size > 5000) {
    const stale: string[] = [];
    HITS.forEach((v, k) => {
      const kept = v.filter((t) => t > since);
      if (kept.length === 0) stale.push(k);
      else HITS.set(k, kept);
    });
    stale.forEach((k) => HITS.delete(k));
  }
  return true;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}
