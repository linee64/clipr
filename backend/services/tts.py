"""ElevenLabs text-to-speech: AI voiceover for b-roll renders.

Each storyboard scene's phrase is spoken by an ElevenLabs voice (eleven_multilingual_v2)
and laid onto the montage at the scene's timestamp (the mixing itself lives in
services.editor.mix_voiceover_per_scene). This module only talks to the ElevenLabs API.

Config: ELEVENLABS_API_KEY in backend/.env. Missing/placeholder key -> is_configured()
is False and the voice routes return a clear 503 instead of crashing the server. The
SDK is imported lazily inside the functions so a missing `elevenlabs` package surfaces
as a clean runtime error on first use, not an import-time crash of the whole app
(mirrors how services.editor defers faster_whisper).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _env(name: str) -> str:
    # .env values may be quoted — strip wrapping quotes/whitespace (mirrors the other
    # services so a copy-pasted, quoted key still works).
    return (os.getenv(name) or "").strip().strip('"').strip("'")


ELEVENLABS_API_KEY = _env("ELEVENLABS_API_KEY")
# eleven_multilingual_v2: high-quality, multi-language (handles the non-English
# phrases Clipr's storyboards can produce). The model the task pins us to.
MODEL_ID = "eleven_multilingual_v2"
# 44.1kHz/128kbps mp3 — matches the project's audio (transcode_to_mp3 / mixing all
# run at 44100) so no resample surprises when we mix the voiceover into the montage.
OUTPUT_FORMAT = "mp3_44100_128"
# ElevenLabs only honours voice speed within this band; clamp so a stray value can't
# 422 the API (or, on older SDKs, get silently rejected).
_SPEED_MIN, _SPEED_MAX = 0.7, 1.2


class TTSNotConfigured(RuntimeError):
    """ELEVENLABS_API_KEY is missing/placeholder."""


class TTSError(RuntimeError):
    """ElevenLabs API/SDK returned an error or unexpected payload."""


def is_configured() -> bool:
    return bool(ELEVENLABS_API_KEY) and ELEVENLABS_API_KEY not in (
        "your_elevenlabs_api_key",
        "your_key_here",
    )


def _require_configured() -> None:
    if not is_configured():
        raise TTSNotConfigured(
            "ELEVENLABS_API_KEY is not configured on the server. Add it to backend/.env."
        )


def _client():
    """Build an ElevenLabs client (configured key required). The SDK import is lazy so
    a missing package fails here, with a clear hint, instead of at app import."""
    _require_configured()
    try:
        from elevenlabs.client import ElevenLabs
    except ImportError as e:  # package not installed
        raise TTSError("Install the ElevenLabs SDK: pip install elevenlabs") from e
    return ElevenLabs(api_key=ELEVENLABS_API_KEY)


def _voice_settings(speed: float):
    """VoiceSettings for the generation, clamping speed to the supported band. `speed`
    is a relatively new setting; if the installed SDK/model predates it, fall back to
    the same settings without it rather than erroring."""
    from elevenlabs import VoiceSettings

    spd = max(_SPEED_MIN, min(float(speed or 1.0), _SPEED_MAX))
    base = dict(stability=0.5, similarity_boost=0.75, style=0.0, use_speaker_boost=True)
    try:
        return VoiceSettings(**base, speed=spd)
    except (TypeError, ValueError):
        # Older SDK builds reject an unknown `speed` kwarg — a plain class raises
        # TypeError, a pydantic model raises ValidationError (a ValueError). Anything
        # else (e.g. a real bug) is left to propagate rather than silently swallowed.
        return VoiceSettings(**base)


def get_available_voices() -> list[dict]:
    """List the account's ElevenLabs voices as lean dicts for the frontend picker."""
    client = _client()
    try:
        resp = client.voices.get_all()
    except Exception as e:
        raise TTSError(f"Couldn't fetch ElevenLabs voices: {e}") from e
    voices = getattr(resp, "voices", None) or []
    out: list[dict] = []
    for v in voices:
        out.append(
            {
                "voice_id": getattr(v, "voice_id", "") or "",
                "name": getattr(v, "name", "") or "",
                "category": getattr(v, "category", "") or "",
                "labels": dict(getattr(v, "labels", {}) or {}),
                "preview_url": getattr(v, "preview_url", "") or "",
            }
        )
    return out


def text_to_speech(
    text: str, output_path: str, voice_id: str, speed: float = 1.0
) -> str:
    """Synthesize `text` with `voice_id` and write the mp3 to `output_path`."""
    text = (text or "").strip()
    if not text:
        raise TTSError("Empty text for voiceover.")
    if not (voice_id or "").strip():
        raise TTSError("A voice_id is required for voiceover.")
    client = _client()
    settings = _voice_settings(speed)
    try:
        audio = client.text_to_speech.convert(
            voice_id=voice_id,
            model_id=MODEL_ID,
            text=text,
            output_format=OUTPUT_FORMAT,
            voice_settings=settings,
        )
        with open(output_path, "wb") as f:
            # convert() returns a generator of byte chunks; tolerate a bytes return too.
            if isinstance(audio, (bytes, bytearray)):
                f.write(audio)
            else:
                for chunk in audio:
                    if chunk:
                        f.write(chunk)
    except TTSError:
        raise
    except Exception as e:
        raise TTSError(f"ElevenLabs TTS failed: {e}") from e
    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise TTSError("ElevenLabs returned no audio.")
    return output_path


def generate_voiceover_for_scenes(
    scenes: list[dict], output_dir: str, voice_id: str, speed: float = 1.0
) -> list[dict]:
    """Synthesize one voiceover clip per scene phrase.

    `scenes` are timed scene dicts (each with at least "phrase" and "start_time" —
    e.g. the output of editor.build_scene_timings_from_cuts). Returns the scenes that
    got a voiceover, each augmented with the "audio_path" of its mp3, ready to hand to
    mix_voiceover_per_scene. Scenes without a phrase are skipped.
    """
    os.makedirs(output_dir, exist_ok=True)
    results: list[dict] = []
    for i, scene in enumerate(scenes or []):
        phrase = str(scene.get("phrase", "")).strip()
        if not phrase:
            continue
        out_path = os.path.join(output_dir, f"vo_{i:03d}.mp3")
        text_to_speech(phrase, out_path, voice_id, speed)
        results.append(
            {
                # index into the passed-in `scenes` list, so the caller can line each
                # clip back up with its scene (e.g. to re-time captions to the voice).
                "index": i,
                "audio_path": out_path,
                "start_time": float(scene.get("start_time", 0.0)),
                "duration_seconds": float(scene.get("duration_seconds", 0.0)),
                "phrase": phrase,
            }
        )
    return results
