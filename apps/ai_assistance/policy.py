"""Feature-flag and prohibited-action policy for AI assistance."""

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError

from apps.ai_assistance.catalogue import (
    PROHIBITED_PHRASE_HINTS,
    AllowedUseCase,
    ProhibitedAction,
)


def ai_assistance_enabled() -> bool:
    """Global optional switch — default OFF. Core product must work when False."""
    return bool(getattr(settings, "AI_ASSISTANCE_ENABLED", False))


def ai_timeout_seconds() -> float:
    """Provider call timeout — fail closed to safe fallback on expiry."""
    try:
        return max(0.5, float(getattr(settings, "AI_ASSISTANCE_TIMEOUT_SECONDS", 15.0)))
    except (TypeError, ValueError):
        return 15.0


def assert_ai_enabled() -> None:
    if not ai_assistance_enabled():
        raise PermissionDenied(
            "AI assistance is disabled. Core quality workflows remain available without AI."
        )


def parse_use_case(code: str) -> AllowedUseCase:
    try:
        return AllowedUseCase(str(code).strip().upper())
    except ValueError as exc:
        raise ValidationError({"use_case": f"Unknown or disallowed use case: {code}"}) from exc


def detect_prohibited_actions(user_text: str) -> list[ProhibitedAction]:
    """Heuristic refusal cues — advisory safety net, not a complete NLP firewall."""
    text = (user_text or "").lower()
    hits: list[ProhibitedAction] = []
    for action, phrases in PROHIBITED_PHRASE_HINTS.items():
        if any(p in text for p in phrases):
            hits.append(action)
    return hits


def assert_no_prohibited_request(user_text: str) -> None:
    hits = detect_prohibited_actions(user_text)
    if hits:
        codes = ", ".join(h.value for h in hits)
        raise ValidationError(
            {
                "prompt": (
                    "Request appears to ask AI to perform a prohibited quality action "
                    f"({codes}). AI is advisory only and cannot execute these decisions."
                )
            }
        )
