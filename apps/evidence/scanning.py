"""
Malware scanning interface for evidence uploads.

Phase 11 does **not** enable an active scanner. Default provider records
NOT_CONFIGURED so operators and auditors never assume scanning is live.
Wire a real scanner behind MalwareScanner only after IT security approval.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from django.conf import settings


class MalwareScanStatus:
    NOT_CONFIGURED = "NOT_CONFIGURED"
    PENDING = "PENDING"
    CLEAN = "CLEAN"
    INFECTED = "INFECTED"
    ERROR = "ERROR"


@dataclass(frozen=True, slots=True)
class MalwareScanResult:
    status: str
    provider: str
    detail: str


class MalwareScanner(Protocol):
    def scan(self, *, storage_key: str, content_sha256: str) -> MalwareScanResult:
        """Inspect stored bytes (or metadata) and return a scan result."""


class NullMalwareScanner:
    """Explicit no-op scanner — scanning is not active."""

    provider_name = "null"

    def scan(self, *, storage_key: str, content_sha256: str) -> MalwareScanResult:
        _ = storage_key, content_sha256
        return MalwareScanResult(
            status=MalwareScanStatus.NOT_CONFIGURED,
            provider=self.provider_name,
            detail=(
                "Malware scanning is not configured for this environment. "
                "Do not claim evidence files were scanned. Future integration only."
            ),
        )


def get_malware_scanner() -> MalwareScanner:
    """
    Resolve scanner from settings.

    EVIDENCE_MALWARE_SCANNER must remain empty/null until infrastructure exists.
    Unknown class paths fall back to NullMalwareScanner (fail closed to honesty).
    """
    path = getattr(settings, "EVIDENCE_MALWARE_SCANNER", "") or ""
    if not path.strip():
        return NullMalwareScanner()
    # Reserved for future: import_string(path). For Phase 11, refuse null
    # unless a known safe stub is registered — never pretend scanning works.
    return NullMalwareScanner()
