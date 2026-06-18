"""Premium reference-style gating (services/templates.py): matched by title substring
against PREMIUM_REF_TITLES, reading the template's `ref`/`label`, case-insensitive,
tolerating a leading "ref:" prefix."""
import pytest

from services import templates


@pytest.mark.parametrize(
    "t",
    [
        {"ref": "Locked In"},
        {"ref": "ref: Locked In"},
        {"label": "The Feeling of Building"},
        {"ref": "boring life montage"},  # substring match
        {"label": "LOCKED IN"},
    ],
)
def test_premium_templates(t):
    assert templates.is_premium_template(t) is True


@pytest.mark.parametrize(
    "t",
    [
        {"ref": "Came From Nothing"},
        {"label": "Break the Pattern"},
        {},
        {"ref": ""},
    ],
)
def test_non_premium_templates(t):
    assert templates.is_premium_template(t) is False
