"""vision.py - Google Gemini Vision service for reference frame analysis."""
import os
import json
import base64
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_READY = bool(GEMINI_API_KEY) and GEMINI_API_KEY != "your_gemini_api_key_here"

ANALYSIS_PROMPT = (
    "You are analyzing a single frame from a short-form video (TikTok / Instagram Reel).\n\n"
    "Analyze the frame carefully and return ONLY a valid JSON object (no markdown, no extra text):\n"
    '{"scene_context": "brief Russian description of what is happening visually (e.g. man running, face close-up, city view)", '
    '"subtitle_text": "exact text visible on screen, empty string if none", '
    '"subtitle_position": "top or center or bottom or none", '
    '"subtitle_style": {"uppercase": true_or_false, "bold": true_or_false, "color": "white or yellow or black or other"}}'
    "\n\nRules:\n"
    "- scene_context MUST be in Russian, 2-6 words, very specific about what is happening\n"
    "- subtitle_text must be the EXACT text visible in the frame\n"
    "- If no text overlay exists in the frame, set subtitle_text to empty string\n"
)


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        if start >= 0:
            depth = 0
            for i in range(start, len(text)):
                ch = text[i]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start: i + 1])
                        except Exception:
                            break
    return {}


def analyze_frame_with_gemini(frame_path: str) -> dict:
    """Send a single video frame to Gemini Vision and get scene analysis."""
    empty = {
        "scene_context": "",
        "subtitle_text": "",
        "subtitle_position": "none",
        "subtitle_style": {"uppercase": False, "bold": False, "color": "white"},
    }
    if not GEMINI_READY:
        return empty
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)

        with open(frame_path, "rb") as fh:
            img_bytes = fh.read()

        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=[
                types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                ANALYSIS_PROMPT,
            ],
        )
        raw = response.text or ""
        data = _extract_json(raw)
        return {
            "scene_context": str(data.get("scene_context", "")),
            "subtitle_text": str(data.get("subtitle_text", "")),
            "subtitle_position": str(data.get("subtitle_position", "none")),
            "subtitle_style": data.get("subtitle_style", {"uppercase": False, "bold": False, "color": "white"}),
        }
    except Exception as exc:
        result = dict(empty)
        result["_error"] = str(exc)
        return result


def analyze_frames_batch(frame_paths: list) -> list:
    """Analyze a list of frame images. Returns list of analysis dicts."""
    return [analyze_frame_with_gemini(p) for p in frame_paths]
