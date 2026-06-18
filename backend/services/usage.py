"""Server-side free-tier: per-account (email) trial clock + usage metering.

This is the trust boundary the UI gates mirror — clearing browser storage can't
grant more free usage, because the counts and the trial start live in the Supabase
`accounts` table (see migrations/002_accounts.sql), keyed by email.

Pro (an active Polar subscription) bypasses everything. Free accounts get:
  - a 3-day trial (countdown, surfaced in /api/billing/status),
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

ACCOUNTS_TABLE = "accounts"
TRIAL_DAYS = 3
FREE_LIMITS = {"regen": 3, "voiceover": 2}

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
    """(whole days left, expired) for the account's 3-day trial."""
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
    """Raise QuotaExceeded if a free account is already at the limit for `action`,
    WITHOUT recording a use.

    Use this as an up-front gate for expensive/async work (e.g. an AI-voiceover render
    that runs in the background and can fail/OOM): the caller checks quota here to return
    429 immediately, then calls record_use() only once the work actually succeeds — so a
    failed render never burns a free credit.

    Pro accounts are unlimited (no-op). With no resolvable email, or if the accounts
    table is missing / a transient DB error occurs, we fail OPEN (allow) so
    billing-adjacent flows keep working.
    """
    email = _norm(email)
    if not email or action not in FREE_LIMITS:
        return
    if await _is_pro(email):
        return
    try:
        account = await _ensure(email)
        used = int(account.get(f"{action}_used") or 0)
    except Exception as e:
        logger.warning("usage meter unavailable for %s/%s: %s", email, action, e)
        return
    if used >= FREE_LIMITS[action]:
        raise QuotaExceeded(action, FREE_LIMITS[action])


async def record_use(email: str | None, action: str) -> None:
    """Record one use of a metered `action` (no enforcement). Call this only AFTER the
    work genuinely succeeded. Pro is a no-op; failures fail OPEN (logged, not raised)."""
    email = _norm(email)
    if not email or action not in FREE_LIMITS:
        return
    if await _is_pro(email):
        return
    try:
        await asyncio.to_thread(_bump_sync, email, f"{action}_used")
    except Exception as e:
        logger.warning("usage increment failed for %s/%s: %s", email, action, e)


async def consume(email: str | None, action: str) -> None:
    """Enforce + record one use in a single call (for in-request, trivially retryable
    actions). For async/expensive work prefer check_quota() up front + record_use() on
    success, so a failure doesn't burn a free credit.

    Pro accounts are unlimited (no-op). Free accounts: raise QuotaExceeded once the
    limit is reached, otherwise increment the counter.
    """
    await check_quota(email, action)
    await record_use(email, action)


async def require_voice_allowed(email: str | None, voice_id: str) -> None:
    """Block a Pro-only voice for a free account."""
    if not voice_id:
        return
    if await _is_pro(_norm(email)):
        return
    if tts.is_premium_voice_id(voice_id):
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
    base = {
        "trial_days_left": TRIAL_DAYS,
        "trial_expired": False,
        "regen_used": 0,
        "regen_limit": FREE_LIMITS["regen"],
        "voiceover_used": 0,
        "voiceover_limit": FREE_LIMITS["voiceover"],
    }
    email = _norm(email)
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
        "regen_used": int(account.get("regen_used") or 0),
        "voiceover_used": int(account.get("voiceover_used") or 0),
    }
