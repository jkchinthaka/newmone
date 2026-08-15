"""Integration error taxonomy — internal until vendor error format evidenced."""

from __future__ import annotations

from enum import StrEnum


class IntegrationErrorClass(StrEnum):
    AUTH_FAILURE = "AUTH_FAILURE"
    TIMEOUT = "TIMEOUT"
    RATE_LIMITED = "RATE_LIMITED"
    BAD_MAPPING = "BAD_MAPPING"
    VALIDATION = "VALIDATION"
    DUPLICATE = "DUPLICATE"
    VENDOR_EVIDENCE_BLOCKED = "VENDOR_EVIDENCE_BLOCKED"
    OUTBOUND_NOT_APPROVED = "OUTBOUND_NOT_APPROVED"
    TRANSIENT = "TRANSIENT"
    PERMANENT = "PERMANENT"
    UNKNOWN = "UNKNOWN"


class IntegrationError(Exception):
    def __init__(
        self,
        message: str,
        *,
        error_class: IntegrationErrorClass,
        retryable: bool = False,
        correlation_id: str = "",
        details: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.error_class = error_class
        self.retryable = retryable
        self.correlation_id = correlation_id
        self.details = dict(details or {})


def classify_http_status(status_code: int) -> tuple[IntegrationErrorClass, bool]:
    """Technical classification helper — not a claim about Bileeta error bodies."""
    if status_code in {401, 403}:
        return IntegrationErrorClass.AUTH_FAILURE, False
    if status_code == 408:
        return IntegrationErrorClass.TIMEOUT, True
    if status_code == 429:
        return IntegrationErrorClass.RATE_LIMITED, True
    if 500 <= status_code <= 599:
        return IntegrationErrorClass.TRANSIENT, True
    if 400 <= status_code <= 499:
        return IntegrationErrorClass.VALIDATION, False
    return IntegrationErrorClass.UNKNOWN, False
