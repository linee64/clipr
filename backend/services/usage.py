"""Server-side free-tier: per-account (email) trial clock + usage metering.

This is the trust boundary the UI gates mirror — clearing browser storage can't
grant more free usage, because the counts and the trial start live in the Supabase
`accounts` table (see migrations/002_accounts.sql), keyed by email.

Pro (an active Polar subscription) bypasses regen/voiceover limits and unlocks
premium features. All accounts are metered on monthly video renders:
  - Free: 5 videos/month
  - Pro: 20 videos/month
Free accounts also get:
  - a 5-day trial (countdown, surfaced in /api/billing/status),
  - `regen` (storyboard regenerations): 3,
  - `voiceover` (AI-voiceover renders): 2,
  - premium AI voices and premium reference styles are blocked.
"""

import asyncio
import logging
import re
from datetime import datetime, timezone

from services import billing, tts, templates
from services.storage import _get_supabase

logger = logging.getLogger("clipr.usage")

import os

ACCOUNTS_TABLE = "accounts"
TRIAL_DAYS = 5
FREE_LIMITS = {"regen": 3, "voiceover": 2}
VIDEO_LIMITS = {"free": 5, "pro": 20}

async def _get_limits(email: str) -> dict:
    base_free = {"regen": 3, "voiceover": 2, "video": 5}
    if not email: return base_free
    if await billing.is_unlimited_pro(email):
        return {"regen": float("inf"), "voiceover": float("inf"), "video": float("inf")}
    sub = await billing.get_status(email)
    if sub.get("unlimited"):
        return {"regen": float("inf"), "voiceover": float("inf"), "video": float("inf")}
    if not sub.get("active"):
        return base_free
    pid = sub.get("product_id") or ""
    if pid == os.getenv("POLAR_PRODUCT_ID_6M"):
        return {"regen": float("inf"), "voiceover": float("inf"), "video": 50}
    if pid == os.getenv("POLAR_PRODUCT_ID_3M"):
        return {"regen": float("inf"), "voiceover": float("inf"), "video": 20}
    return {"regen": 10, "voiceover": 10, "video": 10}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class QuotaExceeded(RuntimeError):
    """A free account hit a free-tier limit for `action`."""

    def __init__(self, action: str, limit: int):
        self.action = action
        self.limit = limit
        super().__init__(f"Free limit reached for {action} ({limit}).")


class PremiumRequired(RuntimeError):
    """A free account tried to use a Pro-only feature (premium voice / reference)."""


def _norm(email: str | None) -> str:
    e = (email or "").strip().lower()
    return e if _EMAIL_RE.match(e) else ""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _current_period() -> str:
    """UTC calendar month key for monthly video metering (YYYY-MM)."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _videos_used_this_month(account: dict, field: str = "videos_used") -> int:
    if account.get("videos_period") != _current_period():
        return 0
    return int(account.get(field) or 0)


def _reset_videos_period_if_needed_sync(email: str) -> None:
    """Zero the monthly usage counters when the calendar month has rolled over."""
    sb = _get_supabase()
    cur = _ensure_sync(email)
    period = _current_period()
    if cur.get("videos_period") == period:
        return
    sb.table(ACCOUNTS_TABLE).update(
        {"videos_used": 0, "regen_used": 0, "voiceover_used": 0, "videos_period": period, "updated_at": _now_iso()}
    ).eq("email", email).execute()


def _touch_videos_period_sync(email: str) -> None:
    _get_supabase().table(ACCOUNTS_TABLE).update(
        {"videos_period": _current_period(), "updated_at": _now_iso()}
    ).eq("email", email).execute()


# ---------------------------------------------------------------------------
# accounts table access (sync, wrapped in to_thread)
# ---------------------------------------------------------------------------
def _ensure_sync(email: str) -> dict:
    """Read the account row, creating it (and starting the trial) on first touch."""
    sb = _get_supabase()
    res = sb.table(ACCOUNTS_TABLE).select("*").eq("email", email).limit(1).execute()
    rows = res.data or []
    if rows:
        return rows[0]
    sb.table(ACCOUNTS_TABLE).upsert({"email": email}, on_conflict="email").execute()
    res = sb.table(ACCOUNTS_TABLE).select("*").eq("email", email).limit(1).execute()
    return (res.data or [{"email": email}])[0]


def _bump_sync(email: str, field: str) -> int:
    """Atomically increment a usage counter.

    Uses a Postgres function (migrations/003_usage_increment.sql) so two concurrent
    requests for the same email can't lose an update (the old read-in-Python-then-write
    let both read N and both write N+1, undercounting and letting a free user exceed the
    cap). Falls back to the read-modify-write if that function isn't present yet, so the
    meter keeps working before the migration is applied.
    """
    sb = _get_supabase()
    _ensure_sync(email)  # guarantee the row exists before we increment it
    try:
        res = sb.rpc("clipr_bump_usage", {"p_email": email, "p_field": field}).execute()
        val = res.data
        if isinstance(val, list):
            val = val[0] if val else None
        if val is not None:
            return int(val)
    except Exception as e:
        logger.warning(
            "atomic usage RPC unavailable, falling back to read-modify-write: %s", e
        )
    cur = _ensure_sync(email)
    val = int(cur.get(field) or 0) + 1
    sb.table(ACCOUNTS_TABLE).update({field: val, "updated_at": _now_iso()}).eq(
        "email", email
    ).execute()
    return val


async def _ensure(email: str) -> dict:
    return await asyncio.to_thread(_ensure_sync, email)


# ---------------------------------------------------------------------------
# Trial
# ---------------------------------------------------------------------------
def _trial_left(account: dict) -> tuple[int, bool]:
    """(whole days left, expired) for the account's 5-day trial."""
    started = account.get("trial_started_at")
    start_dt = None
    if isinstance(started, str) and started:
        try:
            start_dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
        except ValueError:
            start_dt = None
    if start_dt is None:
        return TRIAL_DAYS, False
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    used_days = (datetime.now(timezone.utc) - start_dt).days
    days_left = max(0, TRIAL_DAYS - used_days)
    return days_left, days_left <= 0


