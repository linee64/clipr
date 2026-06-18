"""Polar billing: checkout, customer portal, and webhook-driven subscription state.

The app has no per-user auth yet, so a subscription is keyed by the user's EMAIL
(the same clipr_email the frontend stores locally). That email is passed to Polar
as both `customer_email` (prefills checkout) and `external_customer_id` (links the
resulting customer to our side), so the webhook can map a subscription event back
onto the right person. The subscription record lives in the storage bucket at
`billing/customers/<sha256(email)>.json` — mirroring the twitter token store, so a
Railway restart doesn't drop who's on Pro.

Flow:
  POST /api/billing/checkout  -> create a Polar checkout, return its hosted URL
  POST /api/billing/portal    -> create a customer-portal session, return its URL
  GET  /api/billing/status    -> { plan, active, status, current_period_end, ... }
  POST /api/billing/webhook   -> Polar posts subscription/order events here; we
                                 verify the Standard-Webhooks signature and persist
                                 the subscription state. This is the source of truth.

Checkout + portal use the documented REST API directly (httpx, like the X/LinkedIn
integrations). Webhook signatures are verified with standardwebhooks directly.

Subscription state lives in the Supabase Postgres table `subscriptions` (keyed by
email), so plan status is queryable/visible in the Supabase dashboard. See
`backend/migrations/001_subscriptions.sql` for the schema — it must exist before
billing works.
"""

import asyncio
import base64
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

from services.storage import _get_supabase

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger("clipr.billing")

# Supabase table holding one row per customer's subscription state.
SUBS_TABLE = "subscriptions"

# Polar subscription statuses that grant Pro access.
ACTIVE_STATUSES = {"active", "trialing"}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class BillingError(RuntimeError):
    """A failure talking to Polar — message is safe to surface to the user."""


class BillingNotConfigured(BillingError):
    """The backend is missing POLAR_ACCESS_TOKEN / POLAR_PRODUCT_ID env vars."""


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
def _env(name: str) -> str:
    return (os.getenv(name) or "").strip().strip('"').strip("'")


def _access_token() -> str:
    return _env("POLAR_ACCESS_TOKEN")


def _product_id() -> str:
    return _env("POLAR_PRODUCT_ID")


def _webhook_secret() -> str:
    return _env("POLAR_WEBHOOK_SECRET")


def _server() -> str:
    # "sandbox" routes to Polar's sandbox; anything else means production.
    return (_env("POLAR_SERVER") or "production").lower()


def _api_base() -> str:
    return (
        "https://sandbox-api.polar.sh"
        if _server() == "sandbox"
        else "https://api.polar.sh"
    )


def _success_url() -> str:
    # Where Polar sends the browser after a successful checkout. Defaults to the
    # dashboard with a flag the frontend reads to show a toast + refresh status.
    explicit = _env("POLAR_SUCCESS_URL")
    if explicit:
        return explicit
    return "http://localhost:3000/dashboard?billing=success"


def is_configured() -> bool:
    return bool(_access_token() and _product_id())


def _require_configured() -> None:
    if not is_configured():
        raise BillingNotConfigured(
            "Billing is not configured on the server. Set POLAR_ACCESS_TOKEN and "
            "POLAR_PRODUCT_ID."
        )


