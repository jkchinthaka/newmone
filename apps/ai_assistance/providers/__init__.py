"""LLM provider package — domain must not import a specific vendor SDK."""

from __future__ import annotations

from apps.ai_assistance.flags import ai_provider_name
from apps.ai_assistance.providers.base import LLMProvider, ProviderResult
from apps.ai_assistance.providers.mock import MockLLMProvider
from apps.ai_assistance.providers.null import NullLLMProvider

__all__ = [
    "LLMProvider",
    "MockLLMProvider",
    "NullLLMProvider",
    "ProviderResult",
    "get_provider",
]


def get_provider(name: str | None = None) -> LLMProvider:
    selected = (name or ai_provider_name()).strip().lower()
    if selected == "mock":
        return MockLLMProvider()
    # null (default) and any unknown name → safe null provider
    return NullLLMProvider()
