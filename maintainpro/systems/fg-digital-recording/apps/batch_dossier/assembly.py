"""Read-model dataclasses for the electronic batch quality dossier."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True, slots=True)
class DossierSectionPage:
    """Paginated section of authorized references (not duplicated source rows)."""

    key: str
    access: str  # ALLOWED | DENIED | EMPTY
    items: tuple[dict[str, Any], ...]
    total_count: int
    limit: int
    offset: int
    has_more: bool
    notes: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "access": self.access,
            "items": list(self.items),
            "total_count": self.total_count,
            "limit": self.limit,
            "offset": self.offset,
            "has_more": self.has_more,
            "notes": self.notes,
        }


@dataclass(frozen=True, slots=True)
class BatchQualityDossier:
    """
    One assembled batch quality dossier.

    Source of truth remains in domain tables; this object holds references and
    immutable snapshot excerpts only.
    """

    organization_id: str
    batch_reference: str
    assembled_at: datetime
    identity: dict[str, Any]
    sections: dict[str, dict[str, Any]]
    timeline: tuple[dict[str, Any], ...]
    export_hook: dict[str, Any] = field(default_factory=dict)
    performance: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "organization_id": self.organization_id,
            "batch_reference": self.batch_reference,
            "assembled_at": self.assembled_at.isoformat(),
            "identity": dict(self.identity),
            "sections": {k: dict(v) for k, v in self.sections.items()},
            "timeline": list(self.timeline),
            "export_hook": dict(self.export_hook),
            "performance": dict(self.performance),
            "source_of_truth": "domain_references_and_immutable_snapshots",
            "mutable_records_not_duplicated": True,
            "not_fg_release_decision": True,
            "evidence_gate": "APR-060 / company electronic batch record policy",
        }
