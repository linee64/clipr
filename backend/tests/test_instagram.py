"""Instagram/Meta service tests — OAuth state, URL validation, Reels publish flow (mocked httpx)."""
import asyncio
import time

import pytest

from services import instagram
from services.instagram import InstagramError


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def _configure_meta(monkeypatch):
    monkeypatch.setenv("META_APP_ID", "test-app-id")
    monkeypatch.setenv("META_APP_SECRET", "test-secret")
    monkeypatch.setenv("INSTAGRAM_CALLBACK_URL", "https://app.example/api/auth/instagram/callback")
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setenv("SUPABASE_BUCKET", "clipr")


def test_is_configured_true():
    assert instagram.is_configured() is True


def test_validate_output_url_rejects_unknown_host():
    with pytest.raises(InstagramError, match="unrecognized"):
        instagram._validate_output_url("https://evil.example/video.mp4")


def test_validate_output_url_accepts_supabase_public():
    prefix = instagram.supabase_public_prefix()
    url = f"{prefix}renders/out.mp4"
    assert instagram._validate_output_url(url) == url


def test_post_reel_trims_caption(monkeypatch):
    long_caption = "x" * 3000
    seen: list[str] = []

    async def fake_create(ig_user_id, access_token, video_url, caption):
        seen.append(caption)
        return "container-1"

    async def fake_ready(container_id, access_token):
        return None

    async def fake_publish(ig_user_id, access_token, container_id):
        return "media-1"

    async def fake_permalink(media_id, access_token):
        return "https://www.instagram.com/reel/abc/"

    async def fake_account(cid):
        return {
            "access_token": "page-token",
            "ig_user_id": "ig-123",
            "username": "creator",
            "expires_at": time.time() + 3600,
        }

    monkeypatch.setattr(instagram, "_create_reels_container", fake_create)
    monkeypatch.setattr(instagram, "_await_container_ready", fake_ready)
    monkeypatch.setattr(instagram, "_publish_container", fake_publish)
    monkeypatch.setattr(instagram, "_permalink", fake_permalink)
    monkeypatch.setattr(instagram, "_get_valid_account", fake_account)

    prefix = instagram.supabase_public_prefix()
    result = _run(
        instagram.post_reel(f"{prefix}renders/out.mp4", long_caption, "validcid12")
    )
    assert len(seen[0]) == instagram.CAPTION_MAX_CHARS
    assert result == {"id": "media-1", "url": "https://www.instagram.com/reel/abc/"}


def test_exchange_code_rejects_expired_state(monkeypatch):
    state = "state-token-abc"

    async def fake_read(key):
        if key == f"instagram/oauth_state/{state}.json":
            return {"created": time.time() - 9999, "cid": "validcid12"}
        return None

    async def noop_delete(key):
        return None

    monkeypatch.setattr(instagram, "_read_json", fake_read)
    monkeypatch.setattr(instagram, "_delete", noop_delete)

    with pytest.raises(InstagramError, match="expired"):
        _run(instagram.exchange_code("auth-code", state))


def test_post_reel_container_poll_publish_flow(monkeypatch):
    """End-to-end publish with mocked Meta Graph responses."""
    calls: list[tuple[str, str]] = []

    class FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload
            self.text = str(payload)

        def json(self):
            return self._payload

    class FakeClient:
        poll_count = 0

        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, params=None):
            calls.append(("POST", url))
            if url.endswith("/media"):
                return FakeResponse(200, {"id": "container-99"})
            if url.endswith("/media_publish"):
                return FakeResponse(200, {"id": "media-99"})
            return FakeResponse(400, {})

        async def get(self, url, params=None):
            calls.append(("GET", url))
            if "container-99" in url:
                FakeClient.poll_count += 1
                status = "FINISHED" if FakeClient.poll_count >= 1 else "IN_PROGRESS"
                return FakeResponse(200, {"status_code": status})
            if url.endswith("/media-99"):
                return FakeResponse(200, {"permalink": "https://www.instagram.com/reel/xyz/"})
            return FakeResponse(404, {})

    monkeypatch.setattr(instagram.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(instagram, "CONTAINER_POLL_INTERVAL", 0)

    async def fake_account(cid):
        return {
            "access_token": "page-token",
            "ig_user_id": "ig-123",
            "username": "creator",
            "expires_at": time.time() + 3600,
        }

    monkeypatch.setattr(instagram, "_get_valid_account", fake_account)

    prefix = instagram.supabase_public_prefix()
    result = _run(
        instagram.post_reel(f"{prefix}renders/out.mp4", "Hello Reel", "validcid12")
    )
    assert result["id"] == "media-99"
    assert result["url"] == "https://www.instagram.com/reel/xyz/"
    assert any("media_publish" in url for _, url in calls)
