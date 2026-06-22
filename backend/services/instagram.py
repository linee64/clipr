"""Instagram Reels connect + auto-posting via Meta Graph API (Facebook Login).

Mirrors services.linkedin — per-browser cid scoping, durable token store at
`instagram/accounts/<cid>.json`, OAuth through a frontend passthrough callback.

Requires an Instagram Professional account linked to a Facebook Page. Publishing flow:
  POST /{ig-user-id}/media (media_type=REELS, video_url) -> poll status_code ->
  POST /{ig-user-id}/media_publish

Scopes (2025+ naming): instagram_business_basic, instagram_business_content_publish,
pages_show_list, pages_read_engagement.
"""

import asyncio
import json
import logging
import os
import re
import secrets
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse

import httpx
from dotenv import load_dotenv

from services.storage import BUCKET, local_file_path, use_local_storage

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger("clipr.instagram")

SCOPES = ",".join(
    [
        "instagram_business_basic",
        "instagram_business_content_publish",
        "pages_show_list",
        "pages_read_engagement",
    ]
)

ACCOUNT_PREFIX = "instagram/accounts/"
STATE_PREFIX = "instagram/oauth_state/"
STATE_TTL_SECS = 600
CONTAINER_POLL_TIMEOUT = 300.0
CONTAINER_POLL_INTERVAL = 8.0
CAPTION_MAX_CHARS = 2200

_CID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


class InstagramError(RuntimeError):
    """Generic failure talking to Instagram/Meta — message is safe to surface."""


class InstagramNotConfigured(InstagramError):
    """Missing META_APP_ID / META_APP_SECRET / INSTAGRAM_CALLBACK_URL."""


class InstagramNotConnected(InstagramError):
    """No Instagram account connected for this browser."""


def _safe_cid(cid: str | None) -> str:
    cid = (cid or "").strip()
    if not _CID_RE.match(cid):
        raise InstagramError("Missing or invalid client id — please reconnect.")
    return cid


def _account_key(cid: str) -> str:
    return f"{ACCOUNT_PREFIX}{_safe_cid(cid)}.json"


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip().strip('"').strip("'")


def _app_id() -> str:
    return _env("META_APP_ID")


def _app_secret() -> str:
    return _env("META_APP_SECRET")


def _callback_url() -> str:
    return _env("INSTAGRAM_CALLBACK_URL")


def _post_connect_url() -> str:
    explicit = _env("INSTAGRAM_POST_CONNECT_URL")
    if explicit:
        return explicit
    cb = _callback_url()
    if cb:
        try:
            p = urlparse(cb)
            return f"{p.scheme}://{p.netloc}/dashboard"
        except Exception:
            pass
    return "/dashboard"


def _graph_version() -> str:
    v = _env("META_GRAPH_VERSION") or "v21.0"
    return v if v.startswith("v") else f"v{v}"


def _graph_base() -> str:
    return f"https://graph.facebook.com/{_graph_version()}"


def is_configured() -> bool:
    return bool(_app_id() and _app_secret() and _callback_url())


def _require_configured() -> None:
    if not is_configured():
        raise InstagramNotConfigured(
            "Instagram is not configured on the server. Set META_APP_ID, "
            "META_APP_SECRET and INSTAGRAM_CALLBACK_URL."
        )


def supabase_public_prefix() -> str:
    base = (os.getenv("SUPABASE_URL") or "").strip().strip('"').strip("'").rstrip("/")
    return f"{base}/storage/v1/object/public/{BUCKET}/" if base else ""


def _validate_output_url(output_url: str) -> str:
    url = (output_url or "").strip()
    if not url:
        raise InstagramError("No video URL provided.")
    if url.startswith("http://") or url.startswith("https://"):
        prefix = supabase_public_prefix()
        if not prefix or not url.startswith(prefix):
            raise InstagramError("Refusing to use a video from an unrecognized location.")
        return url
    # Local dev: allow backend file path pattern used by other integrations.
    if "/api/video/files/" in url:
        return url
    raise InstagramError("Unrecognized video URL.")


# ---------------------------------------------------------------------------
# JSON store
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


def _delete_sync(key: str) -> None:
    try:
        if use_local_storage():
            p = local_file_path(key)
            if p.is_file():
                p.unlink()
            return
        from services.storage import _get_supabase

        _get_supabase().storage.from_(BUCKET).remove([key])
    except Exception:
        pass


async def _read_json(key: str) -> dict | None:
    return await asyncio.to_thread(_read_json_sync, key)


async def _write_json(key: str, value: dict) -> None:
    await asyncio.to_thread(_write_json_sync, key, value)


async def _delete(key: str) -> None:
    await asyncio.to_thread(_delete_sync, key)


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------
async def build_authorize_url(cid: str) -> str:
    _require_configured()
    cid = _safe_cid(cid)
    state = secrets.token_urlsafe(24)
    await _write_json(
        f"{STATE_PREFIX}{state}.json",
        {"created": time.time(), "cid": cid},
    )
    params = {
        "client_id": _app_id(),
        "redirect_uri": _callback_url(),
        "state": state,
        "scope": SCOPES,
        "response_type": "code",
    }
    return f"https://www.facebook.com/{_graph_version()}/dialog/oauth?{urlencode(params)}"


