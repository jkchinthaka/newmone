"""Prompt-injection resistance helpers — Phase 18."""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError

_INJECTION_PATTERNS = (
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.I),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|system)\s+", re.I),
    re.compile(r"you\s+are\s+now\s+(a|an|the)\s+", re.I),
    re.compile(r"system\s*:\s*", re.I),
    re.compile(r"<\s*/?\s*system\s*>", re.I),
    re.compile(r"reveal\s+(your\s+)?(system\s+)?prompt", re.I),
    re.compile(r"jailbreak", re.I),
    re.compile(r"do\s+not\s+follow\s+safety", re.I),
)


def detect_prompt_injection(user_text: str) -> bool:
    text = user_text or ""
    return any(p.search(text) for p in _INJECTION_PATTERNS)


def assert_prompt_safe(user_text: str) -> None:
    if detect_prompt_injection(user_text):
        raise ValidationError(
            {
                "prompt": (
                    "Prompt rejected: potential prompt-injection pattern detected. "
                    "Rephrase without instruction-override language."
                )
            }
        )


SAFE_FALLBACK_MESSAGE = (
    "AI assistance is temporarily unavailable. "
    "Continue using standard quality workflows; no AI decision was applied."
)
