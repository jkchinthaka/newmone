"""Vendor evidence gate — Phase 17.

Live Bileeta/ERP HTTP calls are forbidden until every required evidence item
is marked present by owners with durable artefacts (not chat silence).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class EvidenceStatus(StrEnum):
    MISSING = "MISSING"
    PARTIAL = "PARTIAL"
    PRESENT = "PRESENT"


@dataclass(frozen=True, slots=True)
class VendorEvidenceItem:
    code: str
    title: str
    status: EvidenceStatus
    notes: str
    approval_ref: str = ""


VENDOR_EVIDENCE_REGISTER: Final[tuple[VendorEvidenceItem, ...]] = (
    VendorEvidenceItem(
        code="API_DOCS",
        title="Vendor API documentation (versioned)",
        status=EvidenceStatus.MISSING,
        notes="No Bileeta OpenAPI/Swagger or controlled API PDF in repository.",
        approval_ref="APR-012",
    ),
    VendorEvidenceItem(
        code="SANDBOX",
        title="Sandbox / test environment access",
        status=EvidenceStatus.MISSING,
        notes="No sandbox base URL or access procedure recorded.",
        approval_ref="APR-012",
    ),
    VendorEvidenceItem(
        code="AUTH_METHOD",
        title="Authentication method (OAuth/API key/mTLS/etc.)",
        status=EvidenceStatus.MISSING,
        notes="Auth scheme unknown — do not invent token flows.",
        approval_ref="APR-012",
    ),
    VendorEvidenceItem(
        code="BASE_URL",
        title="Approved production and sandbox base URLs",
        status=EvidenceStatus.MISSING,
        notes="No base URL evidenced; env placeholders remain empty by default.",
        approval_ref="APR-012",
    ),
    VendorEvidenceItem(
        code="BATCH_PRODUCT_ENDPOINTS",
        title="Batch / product endpoint catalogue",
        status=EvidenceStatus.MISSING,
        notes="Endpoint paths must not be invented. Use Phase 07F internal contract only.",
        approval_ref="APR-011",
    ),
    VendorEvidenceItem(
        code="RATE_LIMITS",
        title="Rate-limit / throttle policy",
        status=EvidenceStatus.MISSING,
        notes="Retry/backoff defaults are technical only — vendor limits EVIDENCE REQUIRED.",
        approval_ref="APR-012",
    ),
    VendorEvidenceItem(
        code="ERROR_FORMAT",
        title="Vendor error response format",
        status=EvidenceStatus.MISSING,
        notes="Error classification uses internal taxonomy until vendor format arrives.",
        approval_ref="APR-012",
    ),
    VendorEvidenceItem(
        code="SUPPORT_OWNER",
        title="Vendor / IT support owner for poison messages",
        status=EvidenceStatus.MISSING,
        notes="APR-016 failure/retry operational owner still EVIDENCE REQUIRED.",
        approval_ref="APR-016",
    ),
)


def evidence_is_complete() -> bool:
    return all(item.status == EvidenceStatus.PRESENT for item in VENDOR_EVIDENCE_REGISTER)


def missing_evidence_codes() -> list[str]:
    return [item.code for item in VENDOR_EVIDENCE_REGISTER if item.status != EvidenceStatus.PRESENT]


def assert_live_calls_allowed() -> None:
    """Raise if live vendor HTTP is attempted without complete evidence."""
    if not evidence_is_complete():
        missing = ", ".join(missing_evidence_codes())
        raise RuntimeError(
            "Live Bileeta/ERP calls are blocked until vendor evidence is complete "
            f"(missing: {missing}). Use mock/contract adapters only. "
            "STATUS: PHASE 17 BLOCKED — VENDOR API EVIDENCE REQUIRED"
        )


def evidence_register_as_dicts() -> list[dict[str, str]]:
    return [
        {
            "code": i.code,
            "title": i.title,
            "status": i.status.value,
            "notes": i.notes,
            "approval_ref": i.approval_ref,
        }
        for i in VENDOR_EVIDENCE_REGISTER
    ]
