"""Genealogy Mongo projection / depth policy — dual-gate default OFF (APR-061)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.batch_genealogy.models import GenealogyPolicy

DEFAULT_MAX_TRACE_DEPTH = 25


def batch_genealogy_mongo_projection_approved() -> bool:
    return bool(getattr(settings, "BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED", False))


@dataclass(frozen=True, slots=True)
class GenealogyMongoProjectionDecision:
    allowed: bool
    reason_code: str
    max_trace_depth: int = DEFAULT_MAX_TRACE_DEPTH
    procedure_reference: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "reason_code": self.reason_code,
            "max_trace_depth": self.max_trace_depth,
            "procedure_reference": self.procedure_reference,
            "embedded_graphs_forbidden": True,
            "evidence_gate": "APR-061 / company genealogy Mongo projection policy",
        }


def evaluate_genealogy_mongo_projection(
    *, organization_id: UUID
) -> GenealogyMongoProjectionDecision:
    policy = GenealogyPolicy.objects.filter(organization_id=organization_id).first()
    depth = policy.max_trace_depth if policy else DEFAULT_MAX_TRACE_DEPTH
    depth = max(1, min(int(depth), 100))
    if policy is None or not policy.mongo_projection_enabled:
        return GenealogyMongoProjectionDecision(
            allowed=False,
            reason_code="POLICY_DISABLED",
            max_trace_depth=depth,
            procedure_reference=(policy.procedure_reference if policy else ""),
        )
    if not batch_genealogy_mongo_projection_approved():
        return GenealogyMongoProjectionDecision(
            allowed=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            max_trace_depth=depth,
            procedure_reference=policy.procedure_reference,
        )
    return GenealogyMongoProjectionDecision(
        allowed=True,
        reason_code="MONGO_PROJECTION_ENABLED",
        max_trace_depth=depth,
        procedure_reference=policy.procedure_reference,
    )


def resolve_max_trace_depth(*, organization_id: UUID) -> int:
    return evaluate_genealogy_mongo_projection(organization_id=organization_id).max_trace_depth
