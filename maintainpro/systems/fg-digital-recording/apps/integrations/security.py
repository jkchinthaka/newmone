"""Secret redaction for logs and audit metadata."""

from __future__ import annotations

import re
from typing import Any

_SECRET_KEY_RE = re.compile(
    r"(password|passwd|secret|token|api[_-]?key|authorization|bearer|credential|client_secret)",
    re.IGNORECASE,
)
_BEARER_RE = re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE)
_REDACTED = "***REDACTED***"


def redact_string(value: str) -> str:
    if not value:
        return value
    return _BEARER_RE.sub(rf"\1{_REDACTED}", value)


def redact_mapping(data: dict[str, Any] | None) -> dict[str, Any]:
    """Return a shallow-copied dict with secret-like keys/values redacted."""
    if not data:
        return {}
    out: dict[str, Any] = {}
    for key, value in data.items():
        key_str = str(key)
        if _SECRET_KEY_RE.search(key_str):
            out[key_str] = _REDACTED
            continue
        if isinstance(value, dict):
            out[key_str] = redact_mapping(value)
        elif isinstance(value, str):
            out[key_str] = redact_string(value)
        else:
            out[key_str] = value
    return out


def assert_no_secrets_in_text(text: str) -> None:
    """Test helper — fails if obvious credential patterns remain."""
    lowered = text.lower()
    forbidden = ("bearer ey", "client_secret=", "api_key=", "password=")
    for token in forbidden:
        if token in lowered and _REDACTED.lower() not in lowered:
            # Allow if already redacted nearby; otherwise flag raw patterns
            if _REDACTED not in text:
                raise AssertionError(f"Possible secret material in text: {token}")
