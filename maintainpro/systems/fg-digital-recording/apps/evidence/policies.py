"""Allowlists, size limits, and immutability rules for evidence attachments."""

from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ValidationError

from apps.evidence.filenames import sanitize_original_filename
from apps.evidence.models import EvidenceLinkedKind

# Technical defaults — production limits remain EVIDENCE REQUIRED (ASM-017 / IT security).
DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# No executables, HTML, SVG, or scriptable types — XSS / malware surface reduction.
ALLOWED_EVIDENCE_TYPES: dict[str, frozenset[str]] = {
    "image/jpeg": frozenset({".jpg", ".jpeg"}),
    "image/png": frozenset({".png"}),
    "image/webp": frozenset({".webp"}),
    "application/pdf": frozenset({".pdf"}),
}

FORBIDDEN_EXTENSIONS = frozenset(
    {
        ".exe",
        ".dll",
        ".bat",
        ".cmd",
        ".com",
        ".msi",
        ".scr",
        ".ps1",
        ".vbs",
        ".js",
        ".jse",
        ".wsf",
        ".hta",
        ".html",
        ".htm",
        ".svg",
        ".shtml",
        ".php",
        ".jar",
        ".sh",
        ".apk",
        ".dmg",
    }
)


@dataclass(frozen=True, slots=True)
class ValidatedUpload:
    original_filename: str
    content_type: str
    extension: str
    size_bytes: int


def max_upload_bytes() -> int:
    return int(getattr(settings, "EVIDENCE_MAX_UPLOAD_BYTES", DEFAULT_MAX_UPLOAD_BYTES))


def allowed_content_types() -> frozenset[str]:
    configured = getattr(settings, "EVIDENCE_ALLOWED_CONTENT_TYPES", None)
    if configured:
        return frozenset(configured)
    return frozenset(ALLOWED_EVIDENCE_TYPES.keys())


def validate_upload_candidate(
    *,
    original_filename: str,
    content_type: str,
    size_bytes: int,
) -> ValidatedUpload:
    if size_bytes <= 0:
        raise ValidationError({"file": "Empty files are not accepted as evidence."})
    limit = max_upload_bytes()
    if size_bytes > limit:
        raise ValidationError({"file": f"File exceeds the maximum allowed size of {limit} bytes."})

    safe_name = sanitize_original_filename(original_filename)
    if not safe_name:
        raise ValidationError({"file": "Filename is missing or unsafe after sanitization."})

    lower = safe_name.lower()
    # Reject multi-suffix tricks like invoice.pdf.exe
    parts = lower.split(".")
    if len(parts) >= 2:
        for part in parts[1:]:
            if f".{part}" in FORBIDDEN_EXTENSIONS:
                raise ValidationError({"file": "Executable or script file types are not allowed."})

    ext = ""
    if "." in lower:
        ext = "." + lower.rsplit(".", 1)[-1]

    declared = (content_type or "").split(";")[0].strip().lower()
    if declared not in allowed_content_types():
        raise ValidationError({"file": f"Content type '{declared}' is not allowlisted."})

    expected_exts = ALLOWED_EVIDENCE_TYPES.get(declared)
    if expected_exts is not None and ext not in expected_exts:
        raise ValidationError(
            {
                "file": (
                    f"Filename extension '{ext or '(none)'}' does not match "
                    f"allowlisted type {declared}."
                )
            }
        )

    return ValidatedUpload(
        original_filename=safe_name,
        content_type=declared,
        extension=ext.lstrip("."),
        size_bytes=size_bytes,
    )


def is_architecture_allowed_kind(kind: str) -> bool:
    return kind in EvidenceLinkedKind.values
