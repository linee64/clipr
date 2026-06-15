"""X (Twitter) auto-posting: OAuth 2.0 PKCE, durable token store, video upload, post.

The app has no per-user auth yet (it's a solo-creator tool), so there is exactly
ONE connected X account for the whole backend. Its tokens live in the same storage
bucket the renderer already uses, at `twitter/account.json`, mirroring the jobstore
pattern — so a process restart (the Railway box gets OOM-killed often) doesn't drop
the connection. Transient OAuth state (the PKCE verifier for an in-flight connect)
is parked at `twitter/oauth_state/<state>.json` for the few seconds the dance takes.

Everything here is coded against the verified X API v2 contract:
  - OAuth2 Authorization Code + PKCE, confidential client (Basic auth on /token).
  - Refresh tokens ROTATE — every refresh returns a new refresh_token; persist it.
  - Video upload is the v2 CHUNKED flow INIT -> APPEND(1MB) -> FINALIZE -> poll STATUS
    on https://api.x.com/2/media/upload (multipart; the client sets the boundary).
  - Create post: POST /2/tweets { text, media: { media_ids: [id] } }.
"""

import asyncio
import base64
import hashlib
import json
import logging
import os
import secrets
import time
from pathlib import Path
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv

from services.storage import BUCKET, local_file_path, use_local_storage

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger("clipr.twitter")

# --- X API endpoints (v2) ---------------------------------------------------
AUTHORIZE_URL = "https://x.com/i/oauth2/authorize"
TOKEN_URL = "https://api.x.com/2/oauth2/token"
MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload"
TWEETS_URL = "https://api.x.com/2/tweets"
ME_URL = "https://api.x.com/2/users/me"

# media.write covers every /2/media/upload call; offline.access yields the refresh
# token we need to post unattended; the rest are required companions for posting.
SCOPES = "tweet.read tweet.write users.read media.write offline.access"

ACCOUNT_KEY = "twitter/account.json"
STATE_PREFIX = "twitter/oauth_state/"
STATE_TTL_SECS = 600  # an in-flight connect is abandoned if it takes > 10 min

UPLOAD_CHUNK = 1024 * 1024  # 1 MB — the only officially documented chunk size
PROCESS_POLL_TIMEOUT = 150.0  # cap on waiting for X to transcode the video
TWEET_MAX_CHARS = 280


class TwitterError(RuntimeError):
    """Generic failure talking to X — message is safe to surface to the user."""


class TwitterNotConfigured(TwitterError):
    """The backend is missing TWITTER_CLIENT_ID / SECRET / CALLBACK env vars."""


class TwitterNotConnected(TwitterError):
    """No X account is connected yet — the user must run the OAuth connect first."""


class TwitterAuthExpired(TwitterError):
    """An authed X call returned 401 — the access token needs a reactive refresh."""


# Serializes token refreshes so two overlapping posts can't both spend the same
# (rotating, single-use) refresh token and invalidate each other.
_refresh_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
def _env(name: str) -> str:
    return (os.getenv(name) or "").strip().strip('"').strip("'")


def _client_id() -> str:
    return _env("TWITTER_CLIENT_ID")


def _client_secret() -> str:
    return _env("TWITTER_CLIENT_SECRET")


def _callback_url() -> str:
    # Must match the redirect URI registered in the X portal byte-for-byte. It
    # points at the frontend passthrough route, which forwards here.
    return _env("TWITTER_CALLBACK_URL")


def _post_connect_url() -> str:
    # Where to send the browser after a successful connect. Default to the frontend
    # dashboard derived from the callback's origin if not set explicitly.
    explicit = _env("TWITTER_POST_CONNECT_URL")
    if explicit:
        return explicit
    cb = _callback_url()
    if cb:
        try:
            from urllib.parse import urlparse

            p = urlparse(cb)
            return f"{p.scheme}://{p.netloc}/dashboard"
        except Exception:
            pass
    return "/dashboard"


