"""XSS-safe original filename sanitization for evidence metadata and headers."""

from __future__ import annotations

import re
from pathlib import PurePosixPath, PureWindowsPath

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_UNSAFE_HEADER = re.compile(r'[<>:"\\|?*\x00-\x1f\x7f]')
_WHITESPACE = re.compile(r"\s+")

MAX_ORIGINAL_FILENAME_LENGTH = 180


def extract_basename(raw: str) -> str:
    """Drop path components from client-supplied names (Unix or Windows)."""
    name = (raw or "").strip()
    if not name:
        return ""
    # Prefer the last path segment from either separator style.
    posix = PurePosixPath(name.replace("\\", "/")).name
    windows = PureWindowsPath(name).name
    basename = windows if ("\\" in name or ":" in name) else posix
    return basename or posix or windows


def sanitize_original_filename(raw: str) -> str:
    """
    Produce a display/storage-safe original filename.

    Does not invent business captions. Rejects empty results after sanitization
    at the validation layer (caller raises ValidationError).
    """
    basename = extract_basename(raw)
    basename = _CONTROL_CHARS.sub("", basename)
    basename = basename.replace("\u202e", "").replace("\u200b", "")
    basename = _UNSAFE_HEADER.sub("_", basename)
    basename = _WHITESPACE.sub(" ", basename).strip(" .")
    if len(basename) > MAX_ORIGINAL_FILENAME_LENGTH:
        stem_ext = basename.rsplit(".", 1)
        if len(stem_ext) == 2 and len(stem_ext[1]) <= 12:
            stem, ext = stem_ext
            keep = MAX_ORIGINAL_FILENAME_LENGTH - len(ext) - 1
            basename = f"{stem[:keep]}.{ext}"
        else:
            basename = basename[:MAX_ORIGINAL_FILENAME_LENGTH]
    return basename


def content_disposition_attachment(filename: str) -> str:
    """RFC 5987 Content-Disposition for download — always attachment, never inline."""
    safe = sanitize_original_filename(filename) or "evidence.bin"
    # ASCII fallback for legacy agents
    ascii_name = re.sub(r"[^\x20-\x7e]", "_", safe).replace('"', "")
    if not ascii_name:
        ascii_name = "evidence.bin"
    from urllib.parse import quote

    encoded = quote(safe, safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"
