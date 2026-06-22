import { NextRequest, NextResponse } from "next/server";

// Instagram (Meta) OAuth callback passthrough — forwards to the FastAPI backend.
export const dynamic = "force-dynamic";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(
  /\/+$/,
  ""
);

export function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const target = `${API_BASE}/api/instagram/callback${incoming.search}`;
  return NextResponse.redirect(target);
}
