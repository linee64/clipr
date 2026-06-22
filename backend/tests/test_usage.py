"""Unit tests for the free-tier meter (services/usage.py): email normalization, the
trial-day math, and the reserve/refund/check_quota enforcement flow (DB calls are
monkeypatched so these are pure-logic tests)."""
import asyncio
import datetime as dt

import pytest

from services import usage


def _run(coro):
    return asyncio.run(coro)


def _patch_pro(monkeypatch, is_pro: bool):
    async def fake_is_pro(email):
        return is_pro

    monkeypatch.setattr(usage, "_is_pro", fake_is_pro)


# --------------------------------------------------------------------------- _norm
@pytest.mark.parametrize(
    "raw,expected",
    [
        ("A@B.Co", "a@b.co"),
        ("  user@example.com  ", "user@example.com"),
        ("USER@Example.COM", "user@example.com"),
    ],
)
def test_norm_valid(raw, expected):
    assert usage._norm(raw) == expected


@pytest.mark.parametrize("raw", ["", None, "notanemail", "no@domain", "@x.co", "a@b"])
def test_norm_invalid(raw):
    assert usage._norm(raw) == ""


# ---------------------------------------------------------------------- _trial_left
def _iso(days_ago: int) -> str:
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days_ago)).isoformat()


def test_trial_no_start_defaults_full():
    assert usage._trial_left({}) == (usage.TRIAL_DAYS, False)


def test_trial_just_started():
    assert usage._trial_left({"trial_started_at": _iso(0)}) == (usage.TRIAL_DAYS, False)


def test_trial_one_day_in():
    days_left, expired = usage._trial_left({"trial_started_at": _iso(1)})
    assert days_left == usage.TRIAL_DAYS - 1
    assert expired is False


def test_trial_expired_at_limit():
    days_left, expired = usage._trial_left({"trial_started_at": _iso(usage.TRIAL_DAYS)})
    assert days_left == 0
    assert expired is True


def test_trial_long_expired():
    days_left, expired = usage._trial_left({"trial_started_at": _iso(99)})
    assert days_left == 0
    assert expired is True


def test_trial_bad_string_defaults_full():
    assert usage._trial_left({"trial_started_at": "not-a-date"}) == (usage.TRIAL_DAYS, False)


# ----------------------------------------------------------------------- check_quota
def test_check_quota_under_limit_ok(monkeypatch):
    _patch_pro(monkeypatch, False)

    async def fake_ensure(email):
        return {"regen_used": usage.FREE_LIMITS["regen"] - 1}

    monkeypatch.setattr(usage, "_ensure", fake_ensure)
    _run(usage.check_quota("a@b.co", "regen"))  # must not raise


def test_check_quota_at_limit_raises(monkeypatch):
    _patch_pro(monkeypatch, False)

    async def fake_ensure(email):
        return {"regen_used": usage.FREE_LIMITS["regen"]}

    monkeypatch.setattr(usage, "_ensure", fake_ensure)
    with pytest.raises(usage.QuotaExceeded):
        _run(usage.check_quota("a@b.co", "regen"))


def test_check_quota_pro_is_noop(monkeypatch):
    _patch_pro(monkeypatch, True)

    async def boom(email):
        raise AssertionError("Pro must not hit the accounts table")

    monkeypatch.setattr(usage, "_ensure", boom)
    _run(usage.check_quota("a@b.co", "regen"))  # must not raise


def test_check_quota_table_missing_fails_open(monkeypatch):
    _patch_pro(monkeypatch, False)

    async def fake_ensure(email):
        raise RuntimeError("accounts table missing")

    monkeypatch.setattr(usage, "_ensure", fake_ensure)
    _run(usage.check_quota("a@b.co", "regen"))  # fail OPEN -> must not raise


# --------------------------------------------------------------------------- reserve
def test_reserve_under_limit_ok(monkeypatch):
    _patch_pro(monkeypatch, False)
    monkeypatch.setattr(usage, "_reserve_sync", lambda e, f, lim: True)
    _run(usage.reserve("a@b.co", "voiceover"))  # must not raise


def test_reserve_over_limit_raises(monkeypatch):
    _patch_pro(monkeypatch, False)
    monkeypatch.setattr(usage, "_reserve_sync", lambda e, f, lim: False)
    with pytest.raises(usage.QuotaExceeded):
        _run(usage.reserve("a@b.co", "voiceover"))


