import os
from unittest.mock import patch
import pytest
from services.editor import adjust_voiceover_and_cards


def test_adjust_voiceover_and_cards_sync():
    cards = [
        {"text": "Hello world", "beats_per_card": 4},
        {"text": "This is a test", "beats_per_card": 8},
    ]
    spans = [
        {"start": 0.0, "end": 1.5},
        {"start": 2.0, "end": 4.5},
    ]
    
    # 120 BPM, so beat_len = 0.5s
    # Card 1 target dur = 4 * 0.5 = 2.0s. target_speech_dur = 2.0 - 0.35 = 1.65s.
    # Card 1 spoken_dur = 1.5s. speed = 1.5 / 1.65 = 0.909 (within [0.85, 1.25]).
    # Card 1 final_dur = 1.5 / 0.909 + 0.35 = 2.0s.
    
    # Card 2 target dur = 8 * 0.5 = 4.0s. target_speech_dur = 4.0 - 0.35 = 3.65s.
    # Card 2 spoken_dur = 2.5s. speed = 2.5 / 3.65 = 0.685 -> clamped to 0.85.
    # Card 2 final_dur = 2.5 / 0.85 + 0.35 = 3.291s.

    with patch("services.editor._run") as mock_run, patch("os.path.exists", return_value=True):
        retimed = adjust_voiceover_and_cards(
            voiceover_path="dummy.mp3",
            spans=spans,
            cards=cards,
            beat_len=0.5,
            output_path="output.mp3",
            hold_after_end=0.35,
        )
        
        assert len(retimed) == 2
        # Card 1 duration should be exactly 2.0s
        assert abs(retimed[0]["duration"] - 2.0) < 0.01
        assert "beats_per_card" not in retimed[0]
        
        # Card 2 duration should be 2.5 / 0.85 + 0.35 = 3.291s
        assert abs(retimed[1]["duration"] - 3.291) < 0.01
        assert "beats_per_card" not in retimed[1]

        assert mock_run.called
