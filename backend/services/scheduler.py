"""Scheduled auto-posting: store a rendered video + caption + target social network and
a time, then publish it when that time arrives.

A small durable store (mirrors services.twitter's token store) keeps each schedule at
`schedules/<id>.json` in the storage bucket (or local temp in dev), so a restart doesn't
lose pending posts. A background loop (started from main.py on app startup) polls every
few seconds for due, still-pending schedules and posts each to its platform via the
existing twitter/linkedin post_video flow — so the same per-browser cid connection used
for manual posting drives the scheduled one.

Scope: scoped per browser by cid, like the connect integrations (no per-user auth yet).
The loop runs in-process; the deploy uses a single uvicorn worker, so one loop owns the
queue. A `processing` claim guards against re-posting within an overlapping tick.
"""

import asyncio
import json
import logging
import math
import os
import re
import time
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

from services import linkedin, twitter
from services.storage import BUCKET, local_file_path, use_local_storage

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger("clipr.scheduler")

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = str(BACKEND_DIR / "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

SCHEDULE_PREFIX = "schedules/"
PLATFORMS = ("twitter", "linkedin")

# A schedule claimed as "processing" for longer than this lost its worker (the single
# uvicorn process OOM'd / restarted mid-publish). The next tick reaps it back to
# "pending" so the post still goes out. Comfortably above the 180s download timeout plus
# the chunked social upload, so a healthy in-flight post is never reaped early.
SCHEDULE_STALE_SECS = 600

_CID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def _poll_interval() -> int:
    try:
        return max(10, int(os.getenv("SCHEDULE_POLL_SECONDS", "30") or "30"))
    except ValueError:
        return 30


class ScheduleError(RuntimeError):
    """Bad schedule input — message is safe to surface to the user."""


def _safe_cid(cid: str | None) -> str:
    cid = (cid or "").strip()
    if not _CID_RE.match(cid):
        raise ScheduleError("Missing or invalid client id — please reconnect.")
    return cid


def _key(schedule_id: str) -> str:
    # schedule_id is server-generated (uuid hex) — keep it strictly hex so it can never
    # escape the schedules/ prefix.
    if not re.fullmatch(r"[a-f0-9]{8,64}", schedule_id or ""):
        raise ScheduleError("Invalid schedule id.")
    return f"{SCHEDULE_PREFIX}{schedule_id}.json"


# ---------------------------------------------------------------------------
# Tiny JSON store on top of the existing storage backend (bucket or local temp)
# ---------------------------------------------------------------------------
def _read_sync(key: str) -> dict | None:
    try:
        if use_local_storage():
            src = local_file_path(key)
            return json.loads(src.read_bytes()) if src.is_file() else None
        from services.storage import _get_supabase

        data = _get_supabase().storage.from_(BUCKET).download(key)
        return json.loads(data)
    except Exception:
        return None


def _write_sync(key: str, value: dict) -> None:
    data = json.dumps(value).encode("utf-8")
    if use_local_storage():
        dest = local_file_path(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return
    from services.storage import _get_supabase

    _get_supabase().storage.from_(BUCKET).upload(
        key, data, file_options={"upsert": "true", "content-type": "application/json"}
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


def _list_ids_sync() -> list[str]:
    """All schedule ids currently stored (across cids), for the due-scan."""
    try:
        if use_local_storage():
            d = local_file_path(SCHEDULE_PREFIX)
            if not d.is_dir():
                return []
            return [p.stem for p in d.glob("*.json")]
        from services.storage import _get_supabase

        sb = _get_supabase()
        ids: list[str] = []
        # Page through the bucket: storage list() defaults to only 100 objects, which
        # would silently drop due posts once more than 100 schedule files exist.
        page_size = 1000
        offset = 0
        while True:
            batch = sb.storage.from_(BUCKET).list(
                SCHEDULE_PREFIX.rstrip("/"),
                {"limit": page_size, "offset": offset,
                 "sortBy": {"column": "name", "order": "asc"}},
            ) or []
            for it in batch:
                name = it.get("name") if isinstance(it, dict) else getattr(it, "name", "")
                if name and name.endswith(".json"):
                    ids.append(name[:-5])
            if len(batch) < page_size:
                break
            offset += page_size
        return ids
    except Exception:
        logger.info("Scheduler list failed", exc_info=True)
        return []


async def _read(key: str) -> dict | None:
    return await asyncio.to_thread(_read_sync, key)


async def _write(key: str, value: dict) -> None:
    await asyncio.to_thread(_write_sync, key, value)


async def _delete(key: str) -> None:
    await asyncio.to_thread(_delete_sync, key)


# ---------------------------------------------------------------------------
# Public API (used by routers/schedule.py)
# ---------------------------------------------------------------------------
def _public(sch: dict) -> dict:
    return {
        "id": sch.get("id", ""),
        "platform": sch.get("platform", ""),
        "output_url": sch.get("output_url", ""),
        "caption": sch.get("caption", ""),
        "title": sch.get("title", ""),
        "scheduled_at": float(sch.get("scheduled_at", 0)),
        "status": sch.get("status", "pending"),
        "result_url": sch.get("result_url", ""),
        "error": sch.get("error", ""),
        "created_at": float(sch.get("created_at", 0)),
        "posted_at": float(sch.get("posted_at", 0)) if sch.get("posted_at") else 0,
    }


async def create_schedule(
    cid: str,
    platform: str,
    output_url: str,
    caption: str,
    title: str,
    scheduled_at: float,
) -> dict:
    cid = _safe_cid(cid)
    platform = (platform or "").strip().lower()
    if platform not in PLATFORMS:
        raise ScheduleError("Pick a supported platform (X or LinkedIn).")
    if not (output_url or "").strip():
        raise ScheduleError("No video to schedule.")
    try:
        when = float(scheduled_at)
    except (TypeError, ValueError):
        raise ScheduleError("Invalid schedule time.")
    # Reject NaN/Infinity too (a float field accepts them by default): NaN would post
    # immediately and Infinity would stick pending forever.
    if not math.isfinite(when) or when <= 0:
        raise ScheduleError("Invalid schedule time.")

    schedule_id = uuid.uuid4().hex
    sch = {
        "id": schedule_id,
        "cid": cid,
        "platform": platform,
        "output_url": output_url.strip(),
        "caption": caption or "",
        "title": title or "",
        "scheduled_at": when,
        "status": "pending",
        "result_url": "",
        "error": "",
        "created_at": time.time(),
        "posted_at": 0,
    }
    await _write(_key(schedule_id), sch)
    return _public(sch)


async def list_schedules(cid: str | None) -> list[dict]:
    try:
        cid = _safe_cid(cid)
    except ScheduleError:
        return []
    ids = await asyncio.to_thread(_list_ids_sync)
    out: list[dict] = []
    for sid in ids:
        try:
            sch = await _read(_key(sid))
        except ScheduleError:
            continue
        if sch and sch.get("cid") == cid:
            out.append(_public(sch))
    out.sort(key=lambda s: s["scheduled_at"])
    return out


async def cancel_schedule(cid: str | None, schedule_id: str) -> None:
    try:
        cid = _safe_cid(cid)
        key = _key(schedule_id)
    except ScheduleError:
        return
    sch = await _read(key)
    # Only the owning browser can cancel, and an already-posted one can't be unsent.
    # "processing" is cancelable too: it's either genuinely in-flight or a stale claim
    # left by a crashed worker, and the user needs a way to clear the latter.
    if sch and sch.get("cid") == cid and sch.get("status") in ("pending", "error", "processing"):
        await _delete(key)


# ---------------------------------------------------------------------------
# Posting: download the rendered video (SSRF-safe) then publish to the platform
# ---------------------------------------------------------------------------
def _supabase_public_prefix() -> str:
    base = (os.getenv("SUPABASE_URL") or "").strip().strip('"').strip("'").rstrip("/")
    return f"{base}/storage/v1/object/public/{BUCKET}/" if base else ""


async def _download_video(output_url: str, dest: str) -> None:
    """Pull the rendered video to a local temp file. Mirrors the post routers' guard:
    only our own bucket's public objects (prod) or a local /api/video/files path (dev)
    are fetched, so the scheduler can't be steered into an SSRF fetch."""
    if output_url.startswith("http://") or output_url.startswith("https://"):
        prefix = _supabase_public_prefix()
        if not prefix or not output_url.startswith(prefix):
            raise ScheduleError("Refusing to fetch the video from an unrecognized location.")
        async with httpx.AsyncClient(timeout=180, follow_redirects=False) as client:
            resp = await client.get(output_url)
            if resp.status_code != 200:
                raise ScheduleError(f"Couldn't fetch the video ({resp.status_code}).")
            with open(dest, "wb") as f:
                f.write(resp.content)
        return
    from services.storage import download_file

    remote = output_url.split("/api/video/files/", 1)[-1].lstrip("/")
    if not remote:
        raise ScheduleError("Unrecognized video URL.")
    await download_file(remote, dest)


async def _publish(sch: dict) -> dict:
    platform = sch.get("platform")
    tmp = os.path.join(TEMP_DIR, f"sched_{uuid.uuid4().hex}.mp4")
    try:
        await _download_video(sch["output_url"], tmp)
        if platform == "twitter":
            return await twitter.post_video(tmp, sch.get("caption", ""), sch["cid"])
        if platform == "linkedin":
            return await linkedin.post_video(tmp, sch.get("caption", ""), sch["cid"])
        raise ScheduleError(f"Unknown platform: {platform}")
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


# ---------------------------------------------------------------------------
# Background loop
# ---------------------------------------------------------------------------
_run_lock = asyncio.Lock()


async def run_due() -> None:
    """Post every pending schedule whose time has arrived. Serialized by _run_lock so an
    overlapping tick (a long video upload) can't double-process."""
    if _run_lock.locked():
        return
    async with _run_lock:
        now = time.time()
        for sid in await asyncio.to_thread(_list_ids_sync):
            try:
                key = _key(sid)
            except ScheduleError:
                continue
            sch = await _read(key)
            if not sch:
                continue
            status = sch.get("status")
            if status == "processing":
                # A worker that died mid-publish (OOM/restart) leaves the schedule stuck
                # in "processing" forever — run_due never re-picks it and the user can't
                # cancel it, so the post silently never goes out. Reap a stale claim back
                # to "pending" so it gets retried. The generous timeout makes a double
                # post (crash right after the upload completed) very unlikely.
                claimed = float(sch.get("claimed_at") or 0)
                if not claimed or (now - claimed) <= SCHEDULE_STALE_SECS:
                    continue
                logger.warning("Reaping stale scheduled post %s (stuck in processing)", sid)
                status = "pending"
            elif status != "pending":
                continue
            if float(sch.get("scheduled_at", 0)) > now:
                continue
            # Claim it before the slow post so a re-entrant tick won't pick it again, and
            # stamp when so a crash mid-publish can be detected and reaped (above).
            sch["status"] = "processing"
            sch["claimed_at"] = time.time()
            await _write(key, sch)
            # Honor a cancel that landed right after we claimed: re-read and skip the
            # publish if the record was deleted/changed, so a just-cancelled post isn't
            # sent. (A cancel during the publish itself can't be un-posted, but the CAS
            # below still prevents resurrecting the deleted record.)
            claim = await _read(key)
            if not claim or claim.get("cid") != sch.get("cid") or claim.get("status") != "processing":
                logger.info("Scheduled post %s cancelled before publish; skipping", sid)
                continue
            try:
                result = await _publish(sch)
                sch["status"] = "posted"
                sch["posted_at"] = time.time()
                sch["result_url"] = (result or {}).get("url", "")
                sch["error"] = ""
                logger.info("Scheduled post %s published to %s", sid, sch.get("platform"))
            except Exception as e:
                sch["status"] = "error"
                sch["error"] = str(e)
                logger.warning("Scheduled post %s failed: %s", sid, e)
            # Compare-and-set: only persist the outcome if our claim still stands. If the
            # owner cancelled (deleted the record) during _publish, don't recreate it.
            latest = await _read(key)
            if latest and latest.get("cid") == sch.get("cid") and latest.get("status") == "processing":
                await _write(key, sch)
            else:
                logger.info("Scheduled post %s cancelled mid-publish; not resurrecting", sid)


async def run_loop() -> None:
    """Poll forever. Started from main.py's startup hook."""
    interval = _poll_interval()
    logger.info("Scheduler loop started (every %ss)", interval)
    while True:
        try:
            await run_due()
        except Exception:
            logger.exception("Scheduler tick failed")
        await asyncio.sleep(interval)
