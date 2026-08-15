"""Privacy helpers for workflow notifications — refuse sensitive content."""

from __future__ import annotations

import html
import re

from django.core.exceptions import ValidationError

# Keys / substrings that must never appear in notification payloads.
_FORBIDDEN_PAYLOAD_KEYS = frozenset(
    {
        "answer",
        "answers",
        "response_value",
        "review_note",
        "investigation",
        "containment",
        "closure_notes",
        "password",
        "token",
        "secret",
        "checklist_answers",
        "raw_answers",
        "supervisor_note",
        "qa_note",
    }
)

_SENSITIVE_PATTERN = re.compile(
    r"(?i)\b(answer(s)?|password|secret|token|review[_ ]?note|investigation)\b"
)


def escape_template_text(value: str) -> str:
    """HTML-escape notification text for safe rendering / email bodies."""
    return html.escape((value or "").strip(), quote=True)


def validate_safe_notification_text(value: str, *, field: str, max_length: int) -> str:
    """
    Normalize and validate privacy-safe title/message text.

    Rejects oversized or obviously sensitive free text. Does not invent content.
    """
    text = (value or "").strip()
    if not text:
        raise ValidationError({field: f"{field} is required."})
    if len(text) > max_length:
        raise ValidationError({field: f"{field} exceeds {max_length} characters."})
    if _SENSITIVE_PATTERN.search(text):
        raise ValidationError(
            {
                field: (
                    f"{field} must not include checklist answers or sensitive notes (privacy rule)."
                )
            }
        )
    return text


def assert_safe_metadata(metadata: dict[str, object] | None) -> dict[str, object]:
    """Allow only opaque identifiers in metadata — reject sensitive keys."""
    meta = dict(metadata or {})
    for key in meta:
        lowered = str(key).lower()
        if lowered in _FORBIDDEN_PAYLOAD_KEYS or any(
            bad in lowered for bad in ("answer", "password", "secret", "note")
        ):
            raise ValidationError(
                {"metadata": f"Metadata key '{key}' is not allowed in notifications."}
            )
        val = meta[key]
        if isinstance(val, str) and _SENSITIVE_PATTERN.search(val):
            raise ValidationError(
                {"metadata": f"Metadata value for '{key}' looks sensitive and is blocked."}
            )
        if isinstance(val, (dict, list)):
            raise ValidationError({"metadata": "Nested metadata structures are not allowed."})
    return meta
