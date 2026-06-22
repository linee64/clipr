# Clipr AI

**AI-powered short-form video creation for solo founders & creators.** Clipr turns a
single idea into a finished, captioned, music-synced vertical video and posts it to your
socials — collapsing the usual *idea → script → edit → schedule* grind into one pipeline.

Describe what your video is about, and Clipr generates content ideas, writes a
scene-by-scene storyboard, assembles an aesthetic b-roll montage (your clips or Pexels
stock) with kinetic captions, optional AI voiceover, and beat-matched music — then
auto-posts to X, LinkedIn, and Instagram Reels on a schedule.

---

## Features

- **Idea engine** — generates scroll-stopping, on-topic short-form ideas from your product/niche (Google Gemini).
- **Visual storyboard** — scene-by-scene phrases + shot suggestions, editable, with style "templates" that drive the look.
- **B-roll render** — FFmpeg montage from uploaded clips or **Pexels** stock, color-graded per template, with kinetic/karaoke caption engines and beat-synced cuts (librosa).
- **AI voiceover** — per-scene narration via **ElevenLabs**, timed to the montage; music ducks under the voice.
- **Subtitle presets** — TikTok Bold / Plaque / Center Caps + several kinetic/editorial styles.
- **Auto-posting** — one-click connect & scheduled posting to **X (Twitter)**, **LinkedIn**, and **Instagram Reels** (backend-owned OAuth).
- **Calendar scheduler** — queue renders to publish at a chosen time; a background loop posts them when due.
- **Billing & freemium** — $15/mo Pro via **Polar**, with a server-side 5-day trial and usage limits: **10 videos/month** (Free) or **20 videos/month** (Pro), plus capped storyboard regens & AI voiceovers on Free; premium voices/reference styles gated to Pro.

## Tech stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion · shadcn/ui |
| **Backend** | FastAPI (Python 3.12) · Uvicorn |
| **Database & storage** | Supabase (Postgres + Storage) |
| **AI** | Google Gemini (`gemini-2.5-flash-lite`) · faster-whisper (transcription) · ElevenLabs (voiceover) |
| **Video** | FFmpeg · librosa (beat detection) |
| **Billing** | Polar |
| **Deploy** | Vercel (frontend) · Railway (backend / render worker, Docker) |
| **Tests** | pytest (backend) · Vitest + jsdom (frontend) |

## Repository layout

```
.
├── frontend/                 # Next.js app (UI + thin AI proxy routes)
│   └── src/
│       ├── app/              # routes: / (landing), /login, /dashboard, /api/*
│       ├── components/       # UI + the create-flow wizard (components/create/*)
│       └── lib/              # api client, plan/trial logic, supabase client
├── backend/                  # FastAPI service
│   ├── main.py               # app + CORS + scheduler startup
│   ├── routers/              # scripts, video, ideas, templates, schedule, billing, twitter, linkedin, instagram, pexels
│   ├── services/             # gemini, tts, editor, billing, usage, scheduler, storage, jobstore, …
│   ├── workers/render.py     # long-running b-roll render job
│   ├── migrations/           # 001–006 SQL (run in Supabase, in order)
│   └── tests/                # pytest suite
├── Dockerfile                # backend image (Railway) — installs FFmpeg
└── railway.json              # Railway build/deploy config
```

## Architecture

The Next.js app talks to the FastAPI backend (`NEXT_PUBLIC_API_BASE`). The backend
generates ideas/storyboards (Gemini), renders video (FFmpeg/librosa/ElevenLabs) as a
background job whose status is polled and mirrored to Supabase Storage (so a poll
survives a worker restart), stores clips/audio/renders in Supabase, meters free-tier
usage in a Supabase `accounts` table, and owns the X/LinkedIn/Instagram OAuth + scheduled posting.
Identity is the signed-in email; billing/usage are keyed by it.

---

## Getting started (local)

**Prerequisites:** Node 18+, Python 3.12, and **FFmpeg** on your `PATH` (the backend
shells out to it for rendering).

