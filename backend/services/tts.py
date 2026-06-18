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


# Voices reserved for Pro subscribers — matched by (case-insensitive) name. The
# picker shows these with a lock for free users; everyone else can use the rest.
PREMIUM_VOICE_NAMES = {
    "george", "harry", "liam", "matilda", "eric",
    "brian", "adam", "bill", "narxoz mimic", "jiggy",
}


def is_premium_voice(name: str) -> bool:
    # ElevenLabs names are "Name - description" (e.g. "George - Warm, Captivating
    # Storyteller"); match on the leading name only. Custom voices like "NARXOZ
    # MIMIC" / "Jiggy" have no " - " and match whole.
    base = (name or "").split(" - ")[0].strip().lower()
    return base in PREMIUM_VOICE_NAMES


def get_available_voices() -> list[dict]:
    """List the account's ElevenLabs voices as lean dicts for the frontend picker.

    Each voice is tagged `premium` (Pro-only) by name; the frontend gates selection.
    """
    client = _client()
    try:
        resp = client.voices.get_all()
    except Exception as e:
        raise TTSError(f"Couldn't fetch ElevenLabs voices: {e}") from e
    voices = getattr(resp, "voices", None) or []
    out: list[dict] = []
    for v in voices:
        name = getattr(v, "name", "") or ""
        out.append(
            {
                "voice_id": getattr(v, "voice_id", "") or "",
                "name": name,
                "category": getattr(v, "category", "") or "",
                "labels": dict(getattr(v, "labels", {}) or {}),
                "preview_url": getattr(v, "preview_url", "") or "",
                "premium": is_premium_voice(name),
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


def generate_single_voiceover(
    scenes: list[dict], output_path: str, voice_id: str, speed: float = 1.0
) -> dict | None:
    """Synthesize the WHOLE narration in ONE call and return where each scene's phrase
    falls within it.

    Generating a separate clip per short phrase made the voiceover choppy — a few words,
    silence, then a different tone mid-thought (each call is its own generation with its
    own prosody). Instead, join every scene's phrase into one flowing text and synthesize
    it in a single call, so the voice keeps one consistent tone and natural cadence. The
    call returns per-character timestamps, so we can map each phrase back to the exact
    [start, end] seconds it's spoken — used to time captions to the voice.

    Returns ``{"audio_path", "spans": [{"index", "phrase", "start", "end"}, ...]}`` (spans
    in audio-relative seconds, scene order), or None if no scene has a phrase.
    """
    import base64

    voiced = [
        (i, str(s.get("phrase", "")).strip())
        for i, s in enumerate(scenes or [])
    ]
    voiced = [(i, p) for i, p in voiced if p]
    if not voiced:
        return None

    # Join phrases into one narration, tracking each phrase's character range so we can
    # map the returned char timestamps back to scenes. ". " gives each line natural
    # sentence prosody (and a clean caption boundary) while staying one continuous take.
    sep = ". "
    text = ""
    char_spans: list[tuple[int, int, int]] = []  # (scene_index, start_idx, end_idx_excl)
    for k, (i, phrase) in enumerate(voiced):
        if k > 0:
            text += sep
        start_idx = len(text)
        text += phrase
        char_spans.append((i, start_idx, len(text)))

    client = _client()
    settings = _voice_settings(speed)
    try:
        resp = client.text_to_speech.convert_with_timestamps(
            voice_id=voice_id,
            model_id=MODEL_ID,
            text=text,
            output_format=OUTPUT_FORMAT,
            voice_settings=settings,
        )
    except TTSError:
        raise
    except Exception as e:
        raise TTSError(f"ElevenLabs timestamped TTS failed: {e}") from e

    audio_b64 = getattr(resp, "audio_base_64", None) or getattr(resp, "audio_base64", None)
    if not audio_b64:
        raise TTSError("ElevenLabs returned no audio.")
    with open(output_path, "wb") as f:
        f.write(base64.b64decode(audio_b64))

    al = getattr(resp, "alignment", None)
    chars = list(getattr(al, "characters", None) or []) if al else []
    cstart = list(getattr(al, "character_start_times_seconds", None) or []) if al else []
    cend = list(getattr(al, "character_end_times_seconds", None) or []) if al else []

    spans: list[dict] = []
    if chars and cstart and cend and len(chars) == len(cstart) == len(cend) == len(text):
        # Exact: phrase span = [start time of its first char, end time of its last char].
        for i, a, b in char_spans:
            st = float(cstart[a])
            en = float(cend[b - 1])
            spans.append({"index": i, "phrase": scenes[i].get("phrase", ""),
                          "start": max(0.0, st), "end": max(st + 0.1, en)})
    else:
        # Fallback (timestamps unavailable/mismatched): spread by character position over
        # the measured audio length.
        from services.editor import get_duration

        total = max(0.1, float(get_duration(output_path)))
        n = max(1, len(text))
        for i, a, b in char_spans:
            spans.append({"index": i, "phrase": scenes[i].get("phrase", ""),
                          "start": total * a / n, "end": max(total * a / n + 0.1, total * b / n)})

    return {"audio_path": output_path, "spans": spans}


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
