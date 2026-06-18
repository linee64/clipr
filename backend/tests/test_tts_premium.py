"""Premium-voice gating (services/tts.py): ElevenLabs names are "Name - description";
matching is on the leading name, case-insensitive. Custom voices have no " - "."""
import pytest

from services import tts


@pytest.mark.parametrize(
    "name",
    [
        "George - Warm, Captivating Storyteller",
        "george",
        "GEORGE - whatever",
        "Harry - British narration",
        "Matilda - ...",
        "NARXOZ MIMIC",
        "narxoz mimic",
        "Jiggy",
    ],
)
def test_premium_voices(name):
    assert tts.is_premium_voice(name) is True


@pytest.mark.parametrize(
    "name",
    [
        "Rachel - Calm",
        "Sarah",
        "",
        "Georgina - not George",  # leading name is "georgina", not premium
    ],
)
def test_non_premium_voices(name):
    assert tts.is_premium_voice(name) is False