# ---------------------------------------------------------------------------
# Enforcement
# ---------------------------------------------------------------------------
async def _is_pro(email: str) -> bool:
    return await billing.is_active(email)


async def check_quota(email: str | None, action: str) -> None:
    email = _norm(email)
    if not email: return
    limits = await _get_limits(email)
    limit = limits.get(action, 0)
    if limit == float("inf"): return
    
    try:
        await asyncio.to_thread(_reset_videos_period_if_needed_sync, email)
        account = await _ensure(email)
        used = _videos_used_this_month(account, f"{action}_used")
    except Exception as e:
        logger.warning("usage meter unavailable for %s/%s: %s", email, action, e)
        return
    if used >= limit:
        raise QuotaExceeded(action, limit)


async def record_use(email: str | None, action: str) -> None:
    email = _norm(email)
    if not email: return
    limits = await _get_limits(email)
    if limits.get(action, 0) == float("inf"): return
    try:
        await asyncio.to_thread(_reset_videos_period_if_needed_sync, email)
        await asyncio.to_thread(_bump_sync, email, f"{action}_used")
        await asyncio.to_thread(_touch_videos_period_sync, email)
    except Exception as e:
        logger.warning("usage increment failed for %s/%s: %s", email, action, e)


async def consume(email: str | None, action: str) -> None:
    """Enforce + record one use in a single call (for in-request, trivially retryable
    actions). For async/expensive work prefer reserve() up front + refund() on failure,
    so concurrent requests can't exceed the cap and a failure doesn't burn a credit.

    Pro accounts are unlimited (no-op). Free accounts: raise QuotaExceeded once the
    limit is reached, otherwise increment the counter.
    """
    await check_quota(email, action)
    await record_use(email, action)


def _reserve_sync(email: str, field: str, limit: int) -> bool:
    """Atomic check-and-increment via clipr_consume_usage: increments only while under
    the limit, in ONE statement, so concurrent same-email requests serialize on the row
    and can't collectively exceed the cap. Returns True if reserved, False if over.
    Raises if the RPC is unavailable (caller falls back)."""
    sb = _get_supabase()
    _ensure_sync(email)  # the conditional UPDATE needs the row to exist
    res = sb.rpc(
        "clipr_consume_usage", {"p_email": email, "p_field": field, "p_limit": limit}
    ).execute()
    val = res.data
    if isinstance(val, list):
        val = val[0] if val else None
    return val is not None  # NULL -> over the limit (no row updated)


async def reserve(email: str | None, action: str) -> None:
    email = _norm(email)
    if not email: return
    limits = await _get_limits(email)
    limit = limits.get(action, 0)
    if limit == float("inf"): return
    try:
        await asyncio.to_thread(_reset_videos_period_if_needed_sync, email)
        reserved = await asyncio.to_thread(_reserve_sync, email, f"{action}_used", limit)
    except Exception as e:
        logger.warning("atomic reserve unavailable for %s/%s, falling back: %s", email, action, e)
        await check_quota(email, action)
        await record_use(email, action)
        return
    if not reserved:
        raise QuotaExceeded(action, limit)
    await asyncio.to_thread(_touch_videos_period_sync, email)


