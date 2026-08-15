"""Deterministic mock provider for contract tests — no network I/O."""

from __future__ import annotations

import time

from apps.ai_assistance.providers.base import LLMProvider, ProviderResult
from apps.ai_assistance.safety import SAFE_FALLBACK_MESSAGE


class MockLLMProvider(LLMProvider):
    name = "mock"

    def __init__(self, *, fail_mode: str = "") -> None:
        self.fail_mode = fail_mode  # "", "timeout", "error"

    def generate(
        self,
        *,
        use_case: str,
        user_text: str,
        context: dict[str, object],
        timeout_seconds: float,
    ) -> ProviderResult:
        raw_ids = context.get("source_ids")
        source_ids = tuple(str(x) for x in raw_ids) if isinstance(raw_ids, (list, tuple)) else ()
        if self.fail_mode == "timeout":
            # Simulate timeout without sleeping the full timeout in unit tests.
            _ = timeout_seconds
            time.sleep(0)
            return ProviderResult(
                text=SAFE_FALLBACK_MESSAGE,
                provider_name=self.name,
                timed_out=True,
                failed=True,
                source_ids=source_ids,
            )
        if self.fail_mode == "error":
            return ProviderResult(
                text=SAFE_FALLBACK_MESSAGE,
                provider_name=self.name,
                failed=True,
                source_ids=source_ids,
            )
        sources = ", ".join(source_ids) if source_ids else "(no internal source ids)"
        text = (
            f"Advisory summary for {use_case}. "
            f"Grounded on internal records: {sources}. "
            "This is not a quality disposition, CAPA close, or root-cause determination."
        )
        return ProviderResult(text=text, provider_name=self.name, source_ids=source_ids)