def test_reserve_pro_is_noop(monkeypatch):
    _patch_pro(monkeypatch, True)

    def boom(e, f, lim):
        raise AssertionError("Pro must not reserve")

    monkeypatch.setattr(usage, "_reserve_sync", boom)
    _run(usage.reserve("a@b.co", "voiceover"))  # must not raise


@pytest.mark.parametrize("email", ["", "notanemail"])
def test_reserve_no_email_is_noop(monkeypatch, email):
    def boom(e, f, lim):
        raise AssertionError("must not reserve without a valid email")

    monkeypatch.setattr(usage, "_reserve_sync", boom)
    _run(usage.reserve(email, "voiceover"))  # must not raise


def test_reserve_rpc_error_falls_back(monkeypatch):
    _patch_pro(monkeypatch, False)

    def boom(e, f, lim):
        raise RuntimeError("clipr_consume_usage RPC missing")

    monkeypatch.setattr(usage, "_reserve_sync", boom)
    calls = []

    async def fake_check(email, action):
        calls.append(("check", email, action))

    async def fake_record(email, action):
        calls.append(("record", email, action))

    monkeypatch.setattr(usage, "check_quota", fake_check)
    monkeypatch.setattr(usage, "record_use", fake_record)
    _run(usage.reserve("a@b.co", "voiceover"))
    assert ("check", "a@b.co", "voiceover") in calls
    assert ("record", "a@b.co", "voiceover") in calls


# ---------------------------------------------------------------------------- refund
def test_refund_calls_sync_with_field(monkeypatch):
    _patch_pro(monkeypatch, False)
    seen = []
    monkeypatch.setattr(usage, "_refund_sync", lambda e, f: seen.append((e, f)))
    _run(usage.refund("a@b.co", "voiceover"))
    assert seen == [("a@b.co", "voiceover_used")]


def test_refund_pro_is_noop(monkeypatch):
    _patch_pro(monkeypatch, True)

    def boom(e, f):
        raise AssertionError("Pro must not refund")

    monkeypatch.setattr(usage, "_refund_sync", boom)
    _run(usage.refund("a@b.co", "voiceover"))  # must not raise


def test_refund_failure_fails_open(monkeypatch):
    _patch_pro(monkeypatch, False)

    def boom(e, f):
        raise RuntimeError("db down")

    monkeypatch.setattr(usage, "_refund_sync", boom)
    _run(usage.refund("a@b.co", "voiceover"))  # fail OPEN -> must not raise


# ---------------------------------------------------------------------- reserve_video
def test_reserve_video_under_limit_ok(monkeypatch):
    async def fake_limit(email):
        return usage.VIDEO_LIMITS["free"]

    monkeypatch.setattr(usage, "_video_limit", fake_limit)
    monkeypatch.setattr(usage, "_video_reserve_sync", lambda e, lim: True)
    _run(usage.reserve_video("a@b.co"))


def test_reserve_video_over_limit_raises(monkeypatch):
    async def fake_limit(email):
        return usage.VIDEO_LIMITS["free"]

    monkeypatch.setattr(usage, "_video_limit", fake_limit)
    monkeypatch.setattr(usage, "_video_reserve_sync", lambda e, lim: False)
    with pytest.raises(usage.QuotaExceeded) as exc:
        _run(usage.reserve_video("a@b.co"))
    assert exc.value.action == "video"
    assert exc.value.limit == usage.VIDEO_LIMITS["free"]


def test_reserve_video_pro_uses_pro_limit(monkeypatch):
    seen = []

    async def fake_limit(email):
        return usage.VIDEO_LIMITS["pro"]

    def fake_reserve(email, limit):
        seen.append(limit)
        return True

    monkeypatch.setattr(usage, "_video_limit", fake_limit)
    monkeypatch.setattr(usage, "_video_reserve_sync", fake_reserve)
    _run(usage.reserve_video("a@b.co"))
    assert seen == [usage.VIDEO_LIMITS["pro"]]


def test_refund_video_calls_sync(monkeypatch):
    seen = []
    monkeypatch.setattr(usage, "_refund_sync", lambda e, f: seen.append((e, f)))
    _run(usage.refund_video("a@b.co"))
    assert seen == [("a@b.co", "videos_used")]


def test_reserve_video_skips_unlimited_allowlist(monkeypatch):
    import asyncio

    async def fake_unlimited(email):
        return email == "vip@clipr.test"

    monkeypatch.setattr(usage.billing, "is_unlimited_pro", fake_unlimited)

    def boom(*_a, **_k):
        raise AssertionError("should not reserve")

    monkeypatch.setattr(usage, "_video_reserve_sync", boom)
    _run(usage.reserve_video("vip@clipr.test"))
