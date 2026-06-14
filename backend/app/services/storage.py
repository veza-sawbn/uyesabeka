"""Supabase Storage access via direct REST calls (httpx). No AWS, no boto3.

The bucket is private (POPIA), so uploads return a *bucket-relative object
path* — the stable reference we persist — and signature images are served only
through short-lived signed URLs.

When Supabase env vars are absent (local/demo/CI) the service degrades to a
no-network "demo mode": it skips the upload and returns a deterministic path so
the rest of the app still functions end-to-end.
"""

from __future__ import annotations

import base64
import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger("tasap.storage")

_DATA_URI_RE = re.compile(r"^data:(?P<mime>[\w/\-.+]+);base64,(?P<data>.*)$", re.DOTALL)
_MIME_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
MAX_BYTES = 5 * 1024 * 1024  # 5MB per spec


def storage_enabled() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_key)


def _headers(content_type: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "apikey": settings.supabase_service_key,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _decode(data_uri: str) -> tuple[bytes, str]:
    """Return (raw_bytes, mime). Accepts a data-URI or bare base64 (assumed png)."""
    match = _DATA_URI_RE.match(data_uri.strip())
    if match:
        mime = match.group("mime")
        raw = base64.b64decode(match.group("data"))
    else:
        mime = "image/png"
        raw = base64.b64decode(data_uri)
    if mime not in _MIME_EXT:
        raise ValueError(f"Unsupported image type: {mime}")
    if len(raw) > MAX_BYTES:
        raise ValueError("Image exceeds 5MB limit")
    return raw, mime


def upload_base64_image(data_uri: str, folder: str, filename: str) -> str:
    """Upload a base64 data-URI / raw base64 string to the uploads bucket.

    Returns the bucket-relative object path (e.g. ``signatures/12/2026-06-14.png``).
    """
    raw, mime = _decode(data_uri)
    ext = _MIME_EXT[mime]
    name = filename if filename.lower().endswith(f".{ext}") else f"{filename}.{ext}"
    object_path = f"{folder.strip('/')}/{name}"

    if not storage_enabled():
        logger.warning("Supabase not configured; skipping upload of %s (demo mode)", object_path)
        return object_path

    url = f"{settings.supabase_url}/storage/v1/object/{settings.supabase_bucket}/{object_path}"
    resp = httpx.post(
        url,
        content=raw,
        headers={**_headers(mime), "x-upsert": "true"},
        timeout=30.0,
    )
    resp.raise_for_status()
    return object_path


def generate_signed_url(object_path: str, expires_in: int = 3600) -> str:
    """Return a short-lived signed URL for a private-bucket object.

    POPIA: signature images must never be served from a public bucket. Cap
    expiry at one hour.
    """
    expires_in = min(expires_in, 3600)
    if not storage_enabled():
        return f"/_demo-storage/{object_path}"

    url = f"{settings.supabase_url}/storage/v1/object/sign/{settings.supabase_bucket}/{object_path}"
    resp = httpx.post(url, json={"expiresIn": expires_in}, headers=_headers("application/json"), timeout=15.0)
    resp.raise_for_status()
    signed_path = resp.json().get("signedURL") or resp.json().get("signedUrl", "")
    return f"{settings.supabase_url}/storage/v1{signed_path}"


def delete_file(object_path: str) -> None:
    """Delete a file by its bucket-relative path."""
    if not storage_enabled():
        logger.warning("Supabase not configured; skipping delete of %s (demo mode)", object_path)
        return
    url = f"{settings.supabase_url}/storage/v1/object/{settings.supabase_bucket}/{object_path}"
    resp = httpx.delete(url, headers=_headers(), timeout=15.0)
    resp.raise_for_status()
