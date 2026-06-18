# Clipr AI — Project Context for Claude Code

## What is Clipr AI
An AI-powered short-form video content creation tool for solo founders and content creators. Core value prop: connects the Notion → CapCut → Buffer workflow into one seamless pipeline. Target users want to grow on TikTok/Reels/Shorts but don't have time for the full production cycle.

## Tech Stack
- **Frontend**: Next.js + Tailwind CSS + Framer Motion + shadcn/ui
- **Backend**: FastAPI (Python) in `/backend` folder
- **Database & Storage**: Supabase
- **AI**: Gemini 2.0 Flash (generation), OpenAI Whisper (transcription)
- **Video**: FFmpeg + librosa (beat detection) on Railway
- **Deployment**: Vercel (frontend) + Railway (video processing)
- **Scheduled Jobs**: Vercel Cron Jobs

## Brand Identity
- **Background**: Dark graphite `#1C1C1C`
- **Accent**: Mint green `#10B981` / `#00E5A0`
- **Aesthetic reference**: Linear, Spiral — clean, minimal, dark-themed, typography-forward, generous whitespace
- **Tone**: Focused and professional, but with subtle energy. Not corporate. Built for creators.

## Design Guidelines

This project follows production-grade frontend design principles. Avoid generic "AI slop" aesthetics at all times.

### Design Thinking — always do this before writing UI code
- **Purpose**: What problem does this screen solve? Who uses it and when?
- **Tone**: Refined minimalism with sharp accents. Think Linear meets a video tool. Dark, focused, intentional.
- **Differentiation**: Every screen should have one memorable detail — a transition, a layout choice, a hover state.

### Implementation must be:
- Production-grade and fully functional
- Visually striking and cohesive
- Meticulously refined in spacing, typography, and motion

### Typography
- Never use Inter, Roboto, Arial, or system fonts
- Choose distinctive, characterful font pairings that feel designed for this context
- Typography should carry visual weight — it's a design element, not just content

### Color & Theme
- Primary background: `#1C1C1C` (dark graphite)
- Accent: `#10B981` mint green — use sparingly as a sharp signal, not decoration
- Use CSS variables for all colors
- Avoid purple gradients, pastel palettes, or anything that looks like a generic SaaS template

### Motion (Framer Motion)
- Staggered entrance animations on page load — cards, rows, panels reveal sequentially
- Micro-interactions on hover: subtle lift, border glow, opacity shift
- Smooth layout transitions when panels open/close
- Keep it purposeful — one well-orchestrated animation beats ten scattered ones

### Spatial Composition
- 3-column dashboard layout: sidebar nav / main content / context panel
- Generous whitespace — let elements breathe
- Controlled density in data-heavy areas (idea cards, script sections)
- Glassmorphism accents on modals and overlays (backdrop-blur, subtle border)

### Backgrounds & Visual Details
- Subtle noise texture or grain overlay on backgrounds
- Soft radial gradients behind key UI elements (not loud, just atmosphere)
- Mint glow effect (`box-shadow: 0 0 20px rgba(16, 185, 129, 0.15)`) on active/focused states
- Dark card surfaces: `#242424` or `#2A2A2A` on `#1C1C1C` base

### Never do this
- Generic purple/blue gradients on white backgrounds
- Cookie-cutter shadcn/ui without customization
- Flat, textureless backgrounds
- Predictable grid layouts with no visual interest
- Inter or Space Grotesk as the primary font

## Key Screens
- **Landing page** (`/`): Waitlist capture, hero with product preview
- **Dashboard** (`/dashboard`): 3-column layout — nav sidebar / idea feed / script preview panel
- **Script editor** (`/script/[id]`): Streaming section-by-section generation, revision bar with version dots, references sidebar
- **Video upload** (`/upload`): Drag-and-drop, FFmpeg processing status, subtitle preset selector (TikTok Bold / Plaque / Center Caps)

## Pricing
- $25/month with 3-day free trial (billed via Polar)

## Code Conventions
- All components in `/components` folder, co-located with their styles
- Use Framer Motion's `motion` components, not CSS transitions for complex animations
- shadcn/ui as base — always customize, never use defaults as-is
- FastAPI endpoints follow RESTful conventions, Pydantic models for all request/response shapes
- Supabase client initialized once in `/lib/supabase.ts`