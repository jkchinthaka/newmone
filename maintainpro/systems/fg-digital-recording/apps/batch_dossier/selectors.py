"""Bounded read selectors for electronic batch quality dossier — Phase 35."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

from django.db.models import Prefetch, Q, QuerySet

from apps.capa.models import CorrectiveAction
from apps.core.persistence import prefetch_related_compat
from apps.dispatch.models import DispatchQualityRecord
from apps.evidence.models import EvidenceAttachment, EvidenceLinkedKind
from apps.integrations.models import IntegrationAttempt
from apps.ipqc.models import IpqcInspectionCase
from apps.laboratory.models import LabResult, LabSample, LabTest
from apps.nonconformance.models import HoldCase, NonConformanceRecord
from apps.quality.models import QAReview
from apps.recording.models import ChecklistCorrection, ChecklistSubmission
from apps.reviews.models import SupervisorReview
from apps.scheduling.models import ChecklistTask, ExternalBatchEvent
from apps.security_audit.models import SecurityAuditEvent

DEFAULT_SECTION_LIMIT = 50
MAX_SECTION_LIMIT = 200


def normalize_batch_reference(raw: str) -> str:
    return (raw or "").strip()


def clamp_limit(limit: int | None, *, default: int = DEFAULT_SECTION_LIMIT) -> int:
    value = default if limit is None else int(limit)
    return max(1, min(value, MAX_SECTION_LIMIT))


def clamp_offset(offset: int | None) -> int:
    return max(0, int(offset or 0))


def tasks_for_batch(*, organization_id: uuid.UUID, batch_reference: str) -> QuerySet[ChecklistTask]:
    ref = normalize_batch_reference(batch_reference)
    return (
        ChecklistTask.objects.filter(
            organization_id=organization_id,
            batch_reference__iexact=ref,
        )
        .select_related(
            "checklist_template",
            "checklist_version",
            "shift",
            "assigned_department",
        )
        .order_by("created_at")
    )


def submissions_for_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[ChecklistSubmission]:
    ref = normalize_batch_reference(batch_reference)
    return (
        ChecklistSubmission.objects.filter(
            checklist_record__organization_id=organization_id,
            checklist_record__checklist_task__batch_reference__iexact=ref,
        )
        .select_related(
            "checklist_record",
            "checklist_record__checklist_task",
            "checklist_record__checklist_task__checklist_template",
            "submitted_by",
        )
        .order_by("submitted_at")
    )


def corrections_for_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[ChecklistCorrection]:
    ref = normalize_batch_reference(batch_reference)
    return (
        ChecklistCorrection.objects.filter(
            organization_id=organization_id,
            source_submission__checklist_record__checklist_task__batch_reference__iexact=ref,
        )
        .select_related(
            "source_submission",
            "resulting_submission",
            "started_by",
            "checklist_record",
        )
        .order_by("started_at")
    )


def supervisor_reviews_for_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[SupervisorReview]:
    ref = normalize_batch_reference(batch_reference)
    return (
        SupervisorReview.objects.filter(
            organization_id=organization_id,
            checklist_submission__checklist_record__checklist_task__batch_reference__iexact=ref,
        )
        .select_related(
            "checklist_submission",
            "checklist_submission__checklist_record__checklist_task",
            "reviewed_by",
        )
        .order_by("reviewed_at")
    )


def qa_reviews_for_batch(*, organization_id: uuid.UUID, batch_reference: str) -> QuerySet[QAReview]:
    ref = normalize_batch_reference(batch_reference)
    return (
        QAReview.objects.filter(
            organization_id=organization_id,
            checklist_submission__checklist_record__checklist_task__batch_reference__iexact=ref,
        )
        .select_related(
            "checklist_submission",
            "checklist_submission__checklist_record__checklist_task",
            "reviewed_by",
            "supervisor_review",
        )
        .order_by("reviewed_at")
    )


def ipqc_cases_for_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[IpqcInspectionCase]:
    ref = normalize_batch_reference(batch_reference)
    return (
        IpqcInspectionCase.objects.filter(
            organization_id=organization_id,
            batch_reference__iexact=ref,
        )
        .select_related(
            "definition",
            "product",
            "equipment",
            "shift",
            "nonconformance",
            "hold_case",
        )
        .order_by("created_at")
    )


def lab_samples_for_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[LabSample]:
    ref = normalize_batch_reference(batch_reference)
    # Flat Prefetch paths avoid nested queryset order_by/model mismatch.
    return prefetch_related_compat(
        LabSample.objects.filter(
            organization_id=organization_id,
            batch_reference__iexact=ref,
        ).select_related("product", "site"),
        Prefetch(
            "tests",
            queryset=LabTest.objects.order_by("created_at"),
        ),
        Prefetch(
            "tests__results",
            queryset=LabResult.objects.order_by("entered_at"),
        ),
    ).order_by("registered_at")


def ncrs_for_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[NonConformanceRecord]:
    ref = normalize_batch_reference(batch_reference)
    return NonConformanceRecord.objects.filter(
        organization_id=organization_id,
        batch_reference__iexact=ref,
    ).order_by("created_at")


def holds_for_batch(*, organization_id: uuid.UUID, batch_reference: str) -> QuerySet[HoldCase]:
    ref = normalize_batch_reference(batch_reference)
    return (
        HoldCase.objects.filter(
            organization_id=organization_id,
            batch_reference__iexact=ref,
        )
        .select_related("nonconformance")
        .order_by("opened_at")
    )


def capas_for_batch_ncrs(
    *, organization_id: uuid.UUID, ncr_ids: list[uuid.UUID]
) -> QuerySet[CorrectiveAction]:
    if not ncr_ids:
        return CorrectiveAction.objects.none()
    return (
        CorrectiveAction.objects.filter(
            organization_id=organization_id,
            nonconformance_id__in=ncr_ids,
        )
        .select_related("nonconformance")
        .order_by("created_at")
    )


def dispatch_for_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[DispatchQualityRecord]:
    ref = normalize_batch_reference(batch_reference)
    return prefetch_related_compat(
        DispatchQualityRecord.objects.filter(
            organization_id=organization_id,
            batch_reference__iexact=ref,
        ),
        "quantity_lines",
    ).order_by("created_at")


def external_batch_events_for_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[ExternalBatchEvent]:
    ref = normalize_batch_reference(batch_reference)
    return (
        ExternalBatchEvent.objects.filter(
            organization_id=organization_id,
            external_batch_id__iexact=ref,
        )
        .select_related("product", "checklist_task", "site", "shift")
        .order_by("created_at")
    )


def integration_attempts_for_events(*, event_ids: list[uuid.UUID]) -> QuerySet[IntegrationAttempt]:
    if not event_ids:
        return IntegrationAttempt.objects.none()
    return IntegrationAttempt.objects.filter(external_batch_event_id__in=event_ids).order_by(
        "created_at"
    )


def evidence_for_linked_targets(
    *,
    organization_id: uuid.UUID,
    targets: list[tuple[str, uuid.UUID]],
) -> QuerySet[EvidenceAttachment]:
    """Evidence metadata only — binaries stay in private storage."""
    if not targets:
        return EvidenceAttachment.objects.none()
    q = Q()
    for kind, object_id in targets:
        q |= Q(linked_kind=kind, linked_object_id=object_id)
    return (
        EvidenceAttachment.objects.filter(organization_id=organization_id)
        .filter(q)
        .select_related("uploaded_by")
        .order_by("uploaded_at")
    )


def audit_events_for_batch(
    *, batch_reference: str, organization_id: uuid.UUID | None = None
) -> QuerySet[SecurityAuditEvent]:
    """Audit references mentioning this batch via metadata (not a full org dump)."""
    ref = normalize_batch_reference(batch_reference)
    qs = SecurityAuditEvent.objects.filter(metadata__batch_reference__iexact=ref)
    if organization_id is not None:
        qs = qs.filter(metadata__organization_id=str(organization_id))
    return qs.select_related("actor").order_by("-created_at")


def page_values(
    qs: QuerySet[Any],
    *,
    limit: int,
    offset: int,
    serializer: Callable[[Any], dict[str, Any]],
) -> tuple[tuple[dict[str, Any], ...], int, bool]:
    safe_limit = clamp_limit(limit)
    safe_offset = clamp_offset(offset)
    total = qs.count()
    rows = tuple(serializer(obj) for obj in qs[safe_offset : safe_offset + safe_limit])
    has_more = (safe_offset + len(rows)) < total
    return rows, total, has_more


def submissions_with_device_traces(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[ChecklistSubmission]:
    from apps.recording.models import ChecklistSubmissionResponse

    return prefetch_related_compat(
        submissions_for_batch(
            organization_id=organization_id, batch_reference=batch_reference
        ),
        Prefetch(
            "responses",
            queryset=ChecklistSubmissionResponse.objects.select_related(
                "equipment", "calibration_record"
            ),
        ),
    )


EVIDENCE_KIND_SUBMISSION = EvidenceLinkedKind.CHECKLIST_SUBMISSION
EVIDENCE_KIND_SUPERVISOR = EvidenceLinkedKind.SUPERVISOR_REVIEW
EVIDENCE_KIND_QA = EvidenceLinkedKind.QA_REVIEW
EVIDENCE_KIND_NCR = EvidenceLinkedKind.NONCONFORMANCE
EVIDENCE_KIND_CAPA = EvidenceLinkedKind.CAPA
EVIDENCE_KIND_LAB = EvidenceLinkedKind.LAB_SAMPLE
EVIDENCE_KIND_IPQC = EvidenceLinkedKind.IPQC_INSPECTION_CASE
