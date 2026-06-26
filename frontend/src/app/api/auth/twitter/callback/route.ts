import { NextRequest, NextResponse } from "next/server";

// X (Twitter) OAuth callback passthrough.
//
// The redirect URI registered in the X developer portal points at the FRONTEND
// domain (https://clipr-ai.xyz/api/auth/twitter/callback) — but all the OAuth
// logic (token exchange, storage, refresh, posting) lives on the FastAPI backend,
// next to the rendered video files. So this route is a thin passthrough: it just
// forwards X's `?code=...&state=...` (or `?error=...`) on to the backend callback,
// which finishes the exchange and then redirects the browser back to /dashboard.
//
// Keeping the registered redirect URI on the frontend means the X portal never
// has to change, while the backend stays the single owner of the integration.
export const dynamic = "force-dynamic";

const API_BASE = (process.env.API_BASE_URL || "http://localhost:8000").replace(
  /\/+$/,
  ""
);

export function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const target = `${API_BASE}/api/twitter/callback${incoming.search}`;
  return NextResponse.redirect(target);
}
