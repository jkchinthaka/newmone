"""Security audit recording — never store secrets or request bodies."""

from __future__ import annotations

import hashlib
from typing import Any


from apps.core.persistence.transactions import atomic_fn
from apps.accounts.models import User
from apps.security_audit.models import SecurityAuditEvent

_SENSITIVE_METADATA_KEYS = frozenset(
    {
        "password",
        "password1",
        "password2",
        "current_password",
        "new_password",
        "confirm_password",
        "passwd",
        "secret",
        "token",
        "csrfmiddlewaretoken",
        "authorization",
        "cookie",
        "cookies",
        "session",
        "sessionid",
        "session_key",
        "body",
        "request_body",
        "raw_body",
        "api_key",
        "apikey",
    }
)


def mask_unknown_identifier(raw: str) -> str:
    """Hash unknown login identifiers so raw values are not stored."""
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"unknown:{digest}"


def sanitize_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    if not metadata:
        return {}
    cleaned: dict[str, Any] = {}
    for key, value in metadata.items():
        if key.lower() in _SENSITIVE_METADATA_KEYS:
            continue
        if isinstance(value, dict):
            cleaned[key] = sanitize_metadata(value)
        else:
            cleaned[key] = value
    return cleaned


@atomic_fn
def record_event(
    *,
    event_type: str,
    actor: User | None = None,
    subject_user: User | None = None,
    request_id: str | None = None,
    ip_address: str | None = None,
    user_agent_summary: str = "",
    metadata: dict[str, Any] | None = None,
    unknown_identifier: str | None = None,
) -> SecurityAuditEvent:
    """
    Persist a security audit event.

    Never stores passwords, session keys, cookies, tokens, or request bodies.
    Unknown login identifiers are hashed before storage.
    """
    if event_type not in SecurityAuditEvent.EventType.values:
        raise ValueError(f"Unsupported security audit event type: {event_type}")

    meta = sanitize_metadata(metadata)
    if unknown_identifier:
        meta["identifier"] = mask_unknown_identifier(unknown_identifier)

    return SecurityAuditEvent.objects.create(
        event_type=event_type,
        actor=actor,
        subject_user=subject_user,
        request_id=(request_id or "")[:128],
        ip_address=ip_address or None,
        user_agent_summary=(user_agent_summary or "")[:512],
        metadata=meta,
    )
