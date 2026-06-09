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


def generate_visual_script(idea_title, hook_phrase, platform, tone, niche, template=None) -> dict:
    import re

    from services.templates import DEFAULT_TEMPLATE, scene_count_range

    tmpl = template or DEFAULT_TEMPLATE
    lo, hi = scene_count_range(tmpl)
    ph = tmpl.get("phrase") or {}
    min_w = int(ph.get("min_words", 4))
    max_w = int(ph.get("max_words", 8))
    phrase_tone = ph.get("tone", "conversational, real, not motivational poster")
    structure = tmpl.get("structure") or ["hook", "body", "body", "punch"]
    shots = tmpl.get("shots") or [
        "wide", "close-up", "over-the-shoulder", "detail", "reaction", "screen recording",
    ]
    grade = tmpl.get("color_grade", "dark_cinematic")
    vibe = tmpl.get("music_vibe", "dark ambient")
    structure_str = " -> ".join(str(s) for s in structure)
    shots_str = ", ".join(str(s) for s in shots)

    lang = "Russian" if re.search(r"[Ѐ-ӿ]", f"{idea_title} {hook_phrase}") else "English"
    prompt = f"""
You are creating a visual b-roll script for a short-form video.
Style: aesthetic, cinematic, dark, intentional — like @heyeaslo on Instagram.

Idea: {idea_title}
Opening hook: {hook_phrase}
Creator niche: {niche}
Platform: {platform}

LANGUAGE: Write EVERYTHING in {lang}. Every "phrase", every "film_suggestion", and the "caption"
MUST be written in {lang}. Do not use any other language anywhere in the output.

Create a storyboard of {lo}-{hi} scenes — short scenes for a montage, not a few long ones. Each scene has:
- An on-screen line, lowercase, {min_w} to {max_w} words; the final "punch" line can be shorter
- A detailed filming suggestion: describe the exact shot in 10-18 words: camera framing/angle, the subject, the action, and the setting or lighting (so the creator knows precisely what to film)
- Duration in seconds (each scene at least 3 seconds)

Narrative shape to follow across the scenes: {structure_str}.
Last scene is the "punch" — the shortest, most impactful line.

Rules for phrases:
- lowercase always
- {min_w}-{max_w} words so the words can reveal one by one on the beat — never a wordy sentence
- tone: {phrase_tone}
- commas are fine; no periods except "." at the end of the very last phrase
- each phrase stands alone but flows into the next

Rules for filming suggestions:
- realistic shots the creator can film with a phone, and relevant to the actual topic/product
- be specific and detailed: shot type + subject + action + setting/light
- vary the shots across scenes, drawing from these types: {shots_str}

Also write a ready-to-post caption for {platform} in {lang}:
- 1-2 short sentences that hook the viewer and describe what the video is about (not too short, not a wall of text)
- then 4-6 relevant, specific hashtags on a new line
- natural and tailored to the topic, not generic

IMPORTANT: the "scenes" array below shows the SHAPE, not the count — return {lo} to {hi} scene objects.
The first scene is "hook", the very last is "punch", everything between is "body".

Return ONLY valid JSON:
{{
  "title": "{idea_title}",
  "platform": "{platform}",
  "scenes": [
    {{
      "order": 1,
      "phrase": "on-screen line of {min_w} to {max_w} words",
      "film_suggestion": "detailed shot: framing + subject + action + setting/light",
      "duration_seconds": 4,
      "role": "hook"
    }},
    {{
      "order": 2,
      "phrase": "another line that flows on",
      "film_suggestion": "...",
      "duration_seconds": 3,
      "role": "body"
    }},
    {{
      "order": "... continue body scenes until you have {lo}-{hi} total ...",
      "phrase": "...",
      "film_suggestion": "...",
      "duration_seconds": 3,
      "role": "body"
    }},
    {{
      "order": {hi},
      "phrase": "the punch.",
      "film_suggestion": "...",
      "duration_seconds": 3,
      "role": "punch"
    }}
  ],
  "music_vibe": "{vibe}",
  "color_grade": "{grade}",
  "caption": "two short sentences that sell the video, then 4-6 hashtags on a new line"
}}
"""
    response = model.generate_content(prompt)
    script = _parse_json_response(response.text)
    # The template owns the look — force grade/vibe so the rendered montage matches
    # the chosen template regardless of what the model echoed back.
    script["color_grade"] = grade
    script["music_vibe"] = vibe
    return script
