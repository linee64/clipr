import { NextRequest, NextResponse } from "next/server";

// LinkedIn OAuth callback passthrough.
//
// The Authorized redirect URL registered in the LinkedIn developer app points at the
// FRONTEND domain (https://clipr-ai.xyz/api/auth/linkedin/callback) — but all the
// OAuth logic (token exchange, storage, posting) lives on the FastAPI backend, next
// to the rendered video files. So this route is a thin passthrough: it forwards
// LinkedIn's `?code=...&state=...` (or `?error=...`) on to the backend callback,
// which finishes the exchange and then redirects the browser back to /dashboard.
//
// Keeping the registered redirect URL on the frontend means the LinkedIn app never
// has to change, while the backend stays the single owner of the integration.
export const dynamic = "force-dynamic";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(
  /\/+$/,
  ""
);

export function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const target = `${API_BASE}/api/linkedin/callback${incoming.search}`;
  return NextResponse.redirect(target);
}
