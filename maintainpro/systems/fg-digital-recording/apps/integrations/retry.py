"""Retry / backoff policy — technical defaults, not vendor-approved limits."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    max_attempts: int = 3
    initial_delay_seconds: float = 1.0
    multiplier: float = 2.0
    max_delay_seconds: float = 30.0

    def delay_for_attempt(self, attempt: int) -> float:
        """attempt is 1-based for the next sleep after a failure."""
        if attempt < 1:
            return self.initial_delay_seconds
        delay = self.initial_delay_seconds * (self.multiplier ** (attempt - 1))
        return min(delay, self.max_delay_seconds)


DEFAULT_RETRY_POLICY = RetryPolicy()