### 1. Backend

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows; use bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # then fill in the keys (see below)
python main.py                # serves on http://localhost:8000 (auto-reload)
```

Configure `backend/.env` from **`backend/.env.example`**, which documents every variable
and how to obtain it — Supabase (service-role key), Gemini, Pexels, ElevenLabs, X &
LinkedIn & Instagram (Meta) OAuth, Polar billing, and `CORS_ORIGINS`.

**Supabase migrations:** run the files in `backend/migrations/` **in order** (001 → 006)
in the Supabase SQL editor. They create the `subscriptions` and `accounts` tables and the
atomic usage-metering functions (`clipr_bump_usage`, `clipr_consume_usage`,
`clipr_refund_usage`). Also create a **public Storage bucket** named per `SUPABASE_BUCKET`.

### 2. Frontend

```bash
cd frontend
npm install
# create .env.local with at least:
#   NEXT_PUBLIC_API_BASE=http://localhost:8000
#   NEXT_PUBLIC_SUPABASE_URL=...        NEXT_PUBLIC_SUPABASE_ANON_KEY=...   (Supabase Auth)
#   GEMINI_API_KEY=...                  (used by the /api/generate-* proxy routes)
#   NEXT_PUBLIC_X_ENABLED=true          NEXT_PUBLIC_LINKEDIN_ENABLED=true
#   NEXT_PUBLIC_INSTAGRAM_ENABLED=true   # off by default — UI shows "In development" until set
npm run dev                   # http://localhost:3000
```

From the repo root, `npm run dev` / `build` / `start` / `lint` proxy to the frontend.

## Tests

```bash
# Backend — 91 tests (gemini JSON parsing, usage/trial metering, premium gating,
# scheduler validation, billing). DB/external calls are mocked.
cd backend && pip install -r requirements-dev.txt && pytest

# Frontend — 19 tests (rate limiter, trial-clock logic, upgrade-error mapping).
cd frontend && npm test
```

## Deployment

Prod **auto-deploys from `main`**:

- **Frontend → Vercel.** Set the env vars in the Vercel dashboard (incl. `NEXT_PUBLIC_API_BASE` pointing at the Railway backend). Vercel Cron drives the scheduled jobs.
- **Backend → Railway.** Built from the `Dockerfile` (installs FFmpeg). Set the backend env vars as Railway service variables; `CORS_ORIGINS` must include the Vercel domain. Health check: `GET /` → `{"status":"Clipr API running"}`.

After deploy, point the **Polar webhook** at `https://<backend>/api/billing/webhook` and
the **X/LinkedIn/Instagram OAuth callbacks** at the frontend passthrough routes (see `.env.example`).

### Instagram / Meta setup

1. Create a [Meta Developer](https://developers.facebook.com/) app and add **Facebook Login** + **Instagram API** (Content Publishing).
2. Under Facebook Login → Settings, add **Valid OAuth Redirect URI**:  
   `https://<your-frontend>/api/auth/instagram/callback`
3. Request permissions: `instagram_business_basic`, `instagram_business_content_publish`, `pages_show_list`, `pages_read_engagement`.
4. Until **App Review** is approved, only test users / app roles can publish.
5. Each user needs an **Instagram Professional** account linked to a **Facebook Page**.
6. Set `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_CALLBACK_URL`, and `INSTAGRAM_POST_CONNECT_URL` on the backend; set `NEXT_PUBLIC_INSTAGRAM_ENABLED=true` on the frontend.

Reels publishing uses a validated Supabase public `video_url` (Meta fetches the file). Local `/api/video/files/` paths are rejected for Instagram posts.

## Pricing

**$15/month** Pro subscription with a **5-day free trial**, billed via Polar.

| | Free | Pro |
|---|---|---|
| Videos / month | 10 | 20 |
| Storyboard regens | 3 (lifetime) | Unlimited |
| AI voiceovers | 2 (lifetime) | Unlimited |
| Premium voices & styles | — | ✓ |

Limits are enforced server-side (not just in the UI).

---

## Conventions

- Brand: dark graphite `#1C1C1C` + mint green `#10B981` accent.
- Finished work goes straight to `main` (prod deploys from it).
- See `CLAUDE.md` for design/code guidelines.
