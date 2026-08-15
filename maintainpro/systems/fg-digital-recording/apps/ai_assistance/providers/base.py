"""Provider abstraction — do not couple domain logic to one LLM vendor."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ProviderResult:
    text: str
    provider_name: str
    timed_out: bool = False
    failed: bool = False
    source_ids: tuple[str, ...] = field(default_factory=tuple)


class LLMProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    def generate(
        self,
        *,
        use_case: str,
        user_text: str,
        context: dict[str, object],
        timeout_seconds: float,
    ) -> ProviderResult:
        """Return advisory text only. Must not mutate domain state."""
