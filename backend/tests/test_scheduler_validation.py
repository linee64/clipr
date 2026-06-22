"""Scheduler input validation (services/scheduler.py): cid/id sanitization (guards the
storage prefix) and the NaN/Infinity scheduled_at rejection (round-4 fix)."""
import asyncio

import pytest

from services import scheduler
from services.scheduler import ScheduleError


def _run(coro):
    return asyncio.run(coro)


@pytest.mark.parametrize("cid", ["abcdef12", "a_b-C9a_b-C9", "X" * 64, "Mix_3d-ID99"])
def test_safe_cid_valid(cid):
    assert scheduler._safe_cid(cid) == cid.strip()


@pytest.mark.parametrize("cid", ["", None, "short", "x" * 65, "has space", "bad/char", "dot.dot"])
def test_safe_cid_invalid(cid):
    with pytest.raises(ScheduleError):
        scheduler._safe_cid(cid)


def test_key_valid_hex():
    assert scheduler._key("a1b2c3d4") == "schedules/a1b2c3d4.json"


@pytest.mark.parametrize("sid", ["", "NOThex", "g" * 10, "../escape", "a" * 7])
def test_key_invalid(sid):
    with pytest.raises(ScheduleError):
        scheduler._key(sid)


@pytest.mark.parametrize("when", [float("nan"), float("inf"), float("-inf"), 0, -5])
def test_create_schedule_rejects_bad_time(when):
    # These all fail validation BEFORE any storage write, so the coroutine raises
    # synchronously under asyncio.run (no I/O, no event-loop fixture needed).
    with pytest.raises(ScheduleError):
        _run(
            scheduler.create_schedule(
                "validcid123", "twitter", "https://x/y.mp4", "", "", when
            )
        )


@pytest.mark.parametrize("platform", ["", "facebook", "youtube"])
def test_create_schedule_rejects_bad_platform(platform):
    with pytest.raises(ScheduleError):
        _run(scheduler.create_schedule("validcid123", platform, "https://x/y.mp4", "", "", 9e9))


def test_create_schedule_accepts_instagram(monkeypatch):
    saved: list[dict] = []

    async def fake_write(key, value):
        saved.append(value)

    monkeypatch.setattr(scheduler, "_write", fake_write)
    result = _run(
        scheduler.create_schedule(
            "validcid123", "instagram", "https://x/y.mp4", "caption", "title", 9e9
        )
    )
    assert result["platform"] == "instagram"
    assert saved and saved[0]["platform"] == "instagram"
