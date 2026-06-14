"""Durable, restart-safe render-job store.

Render jobs run as in-process background tasks and their status used to live only
in a module-level dict. On a deploy that's fatal: if the render process restarts
mid-render (most often the container is OOM-killed during the heavy ffmpeg /
librosa work), the dict is wiped and every status poll 404s as "Job not found" —
the user just sees "Rendering failed" with no clue why.

This store keeps the fast in-memory dict for live updates AND mirrors each job's
state into the same storage bucket the renderer already uses (`jobs/<id>.json`),
refreshed by a heartbeat every few seconds. So a status poll survives a restart
(it reads the last persisted state) and a render that was hard-killed surfaces as
a clear, stale-heartbeat error instead of a job that simply vanished.
"""

import asyncio
import json
import time

from services.storage import BUCKET, local_file_path, use_local_storage

# job_id -> {status, progress, output_url, description, error, updated_ts}
jobs: dict = {}

HEARTBEAT_SECS = 5.0
# A live render refreshes updated_ts every HEARTBEAT_SECS regardless of progress,
# so a gap larger than this means the worker process died (it can't just be slow).
STALE_SECS = 40.0

INTERRUPTED_MSG = (
    "Render was interrupted — the server restarted mid-render. This is almost "
    "always the instance running out of memory on a heavy render. Try again; if "
    "it keeps happening, give the backend more memory."
)


def _remote_path(job_id: str) -> str:
    return f"jobs/{job_id}.json"


def _persist_sync(job_id: str) -> None:
    record = jobs.get(job_id)
    if record is None:
        return
    data = json.dumps(record).encode("utf-8")
    remote = _remote_path(job_id)
    try:
        if use_local_storage():
            dest = local_file_path(remote)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        else:
            from services.storage import _get_supabase

            _get_supabase().storage.from_(BUCKET).upload(
                remote,
                data,
                file_options={"upsert": "true", "content-type": "application/json"},
            )
    except Exception:
        # Best-effort: a failed persist must never break the render itself.
        pass


def _read_remote_sync(job_id: str) -> dict | None:
    remote = _remote_path(job_id)
    try:
        if use_local_storage():
            src = local_file_path(remote)
            return json.loads(src.read_bytes()) if src.is_file() else None
        from services.storage import _get_supabase

        data = _get_supabase().storage.from_(BUCKET).download(remote)
        return json.loads(data)
    except Exception:
        return None


async def read_remote(job_id: str) -> dict | None:
    """Last persisted state for a job whose in-memory copy is gone (after a restart)."""
    return await asyncio.to_thread(_read_remote_sync, job_id)


def is_stale(record: dict | None) -> bool:
    """True if a still-"processing" job stopped heart-beating (its worker died)."""
    if not record or record.get("status") not in ("pending", "processing"):
        return False
    ts = float(record.get("updated_ts") or 0.0)
    return ts > 0 and (time.time() - ts) > STALE_SECS


def start_heartbeat(job_id: str) -> None:
    """Mirror this job's state to storage every few seconds until it finishes.

    Stamps `updated_ts` as a liveness signal: if the process is killed the stamp
    stops advancing, so a later poll can tell the render died (see is_stale).
    """

    async def _beat():
        try:
            for _ in range(720):  # ~1h safety cap so a stuck job can't beat forever
                record = jobs.get(job_id)
                if record is None:
                    return
                record["updated_ts"] = time.time()
                await asyncio.to_thread(_persist_sync, job_id)
                if record.get("status") in ("done", "error"):
                    return
                await asyncio.sleep(HEARTBEAT_SECS)
        except asyncio.CancelledError:
            pass

    try:
        asyncio.get_running_loop().create_task(_beat())
    except RuntimeError:
        # No running loop (shouldn't happen from an async route) — skip the heartbeat.
        pass
