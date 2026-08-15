"""Bileeta live HTTP client — hard-gated; never invents endpoints."""

from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings

from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.integrations.vendor_evidence import assert_live_calls_allowed, evidence_is_complete


@dataclass(frozen=True, slots=True)
class BileetaClientConfig:
    live_enabled: bool
    base_url: str
    timeout_seconds: float
    verify_tls: bool

    @classmethod
    def from_settings(cls) -> BileetaClientConfig:
        return cls(
            live_enabled=bool(getattr(settings, "BILEETA_LIVE_ENABLED", False)),
            base_url=(getattr(settings, "BILEETA_BASE_URL", "") or "").strip(),
            timeout_seconds=float(getattr(settings, "BILEETA_HTTP_TIMEOUT_SECONDS", 10)),
            verify_tls=bool(getattr(settings, "BILEETA_VERIFY_TLS", True)),
        )


class LiveBileetaClient:
    """
    Placeholder live client.

    Refuses all network I/O until vendor evidence is complete AND
    BILEETA_LIVE_ENABLED is explicitly true. Does not define invented paths.
    """

    def __init__(self, config: BileetaClientConfig | None = None) -> None:
        self.config = config or BileetaClientConfig.from_settings()

    def ensure_live_allowed(self) -> None:
        if not self.config.live_enabled:
            raise IntegrationError(
                "BILEETA_LIVE_ENABLED is false — live HTTP disabled.",
                error_class=IntegrationErrorClass.VENDOR_EVIDENCE_BLOCKED,
                retryable=False,
            )
        assert_live_calls_allowed()
        if not self.config.base_url:
            raise IntegrationError(
                "BILEETA_BASE_URL is empty — cannot call vendor without evidenced base URL.",
                error_class=IntegrationErrorClass.VENDOR_EVIDENCE_BLOCKED,
                retryable=False,
            )
        if not self.config.verify_tls:
            raise IntegrationError(
                "TLS verification must remain enabled for Bileeta HTTP.",
                error_class=IntegrationErrorClass.VALIDATION,
                retryable=False,
            )

    def fetch_batch_events(self, *, since_cursor: str = "") -> list[dict[str, object]]:
        """Blocked — no invented endpoint path."""
        self.ensure_live_allowed()
        # Unreachable while evidence incomplete; if owners complete evidence later,
        # endpoint path must be supplied by approved contract — still not invented here.
        raise IntegrationError(
            "No approved Bileeta batch endpoint path is recorded in the repository. "
            "Refuse to invent URLs. Provide APR-011/APR-012 artefacts first.",
            error_class=IntegrationErrorClass.VENDOR_EVIDENCE_BLOCKED,
            retryable=False,
            details={"since_cursor_present": str(bool(since_cursor))},
        )

    def health_probe(self) -> None:
        self.ensure_live_allowed()
        raise IntegrationError(
            "No approved Bileeta health endpoint path is recorded.",
            error_class=IntegrationErrorClass.VENDOR_EVIDENCE_BLOCKED,
            retryable=False,
        )


def live_client_is_callable() -> bool:
    cfg = BileetaClientConfig.from_settings()
    return bool(cfg.live_enabled and cfg.base_url and evidence_is_complete() and cfg.verify_tls)
