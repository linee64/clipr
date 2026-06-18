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
    sb = _get_supabase()
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


async def consume(email: str | None, action: str) -> None:
    """Enforce + record one use of a metered free-tier `action` (regen/voiceover).

    Pro accounts are unlimited (no-op). Free accounts: raise QuotaExceeded once the
    limit is reached, otherwise increment the counter. With no resolvable email we
    can't meter (anonymous/local dev) — allow rather than block.
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
        # Accounts table missing (migration not run yet) or a transient DB error:
        # fail OPEN so billing-adjacent flows keep working. Only a real over-limit
        # (below) blocks.
        logger.warning("usage meter unavailable for %s/%s: %s", email, action, e)
        return
    if used >= FREE_LIMITS[action]:
        raise QuotaExceeded(action, FREE_LIMITS[action])
    try:
        await asyncio.to_thread(_bump_sync, email, f"{action}_used")
    except Exception as e:
        logger.warning("usage increment failed for %s/%s: %s", email, action, e)


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