def _auth_headers() -> dict:
    return {
        "Authorization": f"Bearer {_access_token()}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Email -> storage key
# ---------------------------------------------------------------------------
def _normalize_email(email: str | None) -> str:
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise BillingError("A valid email is required to manage your subscription.")
    return email


# ---------------------------------------------------------------------------
# Subscription store — one row per email in the Supabase `subscriptions` table
# ---------------------------------------------------------------------------
def _read_record_sync(email: str) -> dict | None:
    try:
        res = (
            _get_supabase()
            .table(SUBS_TABLE)
            .select("*")
            .eq("email", email)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        logger.warning("subscriptions read failed for %s: %s", email, e)
        return None


def _write_record_sync(email: str, record: dict) -> None:
    row = {**record, "email": email, "updated_at": datetime.now(timezone.utc).isoformat()}
    # Postgres timestamptz rejects an empty string — store NULL when unknown.
    if not row.get("current_period_end"):
        row["current_period_end"] = None
    _get_supabase().table(SUBS_TABLE).upsert(row, on_conflict="email").execute()


async def _read_record(email: str) -> dict | None:
    return await asyncio.to_thread(_read_record_sync, email)


async def _write_record(email: str, record: dict) -> None:
    await asyncio.to_thread(_write_record_sync, email, record)


# ---------------------------------------------------------------------------
# Checkout + customer portal
# ---------------------------------------------------------------------------
def _polar_error_hint(resp: httpx.Response) -> str:
    """A short, non-sensitive Polar error code to append to a user-facing message,
    so misconfig (e.g. a token missing `checkouts:write`) is self-diagnosable.
    Polar returns {"error": "...", "error_description": "..."} or a 422 detail."""
    try:
        body = resp.json() or {}
    except Exception:
        return ""
    code = body.get("error") or ""
    if not code and isinstance(body.get("detail"), list) and body["detail"]:
        code = (body["detail"][0] or {}).get("type") or ""
    return f" [{code}]" if code else ""


async def _polar_post(path: str, body: dict) -> httpx.Response:
    """POST to the Polar API, retrying once on a transient network error.

    A blip reaching Polar (DNS hiccup, dropped connection) otherwise bubbles up as
    an opaque 502; instead we retry, then surface a clear, friendly message.
    """
    url = f"{_api_base()}{path}"
    last: Exception | None = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                return await client.post(url, headers=_auth_headers(), json=body)
        except httpx.RequestError as e:
            last = e
            logger.warning("Polar POST %s network error (attempt %d): %s", path, attempt + 1, e)
    raise BillingError("Couldn't reach Polar — please check your connection and try again.")


async def create_checkout(email: str) -> str:
    """Create a Polar checkout for the $25/mo product and return its hosted URL."""
    _require_configured()
    email = _normalize_email(email)
    body = {
        "products": [_product_id()],
        "success_url": _success_url(),
        "customer_email": email,
        # Links the Polar customer to our side so the webhook can map it back.
        "external_customer_id": email,
    }
    resp = await _polar_post("/v1/checkouts/", body)
    if resp.status_code not in (200, 201):
        logger.warning("Polar checkout failed (%s): %s", resp.status_code, resp.text[:500])
        raise BillingError(
            "Couldn't start checkout" + _polar_error_hint(resp) + " — please try again."
        )
    url = (resp.json() or {}).get("url")
    if not url:
        raise BillingError("Checkout was created but Polar returned no URL.")
    return url


async def create_portal_session(email: str) -> str:
    """Create a customer-portal session (manage / cancel) and return its URL.

    Requires the customer to already exist in Polar (i.e. they've checked out at
    least once); otherwise Polar 404s and we surface a clear message.
    """
    _require_configured()
    email = _normalize_email(email)
    # Trailing slash is required — Polar 307-redirects the bare path, which a POST
    # won't follow cleanly.
    resp = await _polar_post("/v1/customer-sessions/", {"external_customer_id": email})
    # No customer yet (hasn't checked out): Polar 404s, or 422s with a
    # "Customer does not exist" validation error. Either way → friendly message.
    if resp.status_code == 404 or (
        resp.status_code == 422 and "does not exist" in resp.text.lower()
    ):
        raise BillingError("No subscription found for this account yet.")
    if resp.status_code not in (200, 201):
        logger.warning("Polar portal session failed (%s): %s", resp.status_code, resp.text[:500])
        raise BillingError(
            "Couldn't open the billing portal" + _polar_error_hint(resp) + " — please try again."
        )
    url = (resp.json() or {}).get("customer_portal_url")
    if not url:
        raise BillingError("Polar returned no portal URL.")
    return url


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
def _record_from_subscription(email: str, sub: dict) -> dict:
    status = (sub.get("status") or "").lower()
    return {
        "email": email,
        "active": status in ACTIVE_STATUSES,
        "status": status,
        "current_period_end": sub.get("current_period_end") or "",
        "cancel_at_period_end": bool(sub.get("cancel_at_period_end")),
        "subscription_id": sub.get("id") or "",
        "last_event": "reconcile",
    }


async def _reconcile_from_polar(email: str) -> dict | None:
    """Best-effort: ask Polar directly for this customer's subscription, so status
    doesn't depend on the webhook having reached us (important when a local tunnel
    is flaky). Needs `subscriptions:read`; if the token lacks it (403) or anything
    else goes wrong, returns None and we fall back to the stored record."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{_api_base()}/v1/subscriptions/",
                headers={"Authorization": f"Bearer {_access_token()}"},
                params={"external_customer_id": email, "limit": 50},
            )
        if resp.status_code != 200:
            return None
        items = (resp.json() or {}).get("items") or []
        # Match on the customer we linked (external_id) or their email, in case the
        # query param wasn't honoured server-side.
        def _mine(s: dict) -> bool:
            cust = s.get("customer") or {}
            return email in (
                (cust.get("external_id") or "").lower(),
                (cust.get("email") or "").lower(),
            )
        mine = [s for s in items if _mine(s)] or items
        if not mine:
            return None
        chosen = next(
            (s for s in mine if (s.get("status") or "").lower() in ACTIVE_STATUSES),
            mine[0],
        )
        record = _record_from_subscription(email, chosen)
        await _write_record(email, record)
        return record
    except Exception as e:
        logger.warning("Polar reconcile failed for %s: %s", email, e)
        return None


async def is_active(email: str | None) -> bool:
    """Fast Pro check for enforcement: reads the stored subscription record only (no
    Polar reconcile), so it's cheap to call on every gated action. The webhook and
    `get_status` keep that record fresh."""
    try:
        norm = _normalize_email(email or "")
    except BillingError:
        return False
    record = await _read_record(norm)
    return bool(record and record.get("active"))


async def get_status(email: str | None) -> dict:
    """Return the subscription state for an email (Pro vs free).

    Prefers the webhook-written record; if there isn't an active one, falls back to
    asking Polar directly (reconcile) so a missed/late webhook doesn't strand a
    paying user on Free.
    """
    base = {
        "plan": "free",
        "active": False,
        "status": "",
        "current_period_end": "",
        "cancel_at_period_end": False,
        "configured": is_configured(),
    }
    try:
        norm = _normalize_email(email or "")
    except BillingError:
        return base
    record = await _read_record(norm)
    if not record or not record.get("active"):
        fresh = await _reconcile_from_polar(norm)
        if fresh:
            record = fresh
    if not record:
        return base
    active = bool(record.get("active"))
    return {
        **base,
        "plan": "pro" if active else "free",
        "active": active,
        "status": record.get("status", ""),
        "current_period_end": record.get("current_period_end", ""),
        "cancel_at_period_end": bool(record.get("cancel_at_period_end")),
    }


# ---------------------------------------------------------------------------
# Webhook: the source of truth for subscription state
# ---------------------------------------------------------------------------
def _email_from(data: dict) -> str:
    """Pull our identifying email out of a subscription/order payload."""
    customer = data.get("customer") or {}
    # We set external_customer_id == email at checkout, so prefer it; fall back to
    # the customer's email on the order/subscription.
    candidate = (
        data.get("external_customer_id")
        or customer.get("external_id")
        or customer.get("email")
        or data.get("customer_email")
        or ""
    )
    return (candidate or "").strip().lower()


async def handle_webhook(payload: bytes, headers: dict) -> None:
    """Verify a Polar webhook and persist any subscription state change.

    Raises BillingError on a bad signature (the router turns that into a 403).
    Unknown event types are ignored.
    """
    secret = _webhook_secret()
    if not secret:
        raise BillingNotConfigured("POLAR_WEBHOOK_SECRET is not set on the server.")

    # Verify the Standard-Webhooks signature and get the raw JSON. We read the few
    # fields we need straight from the dict rather than going through polar-sdk's
    # strict typed models, so a schema change on Polar's side can't make us reject a
    # legitimately-signed event. The Webhook ctor base64-DECODES its secret, so the
    # `polar_whs_...` secret is base64-encoded first to recover the real signing key.
    from standardwebhooks.webhooks import (  # lazy import so the dep stays optional
        Webhook,
        WebhookVerificationError,
    )

    try:
        wh = Webhook(base64.b64encode(secret.encode()).decode())
        event = wh.verify(payload, headers)  # -> dict, or raises on a bad signature
    except WebhookVerificationError as e:
        raise BillingError(f"Invalid webhook signature: {e}")
    except Exception as e:
        # Malformed signature header / unparseable body — reject (403), not 500.
        raise BillingError(f"Rejected webhook: {e}")

    etype = (event.get("type") or "") if isinstance(event, dict) else ""
    data = (event.get("data") or {}) if isinstance(event, dict) else {}

    # We only care about subscription lifecycle (and the order that creates one).
    if not etype.startswith("subscription."):
        return

    email = _email_from(data)
    if not email or not _EMAIL_RE.match(email):
        logger.warning("Polar %s with no resolvable email — ignoring", etype)
        return

    status = (data.get("status") or "").lower()
    # subscription.revoked => access ended regardless of the status field.
    revoked = etype == "subscription.revoked"
    active = (status in ACTIVE_STATUSES) and not revoked

    record = {
        "email": email,
        "active": active,
        "status": "revoked" if revoked else status,
        "current_period_end": data.get("current_period_end") or "",
        "cancel_at_period_end": bool(data.get("cancel_at_period_end")),
        "subscription_id": data.get("id") or "",
        "last_event": etype,
    }
    await _write_record(email, record)
    logger.info("Billing: %s -> %s active=%s", email, etype, active)