def is_configured() -> bool:
    return bool(_client_id() and _client_secret() and _callback_url())


def _require_configured() -> None:
    if not is_configured():
        raise TwitterNotConfigured(
            "X (Twitter) is not configured on the server. Set TWITTER_CLIENT_ID, "
            "TWITTER_CLIENT_SECRET and TWITTER_CALLBACK_URL."
        )


def _basic_auth_header() -> dict:
    raw = f"{_client_id()}:{_client_secret()}".encode("utf-8")
    return {"Authorization": "Basic " + base64.b64encode(raw).decode("ascii")}


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
# PKCE helpers
# ---------------------------------------------------------------------------
def _make_pkce() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


# ---------------------------------------------------------------------------
# OAuth: connect
# ---------------------------------------------------------------------------
async def build_authorize_url() -> str:
    """Start an OAuth connect: mint a state + PKCE pair, persist them, return the URL."""
    _require_configured()
    state = secrets.token_urlsafe(24)
    verifier, challenge = _make_pkce()
    await _write_json(
        f"{STATE_PREFIX}{state}.json",
        {"code_verifier": verifier, "created": time.time()},
    )
    params = {
        "response_type": "code",
        "client_id": _client_id(),
        "redirect_uri": _callback_url(),
        "scope": SCOPES,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(code: str, state: str) -> dict:
    """Finish the connect: validate state, swap code for tokens, store the account."""
    _require_configured()
    state_key = f"{STATE_PREFIX}{state}.json"
    saved = await _read_json(state_key)
    if not saved or not saved.get("code_verifier"):
        raise TwitterError("Invalid or expired OAuth state — please connect again.")
    if time.time() - float(saved.get("created") or 0) > STATE_TTL_SECS:
        await _delete(state_key)
        raise TwitterError("This connect link expired — please connect again.")

    body = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": _callback_url(),
        "code_verifier": saved["code_verifier"],
        "client_id": _client_id(),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TOKEN_URL,
            data=body,
            headers={
                **_basic_auth_header(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    if resp.status_code != 200:
        # Log the upstream detail server-side; never reflect the raw provider body
        # back to the browser (it lands in the dashboard URL / history / logs).
        logger.warning("X token exchange failed (%s): %s", resp.status_code, resp.text[:500])
        raise TwitterError("Couldn't connect your X account — please try again.")
    tok = resp.json()

    account = {
        "access_token": tok["access_token"],
        "refresh_token": tok.get("refresh_token", ""),
        "scope": tok.get("scope", SCOPES),
        "expires_at": time.time() + float(tok.get("expires_in", 7200)),
        "connected_at": time.time(),
    }
    # Best-effort: attach the handle so the UI can show who's connected.
    try:
        account.update(await _fetch_me(account["access_token"]))
    except Exception:
        pass

    await _write_json(ACCOUNT_KEY, account)
    await _delete(state_key)
    return _public_account(account)


async def _fetch_me(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            ME_URL, headers={"Authorization": f"Bearer {access_token}"}
        )
    if resp.status_code != 200:
        return {}
    data = (resp.json() or {}).get("data") or {}
    return {
        "user_id": data.get("id", ""),
        "username": data.get("username", ""),
        "name": data.get("name", ""),
    }


# ---------------------------------------------------------------------------
# OAuth: token lifecycle
# ---------------------------------------------------------------------------
async def _refresh(account: dict) -> dict:
    """Exchange the (rotating) refresh token for a fresh access + refresh token."""
    refresh_token = account.get("refresh_token")
    if not refresh_token:
        raise TwitterNotConnected(
            "X session expired and can't be refreshed — please reconnect your account."
        )
    body = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": _client_id(),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TOKEN_URL,
            data=body,
            headers={
                **_basic_auth_header(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    if resp.status_code != 200:
        raise TwitterNotConnected(
            "Couldn't refresh your X session — please reconnect your account."
        )
    tok = resp.json()
    account["access_token"] = tok["access_token"]
    # Rotation: X invalidates the old refresh token and returns a new one. If a
    # refresh ever omits it, keep the previous (still-valid) one rather than wipe it.
    if tok.get("refresh_token"):
        account["refresh_token"] = tok["refresh_token"]
    account["scope"] = tok.get("scope", account.get("scope", SCOPES))
    account["expires_at"] = time.time() + float(tok.get("expires_in", 7200))
    await _write_json(ACCOUNT_KEY, account)
    return account


async def _get_valid_account() -> dict:
    account = await _read_json(ACCOUNT_KEY)
    if not account or not account.get("access_token"):
        raise TwitterNotConnected("No X account connected. Connect one in Settings first.")
    # Refresh a minute before expiry so the upload/post never races the clock.
    if time.time() < float(account.get("expires_at") or 0) - 60:
        return account
    # Serialize the refresh + re-read inside the lock: a concurrent post may have
    # already rotated the token, so don't spend the now-stale refresh token again.
    async with _refresh_lock:
        account = await _read_json(ACCOUNT_KEY) or account
        if time.time() >= float(account.get("expires_at") or 0) - 60:
            account = await _refresh(account)
        return account


async def _force_refresh() -> dict:
    """Reactive refresh (after a 401), serialized like the proactive path."""
    async with _refresh_lock:
        account = await _read_json(ACCOUNT_KEY)
        if not account or not account.get("access_token"):
            raise TwitterNotConnected("No X account connected. Connect one in Settings first.")
        return await _refresh(account)


# ---------------------------------------------------------------------------
# Status / disconnect
# ---------------------------------------------------------------------------
def _public_account(account: dict) -> dict:
    return {
        "connected": True,
        "username": account.get("username", ""),
        "name": account.get("name", ""),
    }


async def get_status() -> dict:
    account = await _read_json(ACCOUNT_KEY)
    if not account or not account.get("access_token"):
        return {"connected": False, "configured": is_configured()}
    return {**_public_account(account), "configured": is_configured()}


async def disconnect() -> None:
    await _delete(ACCOUNT_KEY)


# ---------------------------------------------------------------------------
# Posting: chunked video upload + create post
# ---------------------------------------------------------------------------
def _media_id_from(payload: dict) -> str:
    data = payload.get("data") or payload
    return str(data.get("id") or data.get("media_id_string") or data.get("media_id") or "")


def _processing_info(payload: dict) -> dict:
    data = payload.get("data") or payload
    return data.get("processing_info") or {}


async def _upload_video(access_token: str, file_path: str) -> str:
    total_bytes = os.path.getsize(file_path)
    if total_bytes <= 0:
        raise TwitterError("The rendered video file is empty.")
    auth = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=120) as client:
        # INIT — declare the upload. total_bytes must be the EXACT file size.
        init = await client.post(
            MEDIA_UPLOAD_URL,
            headers=auth,
            files={
                "command": (None, "INIT"),
                "media_type": (None, "video/mp4"),
                "media_category": (None, "amplify_video"),
                "total_bytes": (None, str(total_bytes)),
            },
        )
        if init.status_code == 401:
            raise TwitterAuthExpired("X rejected the access token on INIT.")
        if init.status_code not in (200, 201, 202):
            raise TwitterError(f"Media INIT failed ({init.status_code}): {init.text[:300]}")
        media_id = _media_id_from(init.json())
        if not media_id:
            raise TwitterError("X did not return a media id on INIT.")

        # APPEND — stream the file in 1 MB segments, indexed 0,1,2,... with no gaps.
        segment = 0
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(UPLOAD_CHUNK)
                if not chunk:
                    break
                ap = await client.post(
                    MEDIA_UPLOAD_URL,
                    headers=auth,
                    files={
                        "command": (None, "APPEND"),
                        "media_id": (None, media_id),
                        "segment_index": (None, str(segment)),
                        "media": ("chunk", chunk, "application/octet-stream"),
                    },
                )
                if ap.status_code == 401:
                    raise TwitterAuthExpired("X rejected the access token on APPEND.")
                if ap.status_code not in (200, 201, 204):
                    raise TwitterError(
                        f"Media APPEND #{segment} failed ({ap.status_code}): {ap.text[:200]}"
                    )
                segment += 1

        # FINALIZE — close the upload; video then transcodes asynchronously.
        fin = await client.post(
            MEDIA_UPLOAD_URL,
            headers=auth,
            files={"command": (None, "FINALIZE"), "media_id": (None, media_id)},
        )
        if fin.status_code == 401:
            raise TwitterAuthExpired("X rejected the access token on FINALIZE.")
        if fin.status_code not in (200, 201):
            raise TwitterError(f"Media FINALIZE failed ({fin.status_code}): {fin.text[:300]}")

        await _await_processing(client, auth, media_id, _processing_info(fin.json()))

    return media_id


async def _await_processing(
    client: httpx.AsyncClient, auth: dict, media_id: str, info: dict
) -> None:
    """Poll STATUS until the video is transcoded. Attaching it earlier is rejected."""
    deadline = time.time() + PROCESS_POLL_TIMEOUT
    state = (info or {}).get("state", "succeeded")
    check_after = float((info or {}).get("check_after_secs") or 1)

    while state in ("pending", "in_progress"):
        if time.time() > deadline:
            raise TwitterError("Timed out waiting for X to process the video.")
        await asyncio.sleep(max(1.0, min(check_after, 10.0)))
        resp = await client.get(
            MEDIA_UPLOAD_URL, headers=auth, params={"command": "STATUS", "media_id": media_id}
        )
        if resp.status_code == 401:
            raise TwitterAuthExpired("X rejected the access token on STATUS.")
        if resp.status_code != 200:
            raise TwitterError(f"Media STATUS failed ({resp.status_code}): {resp.text[:200]}")
        info = _processing_info(resp.json())
        state = info.get("state", "succeeded")
        check_after = float(info.get("check_after_secs") or check_after)

    if state == "failed":
        err = (info or {}).get("error") or {}
        raise TwitterError(f"X failed to process the video: {err.get('message', 'unknown error')}")


async def _create_post(access_token: str, text: str, media_id: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TWEETS_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"text": text, "media": {"media_ids": [media_id]}},
        )
    if resp.status_code == 401:
        raise TwitterAuthExpired("X rejected the access token on post.")
    if resp.status_code not in (200, 201):
        raise TwitterError(f"Posting to X failed ({resp.status_code}): {resp.text[:300]}")
    return (resp.json() or {}).get("data") or {}


async def _upload_and_post(account: dict, file_path: str, text: str) -> dict:
    access_token = account["access_token"]
    media_id = await _upload_video(access_token, file_path)
    data = await _create_post(access_token, text, media_id)

    tweet_id = str(data.get("id") or "")
    username = account.get("username") or ""
    url = (
        f"https://x.com/{username}/status/{tweet_id}"
        if username and tweet_id
        else (f"https://x.com/i/status/{tweet_id}" if tweet_id else "")
    )
    return {"id": tweet_id, "url": url}


async def post_video(file_path: str, caption: str) -> dict:
    """Upload a rendered video and publish it as a post. Returns {id, url}.

    If a token is revoked before its expiry (X returns 401), do one reactive
    refresh-and-retry rather than failing the whole post on a recoverable state.
    """
    _require_configured()
    account = await _get_valid_account()
    text = (caption or "").strip()[:TWEET_MAX_CHARS]
    try:
        return await _upload_and_post(account, file_path, text)
    except TwitterAuthExpired:
        account = await _force_refresh()
        return await _upload_and_post(account, file_path, text)
