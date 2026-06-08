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


IDEA_PROMPT = """
You are Clipr's content strategist for aesthetic b-roll short-form videos.

Target creator: {niche}, tone: {tone}, platform: {platform}
Topic: {topic}

Generate 8 video ideas in the style of @heyeaslo — dark aesthetic b-roll,
text overlays, no talking head, cinematic feel.

Each idea is a MOMENT or CONTRAST that resonates emotionally with founders/creators.
Think: "What discipline actually looks like", "building solo", "2am coding sessions"

Rules:
- Title max 6 words, lowercase preferred
- Must feel real and personal, not corporate
- Should make the viewer think "this is literally me"
- No buzzwords, no generic motivational content

Return ONLY valid JSON:
[
  {{
    "title": "short punchy title",
    "hook_phrase": "first text that appears on screen",
    "vibe": "dark and focused|late night energy|grind aesthetic|raw founder life",
    "platform": "{platform}",
    "potential": "High potential|Trending topic|Viral format"
  }}
]
"""


def generate_ideas(topic, platform, format, niche, tone) -> list[dict]:
    prompt = IDEA_PROMPT.format(
        niche=niche,
        tone=tone,
        platform=platform,
        topic=topic,
    )
    response = model.generate_content(prompt)
    return _parse_json_response(response.text)


def generate_visual_script(idea_title, hook_phrase, platform, tone, niche) -> dict:
    prompt = f"""
You are creating a visual b-roll script for a short-form video.
Style: aesthetic, cinematic, dark, minimal text — like @heyeaslo on Instagram.

Idea: {idea_title}
Opening hook: {hook_phrase}
Creator niche: {niche}
Platform: {platform}

Create a storyboard of 4-6 scenes. Each scene has:
- A short text phrase that appears on screen (max 5 words, lowercase)
- What to film for that scene (simple, realistic, 3-5 words)
- Duration in seconds (2-4 seconds each)

The sequence should tell a story or build tension that pays off at the end.
Last scene always has the shortest, most impactful phrase — the "punch".

Rules for phrases:
- lowercase always
- no punctuation except "." at end of last phrase
- conversational, real, not motivational poster
- each phrase stands alone but flows into the next

Rules for filming suggestions:
- realistic things a founder can film with iPhone
- specific: "hands on keyboard" not "working"
- variety: desk shots, screen glow, coffee cup, empty chair, phone screen, etc.

Return ONLY valid JSON:
{{
  "title": "{idea_title}",
  "platform": "{platform}",
  "scenes": [
    {{
      "order": 1,
      "phrase": "text shown on screen",
      "film_suggestion": "what to film",
      "duration_seconds": 3,
      "role": "hook"
    }},
    {{
      "order": 2,
      "phrase": "...",
      "film_suggestion": "...",
      "duration_seconds": 3,
      "role": "body"
    }},
    {{
      "order": 3,
      "phrase": "...",
      "film_suggestion": "...",
      "duration_seconds": 3,
      "role": "body"
    }},
    {{
      "order": 4,
      "phrase": "...",
      "film_suggestion": "...",
      "duration_seconds": 2,
      "role": "punch"
    }}
  ],
  "music_vibe": "dark ambient|lo-fi beats|atmospheric|minimal electronic",
  "color_grade": "dark_cinematic|moody|high_contrast"
}}
"""
    response = model.generate_content(prompt)
    return _parse_json_response(response.text)
