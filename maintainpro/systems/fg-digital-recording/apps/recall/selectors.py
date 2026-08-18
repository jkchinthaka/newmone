"""Recall read selectors — Phase 37."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.recall.models import (
    RecallAffectedBatch,
    RecallCase,
    RecallTimelineEntry,
)


def get_recall_case(*, organization_id: uuid.UUID, case_id: uuid.UUID) -> RecallCase | None:
    return (
        RecallCase.objects.filter(pk=case_id, organization_id=organization_id)
        .select_related("initiated_by", "owner", "closed_by")
        .first()
    )


def get_recall_case_by_code(*, organization_id: uuid.UUID, code: str) -> RecallCase | None:
    key = (code or "").strip()
    if not key:
        return None
    return RecallCase.objects.filter(organization_id=organization_id, code__iexact=key).first()


def batches_for_case(*, case_id: uuid.UUID) -> QuerySet[RecallAffectedBatch]:
    return RecallAffectedBatch.objects.filter(recall_case_id=case_id).order_by("created_at")


def timeline_for_case(*, case_id: uuid.UUID) -> QuerySet[RecallTimelineEntry]:
    return (
        RecallTimelineEntry.objects.filter(recall_case_id=case_id)
        .select_related("actor")
        .order_by("created_at")
    )
