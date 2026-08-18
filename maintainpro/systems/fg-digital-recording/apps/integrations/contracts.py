"""Integration contracts — anti-corruption DTOs.

Inbound fields mirror the Phase 07F technical consumer only.
Quantity/UOM/production-date/line/status are documented as *candidate*
concepts when a real vendor schema arrives — they are not invented mappings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any


class InboundFieldEvidence(StrEnum):
    """Whether a conceptual field is backed by vendor evidence."""

    MAPPED_INTERNAL = "MAPPED_INTERNAL"  # Safe to use via Phase 07F boundary
    EVIDENCE_REQUIRED = "EVIDENCE_REQUIRED"  # Must not invent vendor path/name


INBOUND_FIELD_EVIDENCE: dict[str, InboundFieldEvidence] = {
    "source_event_id": InboundFieldEvidence.MAPPED_INTERNAL,
    "external_batch_id": InboundFieldEvidence.MAPPED_INTERNAL,
    "erp_product_code": InboundFieldEvidence.MAPPED_INTERNAL,  # → external_product_key
    "external_organization_key": InboundFieldEvidence.MAPPED_INTERNAL,
    "external_site_key": InboundFieldEvidence.MAPPED_INTERNAL,
    "external_shift_key": InboundFieldEvidence.MAPPED_INTERNAL,
    "external_line_key": InboundFieldEvidence.MAPPED_INTERNAL,  # opaque only
    "quantity": InboundFieldEvidence.EVIDENCE_REQUIRED,
    "uom": InboundFieldEvidence.EVIDENCE_REQUIRED,
    "production_date": InboundFieldEvidence.EVIDENCE_REQUIRED,
    "vendor_batch_status": InboundFieldEvidence.EVIDENCE_REQUIRED,
}


@dataclass(frozen=True, slots=True)
class InboundBatchEventContract:
    """
    Normalized inbound batch event for the anti-corruption layer.

    Only identifiers that Phase 07F already accepts are required.
    Optional vendor-candidate fields may be carried for future mapping but
    must not drive domain behaviour until evidenced.
    """

    source_system: str
    source_event_id: str
    external_batch_id: str
    external_organization_key: str
    erp_product_code: str = ""
    external_site_key: str = ""
    external_shift_key: str = ""
    external_line_key: str = ""
    correlation_id: str = ""
    # Candidate fields — ignored by domain until vendor evidence exists
    quantity: Decimal | None = None
    uom: str = ""
    production_date: date | None = None
    vendor_batch_status: str = ""
    as_of: datetime | None = None
    raw_passthrough_keys: tuple[str, ...] = field(default_factory=tuple)

    def to_scheduling_kwargs(self) -> dict[str, Any]:
        """Map only evidenced internal contract fields into scheduling port."""
        return {
            "source_system": self.source_system.strip(),
            "source_event_id": self.source_event_id.strip(),
            "external_batch_id": self.external_batch_id.strip(),
            "external_organization_key": self.external_organization_key.strip(),
            "external_product_key": (self.erp_product_code or "").strip(),
            "external_site_key": (self.external_site_key or "").strip(),
            "external_shift_key": (self.external_shift_key or "").strip(),
            "external_line_key": (self.external_line_key or "").strip(),
            "as_of": self.as_of,
        }


@dataclass(frozen=True, slots=True)
class OutboundDispositionCommand:
    """
    Prepared outbound QA disposition command — not transmitted to ERP.

    Downstream RELEASE/HOLD/REJECT to ERP requires APR-017 formal approval.
    """

    organization_id: str
    checklist_submission_id: str
    qa_review_id: str
    disposition: str  # RELEASE | HOLD | REJECT (in-app label only)
    correlation_id: str = ""
    batch_reference: str = ""
    external_batch_id: str = ""


SOURCE_SYSTEM_BILEETA_CANDIDATE = "BILEETA"
# Opaque label only — does not imply a live connector or approved vendor naming.
