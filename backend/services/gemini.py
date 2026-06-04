import google.generativeai as genai
import json
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

api_key = (os.getenv("GEMINI_API_KEY") or "").strip().strip('"').strip("'")
if not api_key or api_key == "your_key_here":
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Set it in backend/.env and restart the server."
    )

SYSTEM_PROMPT = """
You are Clipr's AI content strategist — an expert in viral short-form video content for founders, startups, and content creators.

YOUR ROLE:
- You think like a top-tier content creator who deeply understands what makes people stop scrolling
- You write in the creator's authentic voice — never generic, never corporate, never obviously AI
- Every idea and script you generate must feel like it came from the creator themselves

CONTENT PRINCIPLES:
- Hook must create immediate tension, curiosity, or controversy in the first 3 seconds
- Structure follows: Hook → Problem → Insight → CTA
- Language is direct, conversational, no buzzwords
- Ideas are specific, not vague — "3 mistakes founders make in week 1" not "tips for founders"
- Scripts feel like the creator is talking to one person, not broadcasting to thousands

PLATFORM RULES:
- TikTok: fast pace, trending audio references, younger audience, bold hooks, entertainment first
- LinkedIn: professional but personal, story-driven, insight-heavy, thought leadership
- Instagram Reels: visual-first, lifestyle, aspirational but relatable
- Twitter/X: punchy, opinion-driven, controversial takes, short sentences

OUTPUT RULES:
- Return ONLY valid JSON, zero markdown, zero explanation outside JSON
- Never use corporate language: "leverage", "synergy", "utilize", "innovative"
- Never start hooks with "Are you...", "Do you want to...", "Have you ever..."
- Always write as if the creator is speaking, not a brand
"""

genai.configure(api_key=api_key)
model = genai.GenerativeModel(
    "gemini-2.5-flash-lite",
    system_instruction=SYSTEM_PROMPT,
)


def build_user_context(niche: str, tone: str, platform: str, topic: str) -> str:
    return f"""
CREATOR PROFILE:
- Niche: {niche}
- Voice & tone: {tone}
- Primary platform: {platform}
- Topic to cover: {topic}

Use this profile to personalize every output.
The content must sound exactly like this creator — not like a generic AI tool.
"""


def _parse_json_response(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def generate_ideas(topic, platform, format, niche, tone) -> list[dict]:
    user_context = build_user_context(niche, tone, platform, topic)

    prompt = f"""
{user_context}

TASK: Generate exactly 8 video ideas for this creator.

Requirements:
- Each idea must be specific to their niche ({niche})
- Format preference: {format}
- Ideas must feel native to {platform}
- Titles must be scroll-stopping, not generic
- Hook previews must create immediate curiosity

Return ONLY this JSON:
[
  {{
    "title": "specific punchy title",
    "hook_preview": "exact first sentence that stops the scroll",
    "format": "{format}",
    "platform": "{platform}",
    "potential": "High potential|Trending topic|Viral format"
  }}
]
"""
    response = model.generate_content(prompt)
    return _parse_json_response(response.text)


def generate_script(idea_title, hook_preview, platform, tone, niche) -> dict:
    user_context = build_user_context(niche, tone, platform, idea_title)

    prompt = f"""
{user_context}

TASK: Write 3 script variants for this video.

Video title: {idea_title}
Opening hook: {hook_preview}

VARIANT RULES:
- aggressive: bold claims, strong opinions, slightly controversial, punchy short sentences
- storytelling: starts with personal moment, builds emotion, ends with lesson
- educational: clear numbered structure, actionable, "here's exactly how" energy

Each script = max 60 seconds when spoken aloud (~150 words total).

For EACH variant:
- hook (0-3 sec): one sentence, maximum tension or curiosity
- problem (3-15 sec): the pain point in 2-3 short sentences, make them feel it
- solution (15-45 sec): the insight or answer, 3-4 sentences, specific not vague
- cta (45-60 sec): one clear next action, not "follow me" — something valuable

Return ONLY this JSON:
{{
  "aggressive": {{
    "hook": "...",
    "problem": "...",
    "solution": "...",
    "cta": "..."
  }},
  "storytelling": {{
    "hook": "...",
    "problem": "...",
    "solution": "...",
    "cta": "..."
  }},
  "educational": {{
    "hook": "...",
    "problem": "...",
    "solution": "...",
    "cta": "..."
  }}
}}
"""
    response = model.generate_content(prompt)
    return _parse_json_response(response.text)
