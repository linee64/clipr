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
integrations). Webhook signature verification uses polar-sdk's validate_event, which
handles Polar's Standard-Webhooks secret encoding for us.
"""

import asyncio
import base64
import hashlib
import json
import logging
import os
import re
from pathlib import Path

import httpx
from dotenv import load_dotenv

from services.storage import BUCKET, local_file_path, use_local_storage

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger("clipr.billing")

# Where each customer's subscription state is parked (keyed by hashed email).
CUSTOMER_PREFIX = "billing/customers/"

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


def _customer_key(email: str) -> str:
    digest = hashlib.sha256(_normalize_email(email).encode("utf-8")).hexdigest()
    return f"{CUSTOMER_PREFIX}{digest}.json"


# ---------------------------------------------------------------------------
# Tiny JSON store on top of the existing storage backend (bucket or local temp)
# ---------------------------------------------------------------------------
def _read_json_sync(key: str) -> dict | None:
    try:
        if use_local_storage():
            src = local_file_path(key)
            return json.loads(src.read_bytes()) if src.is_file() else None
        from services.storage import _get_supabase

        data = _get_supabase().storage.from_(BUCKET).download(key)
        return json.loads(data)
    except Exception:
        return None


def _write_json_sync(key: str, value: dict) -> None:
    data = json.dumps(value).encode("utf-8")
    if use_local_storage():
        dest = local_file_path(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return
    from services.storage import _get_supabase

    _get_supabase().storage.from_(BUCKET).upload(
        key,
        data,
        file_options={"upsert": "true", "content-type": "application/json"},
    )


async def _read_json(key: str) -> dict | None:
    return await asyncio.to_thread(_read_json_sync, key)


async def _write_json(key: str, value: dict) -> None:
    await asyncio.to_thread(_write_json_sync, key, value)


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


async def create_checkout(email: str) -> str:
    """Create a Polar checkout for the $20/mo product and return its hosted URL."""
    _require_configured()
    email = _normalize_email(email)
    body = {
        "products": [_product_id()],
        "success_url": _success_url(),
        "customer_email": email,
        # Links the Polar customer to our side so the webhook can map it back.
        "external_customer_id": email,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_api_base()}/v1/checkouts/", headers=_auth_headers(), json=body
        )
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
    async with httpx.AsyncClient(timeout=30) as client:
        # Trailing slash is required — Polar 307-redirects the bare path, which a
        # POST won't follow cleanly.
        resp = await client.post(
            f"{_api_base()}/v1/customer-sessions/",
            headers=_auth_headers(),
            json={"external_customer_id": email},
        )
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
async def get_status(email: str | None) -> dict:
    """Return the stored subscription state for an email (Pro vs free)."""
    base = {
        "plan": "free",
        "active": False,
        "status": "",
        "current_period_end": "",
        "cancel_at_period_end": False,
        "configured": is_configured(),
    }
    try:
        key = _customer_key(email or "")
    except BillingError:
        return base
    record = await _read_json(key)
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
    await _write_json(_customer_key(email), record)
    logger.info("Billing: %s -> %s active=%s", email, etype, active)
