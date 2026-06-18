"""Polar billing endpoints.

  POST /api/billing/checkout -> { url }           ; redirect the browser there
  POST /api/billing/portal   -> { url }           ; manage / cancel subscription
  GET  /api/billing/status   -> subscription state for an email
  POST /api/billing/webhook  -> Polar posts subscription events here (verified)

There's no per-user auth yet, so the billing identity is the user's email (the same
clipr_email the frontend stores). See services.billing for the full picture.
"""

import logging

from fastapi import APIRouter, HTTPException, Request

from models.schemas import BillingPortalRequest, CheckoutRequest
from services import billing, usage

router = APIRouter(prefix="/api/billing", tags=["billing"])
logger = logging.getLogger("clipr.billing")


@router.post("/checkout")
async def checkout(request: CheckoutRequest):
    try:
        return {"url": await billing.create_checkout(request.email)}
    except billing.BillingNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except billing.BillingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Unexpected error creating checkout")
        raise HTTPException(status_code=502, detail="Couldn't start checkout.")


@router.post("/portal")
async def portal(request: BillingPortalRequest):
    try:
        return {"url": await billing.create_portal_session(request.email)}
    except billing.BillingNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except billing.BillingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Unexpected error creating portal session")
        raise HTTPException(status_code=502, detail="Couldn't open the billing portal.")


@router.get("/status")
async def status(email: str = ""):
    """Subscription state + the server-side trial clock and free-tier usage counts
    (starts the trial for this email on first call)."""
    sub = await billing.get_status(email)
    acct = await usage.account_status(email)
    return {**sub, **acct}


@router.post("/webhook")
async def webhook(request: Request):
    """Polar -> us. Verify the signature, persist the subscription state, ack 202."""
    payload = await request.body()
    headers = {k: v for k, v in request.headers.items()}
    try:
        await billing.handle_webhook(payload, headers)
    except billing.BillingNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except billing.BillingError as e:
        # Bad signature / malformed event — reject so Polar will retry.
        logger.warning("Rejected Polar webhook: %s", e)
        raise HTTPException(status_code=403, detail=str(e))
    except Exception:
        logger.exception("Unexpected error handling Polar webhook")
        raise HTTPException(status_code=500, detail="Webhook handling failed.")
    return {"received": True}
