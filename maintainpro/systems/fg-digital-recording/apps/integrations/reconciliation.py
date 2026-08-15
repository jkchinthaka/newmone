"""Batch-event reconciliation — missing / duplicate / mismatched."""

from __future__ import annotations

import uuid
from collections import Counter
from dataclasses import dataclass

from django.db.models import Q

from apps.scheduling.models import ExternalBatchEvent, ExternalBatchEventStatus


@dataclass(frozen=True, slots=True)
class ReconciliationFinding:
    kind: str  # DUPLICATE_SOURCE_EVENT | MAPPING_FAILED | COMPLETED_WITHOUT_TASK | MISMATCHED_BATCH
    external_batch_event_id: str
    source_system: str
    source_event_id: str
    detail: str


def reconcile_external_batch_events(
    *,
    organization_id: uuid.UUID | None = None,
    source_system: str = "",
    include_unmapped: bool = True,
    limit: int = 500,
) -> list[ReconciliationFinding]:
    """
    Identify operational anomalies on stored ExternalBatchEvent rows.

    Does not invent vendor-side truth — only compares local receipts.
    Mapping failures often have null organization_id; pass include_unmapped=True
    (default) when scoping by organization to still surface those receipts.
    """
    qs = ExternalBatchEvent.objects.select_related("checklist_task").order_by("-created_at")
    if organization_id is not None:
        if include_unmapped:
            qs = qs.filter(Q(organization_id=organization_id) | Q(organization_id__isnull=True))
        else:
            qs = qs.filter(organization_id=organization_id)
    if source_system:
        qs = qs.filter(source_system__iexact=source_system.strip())

    rows = list(qs[: max(1, min(limit, 5000))])
    findings: list[ReconciliationFinding] = []

    # Duplicates by (source_system, source_event_id) — should be unique; flag multiples
    key_counts: Counter[tuple[str, str]] = Counter(
        (e.source_system, e.source_event_id) for e in rows
    )
    for e in rows:
        key = (e.source_system, e.source_event_id)
        if key_counts[key] > 1:
            findings.append(
                ReconciliationFinding(
                    kind="DUPLICATE_SOURCE_EVENT",
                    external_batch_event_id=str(e.id),
                    source_system=e.source_system,
                    source_event_id=e.source_event_id,
                    detail="Multiple local rows share source_system+source_event_id in sample.",
                )
            )
        if e.status == ExternalBatchEventStatus.MAPPING_FAILED:
            findings.append(
                ReconciliationFinding(
                    kind="MAPPING_FAILED",
                    external_batch_event_id=str(e.id),
                    source_system=e.source_system,
                    source_event_id=e.source_event_id,
                    detail=e.failure_code or "mapping_failed",
                )
            )
        if e.status == ExternalBatchEventStatus.COMPLETED and e.checklist_task_id is None:
            findings.append(
                ReconciliationFinding(
                    kind="COMPLETED_WITHOUT_TASK",
                    external_batch_event_id=str(e.id),
                    source_system=e.source_system,
                    source_event_id=e.source_event_id,
                    detail="COMPLETED status without checklist_task link.",
                )
            )
        if (
            e.checklist_task_id
            and e.external_batch_id
            and e.checklist_task is not None
            and e.checklist_task.batch_reference
            and e.checklist_task.batch_reference != e.external_batch_id
        ):
            findings.append(
                ReconciliationFinding(
                    kind="MISMATCHED_BATCH",
                    external_batch_event_id=str(e.id),
                    source_system=e.source_system,
                    source_event_id=e.source_event_id,
                    detail=(
                        f"external_batch_id={e.external_batch_id!r} != "
                        f"task.batch_reference={e.checklist_task.batch_reference!r}"
                    ),
                )
            )
    return findings
