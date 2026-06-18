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
