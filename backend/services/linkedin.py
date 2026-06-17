"""LinkedIn connect + auto-posting: OAuth 2.0 (Authorization Code), durable token
store, video upload, member post.

Modeled on services.twitter — same per-browser scoping and durable token store, so
the two integrations behave identically from the frontend's point of view. There is
no per-user auth yet, so a LinkedIn connection is scoped PER BROWSER by a client id
(cid) the frontend generates and stores locally. Each cid's tokens live in the
storage bucket at `linkedin/accounts/<cid>.json` (survives a Railway restart). This
is NOT real security (a cid is guessable/shareable) — it just stops one tester's
connected account from being visible to every visitor on a shared deploy.

Coded against LinkedIn's documented contract:
  - OAuth 2.0 Authorization Code (confidential client; client_secret in the token
    body, NOT Basic auth — and no PKCE, which LinkedIn doesn't require here).
  - Member identity via OpenID Connect userinfo (`sub` -> urn:li:person:<sub>),
    falling back to the legacy /v2/me when only r_liteprofile is granted.
  - Video post via the versioned REST API: initializeUpload -> PUT the bytes ->
    finalizeUpload -> POST /rest/posts referencing the video URN.

Scopes needed (the LinkedIn app must have the matching products approved):
  - openid, profile  -> identify the member (Sign In with LinkedIn using OIDC)
  - w_member_social  -> create a post on the member's behalf (Share on LinkedIn)
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

logger = logging.getLogger("clipr.linkedin")

# --- LinkedIn endpoints -----------------------------------------------------
AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
USERINFO_URL = "https://api.linkedin.com/v2/userinfo"  # OIDC member identity
ME_URL = "https://api.linkedin.com/v2/me"  # legacy fallback (r_liteprofile)
VIDEOS_URL = "https://api.linkedin.com/rest/videos"
POSTS_URL = "https://api.linkedin.com/rest/posts"

# openid+profile identify the member; w_member_social authorizes posting on their
# behalf. The app's approved products must grant exactly these.
SCOPES = "openid profile w_member_social"

# Versioned REST API: LinkedIn requires a YYYYMM version header on /rest/* calls and
# only keeps ~the last 12 monthly versions active — an older one 426s with
# "NONEXISTENT_VERSION". Default to a known-active recent version, but read it from env
# so it can be bumped without a code change once it ages out: set LINKEDIN_API_VERSION
# to any version your LinkedIn app lists as Supported (Developer Portal > Versioning).
LINKEDIN_VERSION = (
    (os.getenv("LINKEDIN_API_VERSION") or "").strip().strip('"').strip("'") or "202601"
)

ACCOUNT_PREFIX = "linkedin/accounts/"
STATE_PREFIX = "linkedin/oauth_state/"
STATE_TTL_SECS = 600  # an in-flight connect is abandoned if it takes > 10 min

UPLOAD_TIMEOUT = 180.0
PROCESS_POLL_TIMEOUT = 150.0  # cap on waiting for LinkedIn to process the video
# LinkedIn truncates post commentary well above this; keep posts tidy.
COMMENTARY_MAX_CHARS = 2900

_CID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


class LinkedInError(RuntimeError):
    """Generic failure talking to LinkedIn — message is safe to surface to the user."""


class LinkedInNotConfigured(LinkedInError):
    """The backend is missing LINKEDIN_CLIENT_ID / SECRET / CALLBACK env vars."""


class LinkedInNotConnected(LinkedInError):
    """No LinkedIn account is connected yet — the user must run the OAuth connect."""


def _safe_cid(cid: str | None) -> str:
    """Validate the client id before it touches a storage path (it's user-supplied)."""
    cid = (cid or "").strip()
    if not _CID_RE.match(cid):
        raise LinkedInError("Missing or invalid client id — please reconnect.")
    return cid


def _account_key(cid: str) -> str:
    return f"{ACCOUNT_PREFIX}{_safe_cid(cid)}.json"


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
def _env(name: str) -> str:
    return (os.getenv(name) or "").strip().strip('"').strip("'")


def _client_id() -> str:
    return _env("LINKEDIN_CLIENT_ID")


def _client_secret() -> str:
    return _env("LINKEDIN_CLIENT_SECRET")


def _callback_url() -> str:
    # Must match the redirect URL registered in the LinkedIn app byte-for-byte. It
    # points at the frontend passthrough route, which forwards here.
    return _env("LINKEDIN_CALLBACK_URL")


def _post_connect_url() -> str:
    explicit = _env("LINKEDIN_POST_CONNECT_URL")
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


def is_configured() -> bool:
    return bool(_client_id() and _client_secret() and _callback_url())


def _require_configured() -> None:
    if not is_configured():
        raise LinkedInNotConfigured(
            "LinkedIn is not configured on the server. Set LINKEDIN_CLIENT_ID, "
            "LINKEDIN_CLIENT_SECRET and LINKEDIN_CALLBACK_URL."
        )


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
# OAuth: connect
# ---------------------------------------------------------------------------
async def build_authorize_url(cid: str) -> str:
    """Start an OAuth connect: mint a CSRF state, persist it with the cid, return URL."""
    _require_configured()
    cid = _safe_cid(cid)
    state = secrets.token_urlsafe(24)
    await _write_json(
        f"{STATE_PREFIX}{state}.json",
        {"created": time.time(), "cid": cid},
    )
    params = {
        "response_type": "code",
        "client_id": _client_id(),
        "redirect_uri": _callback_url(),
        "scope": SCOPES,
        "state": state,
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(code: str, state: str) -> dict:
    """Finish the connect: validate state, swap code for a token, store the account."""
    _require_configured()
    state_key = f"{STATE_PREFIX}{state}.json"
    saved = await _read_json(state_key)
    if not saved or not saved.get("cid"):
        raise LinkedInError("Invalid or expired OAuth state — please connect again.")
    # Single-use: consume the state NOW, before the token exchange, so a failed
    # exchange can't leave a replayable state file in storage for the rest of its TTL.
    await _delete(state_key)
    if time.time() - float(saved.get("created") or 0) > STATE_TTL_SECS:
        raise LinkedInError("This connect link expired — please connect again.")
    cid = _safe_cid(saved["cid"])

    body = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": _callback_url(),
        "client_id": _client_id(),
        "client_secret": _client_secret(),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TOKEN_URL,
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        logger.warning("LinkedIn token exchange failed (%s): %s", resp.status_code, resp.text[:500])
        code_hint = ""
        try:
            code_hint = (resp.json() or {}).get("error") or ""
        except Exception:
            code_hint = ""
        raise LinkedInError(
            "Couldn't connect your LinkedIn account"
            + (f" [{code_hint}]" if code_hint else "")
            + " — please try again."
        )
    tok = resp.json()

    account = {
        "access_token": tok["access_token"],
        # Refresh tokens are only issued to approved partner apps; store if present.
        "refresh_token": tok.get("refresh_token", ""),
        "scope": tok.get("scope", SCOPES),
        "expires_at": time.time() + float(tok.get("expires_in", 5184000)),  # ~60 days
        "connected_at": time.time(),
    }
    # Resolve the member identity. It's REQUIRED: posting needs the author URN, and a
    # connection with no identity would otherwise report "connected" yet fail at post
    # time. A failure here almost always means the app lacks openid/profile access —
    # surface it now so the user reconnects with the right scopes instead of later.
    member: dict = {}
    try:
        member = await _fetch_member(account["access_token"])
    except Exception:
        logger.info("LinkedIn member lookup errored", exc_info=True)
    if not member.get("author_urn"):
        raise LinkedInError(
            "Connected to LinkedIn, but couldn't read your profile. Make sure the app has "
            "'Sign In with LinkedIn using OpenID Connect' (openid, profile) approved, then "
            "reconnect."
        )
    account.update(member)

    await _write_json(_account_key(cid), account)
    return _public_account(account)


async def _fetch_member(access_token: str) -> dict:
    """Resolve the member's id + name. Prefer OIDC userinfo; fall back to /v2/me."""
    auth = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(USERINFO_URL, headers=auth)
        if resp.status_code == 200:
            data = resp.json() or {}
            sub = str(data.get("sub") or "")
            name = str(data.get("name") or "").strip()
            if sub:
                return {
                    "member_id": sub,
                    "author_urn": f"urn:li:person:{sub}",
                    "name": name,
                }
        # Fallback for apps without OIDC: the legacy profile endpoint.
        resp = await client.get(ME_URL, headers=auth)
        if resp.status_code == 200:
            data = resp.json() or {}
            mid = str(data.get("id") or "")
            if mid:
                first = (data.get("localizedFirstName") or "").strip()
                last = (data.get("localizedLastName") or "").strip()
                return {
                    "member_id": mid,
                    "author_urn": f"urn:li:person:{mid}",
                    "name": (f"{first} {last}").strip(),
                }
    return {}


# ---------------------------------------------------------------------------
# Status / disconnect
# ---------------------------------------------------------------------------
def _public_account(account: dict) -> dict:
    return {
        "connected": True,
        "name": account.get("name", ""),
        # LinkedIn has no public @handle; expose the member id only as an opaque key.
        "member_id": account.get("member_id", ""),
    }


async def get_status(cid: str | None) -> dict:
    try:
        key = _account_key(cid)
    except LinkedInError:
        return {"connected": False, "configured": is_configured()}
    account = await _read_json(key)
    if not account or not account.get("access_token"):
        return {"connected": False, "configured": is_configured()}
    # A LinkedIn access token can't be silently refreshed for most apps; treat an
    # expired token as disconnected so the UI prompts a reconnect.
    if time.time() >= float(account.get("expires_at") or 0):
        return {"connected": False, "configured": is_configured(), "expired": True}
    return {**_public_account(account), "configured": is_configured()}


async def disconnect(cid: str | None) -> None:
    try:
        key = _account_key(cid)
    except LinkedInError:
        return
    await _delete(key)


async def _refresh(account: dict, cid: str) -> dict:
    """Exchange a stored refresh token for a fresh access token. Only approved apps get
    a refresh token; for everyone else refresh_token is empty and this is a no-op."""
    refresh_token = account.get("refresh_token")
    if not refresh_token:
        return account
    body = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
    if resp.status_code != 200:
        raise LinkedInNotConnected("Couldn't refresh your LinkedIn session — please reconnect.")
    tok = resp.json()
    account["access_token"] = tok["access_token"]
    if tok.get("refresh_token"):  # LinkedIn rotates the refresh token on use
        account["refresh_token"] = tok["refresh_token"]
    account["expires_at"] = time.time() + float(tok.get("expires_in", 5184000))
    await _write_json(_account_key(cid), account)
    return account


async def _get_valid_account(cid: str) -> dict:
    account = await _read_json(_account_key(cid))
    if not account or not account.get("access_token"):
        raise LinkedInNotConnected("No LinkedIn account connected. Connect one in Settings first.")
    # Refresh shortly before expiry when a refresh token is available (approved apps);
    # otherwise the expiry check below sends the user to reconnect.
    if account.get("refresh_token") and time.time() >= float(account.get("expires_at") or 0) - 86400:
        try:
            account = await _refresh(account, cid)
        except LinkedInError:
            pass  # fall through to the hard expiry check
    if time.time() >= float(account.get("expires_at") or 0):
        raise LinkedInNotConnected(
            "Your LinkedIn session expired — please reconnect your account."
        )
    if not account.get("author_urn"):
        raise LinkedInError(
            "Couldn't determine your LinkedIn member id — reconnect with profile access."
        )
    return account


# ---------------------------------------------------------------------------
# Posting: versioned video upload + create post
# ---------------------------------------------------------------------------
def _rest_headers(access_token: str, json_body: bool = True) -> dict:
    h = {
        "Authorization": f"Bearer {access_token}",
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
    }
    if json_body:
        h["Content-Type"] = "application/json"
    return h


async def _upload_video(access_token: str, author_urn: str, file_path: str) -> str:
    """initializeUpload -> PUT each byte range -> finalizeUpload. Returns the video URN."""
    total_bytes = os.path.getsize(file_path)
    if total_bytes <= 0:
        raise LinkedInError("The rendered video file is empty.")

    async with httpx.AsyncClient(timeout=UPLOAD_TIMEOUT) as client:
        # 1. INITIALIZE
        init = await client.post(
            f"{VIDEOS_URL}?action=initializeUpload",
            headers=_rest_headers(access_token),
            json={
                "initializeUploadRequest": {
                    "owner": author_urn,
                    "fileSizeBytes": total_bytes,
                    "uploadCaptions": False,
                    "uploadThumbnail": False,
                }
            },
        )
        if init.status_code not in (200, 201):
            raise LinkedInError(f"Video initialize failed ({init.status_code}): {init.text[:300]}")
        value = (init.json() or {}).get("value") or {}
        video_urn = value.get("video") or ""
        instructions = value.get("uploadInstructions") or []
        upload_token = value.get("uploadToken", "")
        if not video_urn or not instructions:
            raise LinkedInError("LinkedIn did not return upload instructions.")

        # 2. UPLOAD each part (PUT the byte range); collect ETags as part ids.
        part_ids: list[str] = []
        with open(file_path, "rb") as f:
            for inst in instructions:
                url = inst.get("uploadUrl")
                first = int(inst.get("firstByte", 0))
                last = int(inst.get("lastByte", total_bytes - 1))
                if not url:
                    raise LinkedInError("Malformed upload instruction from LinkedIn.")
                f.seek(first)
                chunk = f.read(last - first + 1)
                put = await client.put(
                    url,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/octet-stream",
                    },
                    content=chunk,
                )
                if put.status_code not in (200, 201):
                    raise LinkedInError(
                        f"Video upload chunk failed ({put.status_code}): {put.text[:200]}"
                    )
                etag = put.headers.get("etag") or put.headers.get("ETag") or ""
                part_ids.append(etag.strip('"'))

        # 3. FINALIZE
        fin = await client.post(
            f"{VIDEOS_URL}?action=finalizeUpload",
            headers=_rest_headers(access_token),
            json={
                "finalizeUploadRequest": {
                    "video": video_urn,
                    "uploadToken": upload_token or "",
                    "uploadedPartIds": part_ids,
                }
            },
        )
        if fin.status_code not in (200, 201):
            raise LinkedInError(f"Video finalize failed ({fin.status_code}): {fin.text[:300]}")

    return video_urn


async def _await_processing(access_token: str, video_urn: str) -> None:
    """Best-effort wait for the video to leave PROCESSING before referencing it in a
    post. LinkedIn often accepts the post while still processing, so a timeout here is
    non-fatal — we proceed and let LinkedIn publish when the asset is ready."""
    from urllib.parse import quote

    deadline = time.time() + PROCESS_POLL_TIMEOUT
    url = f"{VIDEOS_URL}/{quote(video_urn, safe='')}"
    async with httpx.AsyncClient(timeout=30) as client:
        while time.time() < deadline:
            resp = await client.get(url, headers=_rest_headers(access_token, json_body=False))
            if resp.status_code != 200:
                return  # can't read status (perms/version) — don't block the post
            status = str((resp.json() or {}).get("status") or "").upper()
            if status in ("AVAILABLE", "PROCESSING_FAILED", ""):
                return
            await asyncio.sleep(3.0)


async def _create_post(access_token: str, author_urn: str, text: str, video_urn: str) -> str:
    """Create a member video post. Returns the post URN (from the x-restli-id header)."""
    body = {
        "author": author_urn,
        "commentary": text,
        "visibility": "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "content": {"media": {"id": video_urn, "title": (text[:60] or "Video")}},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(POSTS_URL, headers=_rest_headers(access_token), json=body)
    if resp.status_code not in (200, 201):
        raise LinkedInError(f"Posting to LinkedIn failed ({resp.status_code}): {resp.text[:300]}")
    return resp.headers.get("x-restli-id") or resp.headers.get("x-linkedin-id") or ""


async def post_video(file_path: str, caption: str, cid: str) -> dict:
    """Upload a rendered video and publish it as a LinkedIn member post.

    Returns {id, url}. Scoped to the browser's cid.
    """
    _require_configured()
    cid = _safe_cid(cid)
    account = await _get_valid_account(cid)
    access_token = account["access_token"]
    author_urn = account["author_urn"]
    text = (caption or "").strip()[:COMMENTARY_MAX_CHARS]

    video_urn = await _upload_video(access_token, author_urn, file_path)
    await _await_processing(access_token, video_urn)
    post_urn = await _create_post(access_token, author_urn, text, video_urn)

    url = f"https://www.linkedin.com/feed/update/{post_urn}/" if post_urn else ""
    return {"id": post_urn, "url": url}
