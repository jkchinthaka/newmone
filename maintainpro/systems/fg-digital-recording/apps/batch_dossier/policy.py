"""Batch dossier PDF export gate — default OFF (APR-060)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.batch_dossier.models import BatchDossierPolicy


def batch_dossier_pdf_export_approved() -> bool:
    return bool(getattr(settings, "BATCH_DOSSIER_PDF_EXPORT_APPROVED", False))


@dataclass(frozen=True, slots=True)
class BatchDossierExportDecision:
    allowed: bool
    reason_code: str
    procedure_reference: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "pdf_not_generated": True,
            "evidence_gate": "APR-060 / company batch dossier export policy",
        }


def evaluate_batch_dossier_pdf_export(*, organization_id: UUID) -> BatchDossierExportDecision:
    policy = BatchDossierPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.pdf_export_enabled:
        return BatchDossierExportDecision(
            allowed=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=(policy.procedure_reference if policy else ""),
        )
    if not batch_dossier_pdf_export_approved():
        return BatchDossierExportDecision(
            allowed=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
        )
    return BatchDossierExportDecision(
        allowed=True,
        reason_code="PDF_EXPORT_ENABLED",
        procedure_reference=policy.procedure_reference,
    )
