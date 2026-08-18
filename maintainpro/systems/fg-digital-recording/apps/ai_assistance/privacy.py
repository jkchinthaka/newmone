"""Data minimization and secret redaction for AI context."""

from __future__ import annotations

from typing import Any

from apps.integrations.security import redact_mapping, redact_string

# Re-export for AI module callers; keep one redaction vocabulary.
__all__ = ["minimize_context", "redact_mapping", "redact_string", "MAX_CONTEXT_CHARS"]

MAX_CONTEXT_CHARS = 4000
_ALLOWED_CONTEXT_KEYS = frozenset(
    {
        "organization_id",
        "organization_code",
        "batch_reference",
        "record_ids",
        "source_ids",
        "codes",
        "statuses",
        "counts",
        "metric_labels",
        "titles",
        "opened_at",
        "created_at",
        "notes_summary",
    }
)


def minimize_context(
    raw: dict[str, Any] | None, *, max_chars: int = MAX_CONTEXT_CHARS
) -> dict[str, Any]:
    """Keep only allow-listed keys, redact secrets, and bound payload size."""
    cleaned = redact_mapping(raw or {})
    out: dict[str, Any] = {}
    for key, value in cleaned.items():
        if key not in _ALLOWED_CONTEXT_KEYS:
            continue
        out[key] = value
    # Soft size bound on serialized representation
    encoded = str(out)
    if len(encoded) > max_chars:
        out = {
            "truncated": True,
            "note": "Context truncated for minimization.",
            **{k: out[k] for k in list(out)[:5]},
        }
    return out
