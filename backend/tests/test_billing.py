"""Billing email normalization (services/billing.py) — the identity used for every
subscription/usage lookup; must lowercase/trim and reject malformed input."""
import pytest

from services import billing
from services.billing import BillingError


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("User@Example.Com", "user@example.com"),
        ("  a@b.co  ", "a@b.co"),
    ],
)
def test_normalize_email_valid(raw, expected):
    assert billing._normalize_email(raw) == expected


@pytest.mark.parametrize("raw", ["", None, "notanemail", "a@b", "@x.co"])
def test_normalize_email_invalid(raw):
    with pytest.raises(BillingError):
        billing._normalize_email(raw)


def test_is_unlimited_pro_from_env(monkeypatch):
    monkeypatch.setenv("CLIPR_UNLIMITED_PRO_EMAILS", "Founder@Example.com")
    import asyncio

    assert asyncio.run(billing.is_unlimited_pro("founder@example.com")) is True
    assert asyncio.run(billing.is_unlimited_pro("other@x.co")) is False


def test_is_active_true_for_unlimited_allowlist(monkeypatch):
    import asyncio

    monkeypatch.setenv("CLIPR_UNLIMITED_PRO_EMAILS", "vip@clipr.test")
    assert asyncio.run(billing.is_active("vip@clipr.test")) is True


def test_get_status_marks_unlimited_pro(monkeypatch):
    import asyncio

    monkeypatch.setenv("CLIPR_UNLIMITED_PRO_EMAILS", "vip@clipr.test")
    status = asyncio.run(billing.get_status("vip@clipr.test"))
    assert status["active"] is True
    assert status["plan"] == "pro"
    assert status["unlimited"] is True


def test_is_unlimited_pro_from_db(monkeypatch):
    import asyncio

    monkeypatch.delenv("CLIPR_UNLIMITED_PRO_EMAILS", raising=False)
    monkeypatch.setattr(billing, "_account_unlimited_sync", lambda e: e == "founder@db.test")
    assert asyncio.run(billing.is_unlimited_pro("founder@db.test")) is True