def _refund_sync(email: str, field: str) -> None:
    sb = _get_supabase()
    try:
        sb.rpc("clipr_refund_usage", {"p_email": email, "p_field": field}).execute()
        return
    except Exception:
        pass  # RPC absent (pre-migration) -> best-effort read-modify-write decrement
    cur = _ensure_sync(email)
    val = max(int(cur.get(field) or 0) - 1, 0)
    sb.table(ACCOUNTS_TABLE).update({field: val, "updated_at": _now_iso()}).eq(
        "email", email
    ).execute()


async def refund(email: str | None, action: str) -> None:
    email = _norm(email)
    if not email: return
    limits = await _get_limits(email)
    if limits.get(action, 0) == float("inf"): return
    try:
        await asyncio.to_thread(_refund_sync, email, f"{action}_used")
    except Exception as e:
        logger.warning("usage refund failed for %s/%s: %s", email, action, e)


async def reserve_video(email: str | None) -> None:
    email = _norm(email)
    if not email: return
    limits = await _get_limits(email)
    limit = limits.get("video", 0)
    if limit == float("inf"): return
    try:
        reserved = await asyncio.to_thread(_video_reserve_sync, email, limit)
    except Exception as e:
        logger.warning("atomic video reserve unavailable for %s, falling back: %s", email, e)
        try:
            await asyncio.to_thread(_reset_videos_period_if_needed_sync, email)
            account = await _ensure(email)
            used = _videos_used_this_month(account)
        except Exception as inner:
            logger.warning("video meter unavailable for %s: %s", email, inner)
            return
        if used >= limit:
            raise QuotaExceeded("video", limit)
        await asyncio.to_thread(_bump_sync, email, "videos_used")
        await asyncio.to_thread(_touch_videos_period_sync, email)
        return
    if not reserved:
        raise QuotaExceeded("video", limit)


def _video_reserve_sync(email: str, limit: int) -> bool:
    _reset_videos_period_if_needed_sync(email)
    reserved = _reserve_sync(email, "videos_used", limit)
    if reserved:
        _touch_videos_period_sync(email)
    return reserved


async def refund_video(email: str | None) -> None:
    """Release a previously reserved monthly video credit (best-effort)."""
    email = _norm(email)
    if not email:
        return
    try:
        await asyncio.to_thread(_refund_sync, email, "videos_used")
    except Exception as e:
        logger.warning("video refund failed for %s: %s", email, e)


async def require_voice_allowed(email: str | None, voice_id: str) -> None:
    """Block a Pro-only voice for a free account."""
    if not voice_id:
        return
    if await _is_pro(_norm(email)):
        return
    # is_premium_voice_id may do a one-time blocking ElevenLabs fetch on a cold cache;
    # run it off the event loop so it can't freeze concurrent requests (e.g. status polls).
    if await asyncio.to_thread(tts.is_premium_voice_id, voice_id):
        raise PremiumRequired("This AI voice is available on Pro.")


async def require_template_allowed(email: str | None, template_id: str) -> None:
    """Block a Pro-only reference style for a free account."""
    if not template_id:
        return
    if await _is_pro(_norm(email)):
        return
    if templates.is_premium_template_id(template_id):
        raise PremiumRequired("This reference style is available on Pro.")


# ---------------------------------------------------------------------------
# Status (for /api/billing/status)
# ---------------------------------------------------------------------------
async def account_status(email: str | None) -> dict:
    """Trial + usage snapshot for an email; starts the trial on first call."""
    email = _norm(email)
    limits = await _get_limits(email) if email else await _get_limits("")
    unlimited = limits.get("video") == float("inf")
    base = {
        "trial_days_left": TRIAL_DAYS,
        "trial_expired": False,
        "regen_used": 0,
        "regen_limit": None if limits.get("regen") == float("inf") else limits.get("regen"),
        "voiceover_used": 0,
        "voiceover_limit": None if limits.get("voiceover") == float("inf") else limits.get("voiceover"),
        "videos_used": 0,
        "videos_limit": None if limits.get("video") == float("inf") else limits.get("video"),
        "unlimited": unlimited,
    }
    if not email:
        return base
    try:
        account = await _ensure(email)
    except Exception as e:
        logger.warning("accounts read failed for %s: %s", email, e)
        return base
    days_left, expired = _trial_left(account)
    return {
        **base,
        "trial_days_left": days_left,
        "trial_expired": expired,
        "regen_used": _videos_used_this_month(account, "regen_used"),
        "voiceover_used": _videos_used_this_month(account, "voiceover_used"),
        "videos_used": _videos_used_this_month(account, "videos_used"),
        "videos_limit": base["videos_limit"],
        "unlimited": unlimited,
    }
