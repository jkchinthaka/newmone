"""Feature flag helpers — AI assistance is optional and off by default.

Canonical enablement checks for orchestration also live in ``policy``;
this module exposes shared env accessors for providers and retention.
"""

from __future__ import annotations

from django.conf import settings


def ai_assistance_enabled() -> bool:
    """Global kill-switch. Core workflows must not depend on this being True."""
    return bool(getattr(settings, "AI_ASSISTANCE_ENABLED", False))


def ai_provider_name() -> str:
    return (getattr(settings, "AI_ASSISTANCE_PROVIDER", "null") or "null").strip().lower()


def ai_timeout_seconds() -> float:
    try:
        return max(0.5, float(getattr(settings, "AI_ASSISTANCE_TIMEOUT_SECONDS", 15.0)))
    except (TypeError, ValueError):
        return 15.0


def store_prompts_enabled() -> bool:
    """Default False — do not retain full prompts unless owners approve retention."""
    return bool(getattr(settings, "AI_ASSISTANCE_STORE_PROMPTS", False))
