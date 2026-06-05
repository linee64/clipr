import asyncio
import os
import shutil
from pathlib import Path

import aiofiles
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BACKEND_DIR = Path(__file__).resolve().parent.parent
LOCAL_STORAGE_ROOT = BACKEND_DIR / "temp" / "storage"
BUCKET = os.getenv("SUPABASE_BUCKET", "clipr-videos")
_bucket_checked = False


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip().strip('"').strip("'")


def use_local_storage() -> bool:
    url = _env("SUPABASE_URL")
    key = _env("SUPABASE_KEY")
    return (
        not url
        or url == "your_supabase_url"
        or not key
        or key == "your_supabase_key"
    )


def _get_supabase() -> Client:
    url = _env("SUPABASE_URL")
    key = _env("SUPABASE_KEY")
    if use_local_storage():
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in backend/.env."
        )
    return create_client(url, key)


def _storage_error_hint(exc: Exception) -> str:
    msg = str(exc)
    if "row-level security" in msg.lower() or "violates row-level security" in msg.lower():
        return (
            f"{msg}. Fix: use SUPABASE_KEY = service_role (Settings > API), restart server, "
            f"or add Storage policies for bucket '{BUCKET}' in Supabase SQL Editor."
        )
    if "bucket not found" in msg.lower():
        return (
            f"{msg}. Create bucket '{BUCKET}' in Supabase: Storage > New bucket > Public."
        )
    return msg


def _bucket_names(supabase: Client) -> list[str]:
    buckets = supabase.storage.list_buckets()
    names: list[str] = []
    for bucket in buckets:
        if isinstance(bucket, dict):
            names.append(bucket.get("name") or bucket.get("id", ""))
        else:
            names.append(getattr(bucket, "name", None) or getattr(bucket, "id", ""))
    return [n for n in names if n]


def _ensure_bucket(supabase: Client):
    global _bucket_checked
    if _bucket_checked:
        return

    names = _bucket_names(supabase)
    if BUCKET in names:
        _bucket_checked = True
        return

    try:
        supabase.storage.create_bucket(BUCKET, options={"public": True})
        _bucket_checked = True
        return
    except Exception:
        pass

    raise RuntimeError(
        f"Bucket '{BUCKET}' not found in Supabase. "
        f"Create it: Dashboard > Storage > New bucket > name '{BUCKET}' > Public. "
        f"Use SUPABASE_KEY = service_role key (Settings > API), not anon."
    )


def local_file_path(remote_path: str) -> Path:
    return LOCAL_STORAGE_ROOT / remote_path


async def upload_file(local_path: str, remote_path: str) -> str:
    """Upload file to Supabase Storage or local temp (dev mode)."""
    if use_local_storage():
        dest = local_file_path(remote_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(local_path, dest)
        return f"/api/video/files/{remote_path}"

    supabase = _get_supabase()
    _ensure_bucket(supabase)

    with open(local_path, "rb") as f:
        data = f.read()

    last_err: Exception | None = None
    for attempt in range(3):
        try:
            supabase.storage.from_(BUCKET).upload(
                remote_path,
                data,
                file_options={"upsert": "true"},
            )
            last_err = None
            break
        except Exception as e:
            last_err = e
            if attempt < 2:
                await asyncio.sleep(2**attempt)

    if last_err is not None:
        raise RuntimeError(_storage_error_hint(last_err)) from last_err
    return supabase.storage.from_(BUCKET).get_public_url(remote_path)


async def download_file(remote_path: str, local_path: str):
    """Download file from Supabase Storage or local temp (dev mode)."""
    if use_local_storage():
        src = local_file_path(remote_path)
        if not src.is_file():
            raise FileNotFoundError(f"Local file not found: {remote_path}")
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, local_path)
        return

    supabase = _get_supabase()
    _ensure_bucket(supabase)
    data = supabase.storage.from_(BUCKET).download(remote_path)
    async with aiofiles.open(local_path, "wb") as f:
        await f.write(data)