async def _exchange_code_for_token(code: str) -> dict:
    params = {
        "client_id": _app_id(),
        "client_secret": _app_secret(),
        "redirect_uri": _callback_url(),
        "code": code,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{_graph_base()}/oauth/access_token", params=params)
    if resp.status_code != 200:
        logger.warning("Meta token exchange failed (%s): %s", resp.status_code, resp.text[:500])
        raise InstagramError("Couldn't connect your Instagram account — please try again.")
    return resp.json()


async def _long_lived_token(short_token: str) -> dict:
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": _app_id(),
        "client_secret": _app_secret(),
        "fb_exchange_token": short_token,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{_graph_base()}/oauth/access_token", params=params)
    if resp.status_code != 200:
        logger.warning("Meta long-lived token failed (%s): %s", resp.status_code, resp.text[:500])
        raise InstagramError("Couldn't finalize your Instagram session — please try again.")
    return resp.json()


async def _resolve_ig_account(user_token: str) -> dict:
    """Pick the first Facebook Page that has a linked Instagram Business account."""
    params = {
        "fields": "name,access_token,instagram_business_account",
        "access_token": user_token,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{_graph_base()}/me/accounts", params=params)
    if resp.status_code != 200:
        logger.warning("Meta pages lookup failed (%s): %s", resp.status_code, resp.text[:500])
        raise InstagramError(
            "Couldn't read your Facebook Pages. Make sure your Instagram Professional "
            "account is linked to a Facebook Page, then try again."
        )
    pages = (resp.json() or {}).get("data") or []
    for page in pages:
        ig = (page or {}).get("instagram_business_account") or {}
        ig_id = str(ig.get("id") or "")
        page_token = str(page.get("access_token") or "")
        if ig_id and page_token:
            profile = await _fetch_ig_profile(ig_id, page_token)
            return {
                "ig_user_id": ig_id,
                "page_id": str(page.get("id") or ""),
                "page_name": str(page.get("name") or ""),
                "access_token": page_token,
                **profile,
            }
    raise InstagramError(
        "No Instagram Professional account found on your Facebook Pages. Link Instagram "
        "to a Page in Meta Business settings, then reconnect."
    )


async def _fetch_ig_profile(ig_user_id: str, access_token: str) -> dict:
    params = {"fields": "username,name", "access_token": access_token}
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{_graph_base()}/{ig_user_id}", params=params)
    if resp.status_code != 200:
        return {"username": "", "name": ""}
    data = resp.json() or {}
    return {
        "username": str(data.get("username") or ""),
        "name": str(data.get("name") or data.get("username") or ""),
    }


async def exchange_code(code: str, state: str) -> dict:
    _require_configured()
    state_key = f"{STATE_PREFIX}{state}.json"
    saved = await _read_json(state_key)
    if not saved or not saved.get("cid"):
        raise InstagramError("Invalid or expired OAuth state — please connect again.")
    await _delete(state_key)
    if time.time() - float(saved.get("created") or 0) > STATE_TTL_SECS:
        raise InstagramError("This connect link expired — please connect again.")
    cid = _safe_cid(saved["cid"])

    short = await _exchange_code_for_token(code)
    short_token = short.get("access_token")
    if not short_token:
        raise InstagramError("Meta returned no access token — please try again.")

    long = await _long_lived_token(short_token)
    user_token = long.get("access_token") or short_token
    expires_in = float(long.get("expires_in") or short.get("expires_in") or 5184000)

    ig = await _resolve_ig_account(user_token)
    account = {
        "user_access_token": user_token,
        "access_token": ig["access_token"],
        "ig_user_id": ig["ig_user_id"],
        "page_id": ig.get("page_id", ""),
        "page_name": ig.get("page_name", ""),
        "username": ig.get("username", ""),
        "name": ig.get("name", "") or ig.get("username", ""),
        "expires_at": time.time() + expires_in,
        "connected_at": time.time(),
    }
    await _write_json(_account_key(cid), account)
    return _public_account(account)


def _public_account(account: dict) -> dict:
    return {
        "connected": True,
        "username": account.get("username", ""),
        "name": account.get("name", ""),
        "ig_user_id": account.get("ig_user_id", ""),
    }


async def get_status(cid: str | None) -> dict:
    try:
        key = _account_key(cid)
    except InstagramError:
        return {"connected": False, "configured": is_configured()}
    account = await _read_json(key)
    if not account or not account.get("access_token") or not account.get("ig_user_id"):
        return {"connected": False, "configured": is_configured()}
    if time.time() >= float(account.get("expires_at") or 0):
        return {"connected": False, "configured": is_configured(), "expired": True}
    return {**_public_account(account), "configured": is_configured()}


async def disconnect(cid: str | None) -> None:
    try:
        key = _account_key(cid)
    except InstagramError:
        return
    await _delete(key)


async def _refresh_user_token(account: dict, cid: str) -> dict:
    user_token = account.get("user_access_token") or account.get("access_token")
    if not user_token:
        return account
    refreshed = await _long_lived_token(user_token)
    new_token = refreshed.get("access_token")
    if not new_token:
        return account
    account["user_access_token"] = new_token
    expires_in = float(refreshed.get("expires_in") or 5184000)
    account["expires_at"] = time.time() + expires_in
    ig = await _resolve_ig_account(new_token)
    account.update(
        {
            "access_token": ig["access_token"],
            "ig_user_id": ig["ig_user_id"],
            "page_id": ig.get("page_id", ""),
            "username": ig.get("username", account.get("username", "")),
            "name": ig.get("name", account.get("name", "")),
        }
    )
    await _write_json(_account_key(cid), account)
    return account


async def _get_valid_account(cid: str) -> dict:
    account = await _read_json(_account_key(cid))
    if not account or not account.get("access_token") or not account.get("ig_user_id"):
        raise InstagramNotConnected(
            "No Instagram account connected. Connect one in Settings first."
        )
    if time.time() >= float(account.get("expires_at") or 0) - 86400:
        try:
            account = await _refresh_user_token(account, cid)
        except InstagramError:
            pass
    if time.time() >= float(account.get("expires_at") or 0):
        raise InstagramNotConnected(
            "Your Instagram session expired — please reconnect your account."
        )
    return account


# ---------------------------------------------------------------------------
# Reels publishing
# ---------------------------------------------------------------------------
async def _create_reels_container(
    ig_user_id: str, access_token: str, video_url: str, caption: str
) -> str:
    params = {
        "media_type": "REELS",
        "video_url": video_url,
        "caption": caption,
        "access_token": access_token,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{_graph_base()}/{ig_user_id}/media", params=params)
    if resp.status_code != 200:
        logger.warning("IG container create failed (%s): %s", resp.status_code, resp.text[:500])
        raise InstagramError(
            f"Couldn't prepare your Reel ({resp.status_code}). "
            "Check that the video meets Instagram's format requirements."
        )
    container_id = str((resp.json() or {}).get("id") or "")
    if not container_id:
        raise InstagramError("Instagram didn't return a media container id.")
    return container_id


async def _await_container_ready(container_id: str, access_token: str) -> None:
    deadline = time.time() + CONTAINER_POLL_TIMEOUT
    params = {"fields": "status_code", "access_token": access_token}
    async with httpx.AsyncClient(timeout=30) as client:
        while time.time() < deadline:
            resp = await client.get(f"{_graph_base()}/{container_id}", params=params)
            if resp.status_code != 200:
                raise InstagramError(
                    f"Couldn't check Reel processing status ({resp.status_code})."
                )
            status = str((resp.json() or {}).get("status_code") or "").upper()
            if status == "FINISHED":
                return
            if status == "ERROR":
                raise InstagramError("Instagram couldn't process this video.")
            await asyncio.sleep(CONTAINER_POLL_INTERVAL)
    raise InstagramError("Reel processing timed out — try again in a moment.")


async def _publish_container(ig_user_id: str, access_token: str, container_id: str) -> str:
    params = {"creation_id": container_id, "access_token": access_token}
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{_graph_base()}/{ig_user_id}/media_publish", params=params)
    if resp.status_code != 200:
        logger.warning("IG publish failed (%s): %s", resp.status_code, resp.text[:500])
        raise InstagramError(f"Publishing to Instagram failed ({resp.status_code}).")
    media_id = str((resp.json() or {}).get("id") or "")
    if not media_id:
        raise InstagramError("Instagram published but returned no media id.")
    return media_id


async def _permalink(media_id: str, access_token: str) -> str:
    params = {"fields": "permalink", "access_token": access_token}
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{_graph_base()}/{media_id}", params=params)
    if resp.status_code != 200:
        return ""
    return str((resp.json() or {}).get("permalink") or "")


async def post_reel(output_url: str, caption: str, cid: str) -> dict:
    """Publish a Reel using a validated public video URL (Meta fetches the file).

    Returns {id, url}.
    """
    _require_configured()
    cid = _safe_cid(cid)
    video_url = _validate_output_url(output_url)
    if video_url.startswith("/") or "/api/video/files/" in video_url:
        raise InstagramError(
            "Instagram publishing requires a public HTTPS video URL. "
            "Deploy with Supabase storage or post from a rendered video in production."
        )
    account = await _get_valid_account(cid)
    access_token = account["access_token"]
    ig_user_id = account["ig_user_id"]
    text = (caption or "").strip()[:CAPTION_MAX_CHARS]

    container_id = await _create_reels_container(ig_user_id, access_token, video_url, text)
    await _await_container_ready(container_id, access_token)
    media_id = await _publish_container(ig_user_id, access_token, container_id)
    url = await _permalink(media_id, access_token)
    if not url and account.get("username"):
        url = f"https://www.instagram.com/{account['username']}/"
    return {"id": media_id, "url": url}
