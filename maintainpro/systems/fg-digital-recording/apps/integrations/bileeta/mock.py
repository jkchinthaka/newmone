"""Mock Bileeta adapter — contract tests only; no network I/O."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from apps.integrations.contracts import (
    SOURCE_SYSTEM_BILEETA_CANDIDATE,
    InboundBatchEventContract,
)
from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.integrations.retry import DEFAULT_RETRY_POLICY, RetryPolicy


@dataclass
class MockBileetaAdapter:
    """
    Deterministic sandbox substitute for contract tests.

    Simulates timeout, auth failure, rate-limit, and successful event yield
    without calling any real vendor host.
    """

    events: list[InboundBatchEventContract] = field(default_factory=list)
    fail_mode: str = ""  # "", "timeout", "auth", "rate_limit"
    retry_policy: RetryPolicy = field(default_factory=lambda: DEFAULT_RETRY_POLICY)
    _calls: int = 0

    def pull_batch_events(self) -> list[InboundBatchEventContract]:
        self._calls += 1
        if self.fail_mode == "timeout":
            raise IntegrationError(
                "Mock timeout",
                error_class=IntegrationErrorClass.TIMEOUT,
                retryable=True,
            )
        if self.fail_mode == "auth":
            raise IntegrationError(
                "Mock authentication failure",
                error_class=IntegrationErrorClass.AUTH_FAILURE,
                retryable=False,
            )
        if self.fail_mode == "rate_limit":
            raise IntegrationError(
                "Mock rate limited",
                error_class=IntegrationErrorClass.RATE_LIMITED,
                retryable=True,
            )
        return list(self.events)

    def pull_with_retries(self) -> list[InboundBatchEventContract]:
        attempt = 0
        last_error: IntegrationError | None = None
        while attempt < self.retry_policy.max_attempts:
            attempt += 1
            try:
                return self.pull_batch_events()
            except IntegrationError as exc:
                last_error = exc
                if not exc.retryable or attempt >= self.retry_policy.max_attempts:
                    raise
                # Non-sleeping backoff for tests: compute delay only
                _ = self.retry_policy.delay_for_attempt(attempt)
                time.sleep(0)  # yield; avoid real waits in unit tests
        if last_error is None:
            raise IntegrationError(
                "Mock adapter exhausted retries without a recorded error.",
                error_class=IntegrationErrorClass.TIMEOUT,
                retryable=False,
            )
        raise last_error


def sample_mock_event(
    *,
    source_event_id: str,
    external_batch_id: str,
    external_organization_key: str,
    erp_product_code: str = "",
    correlation_id: str = "",
) -> InboundBatchEventContract:
    return InboundBatchEventContract(
        source_system=SOURCE_SYSTEM_BILEETA_CANDIDATE,
        source_event_id=source_event_id,
        external_batch_id=external_batch_id,
        external_organization_key=external_organization_key,
        erp_product_code=erp_product_code,
        correlation_id=correlation_id or source_event_id,
    )
