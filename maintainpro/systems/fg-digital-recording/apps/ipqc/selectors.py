"""Read selectors / dashboard visibility for IPQC — Phase 34."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from django.db.models import QuerySet
from django.utils import timezone

from apps.ipqc.models import IpqcInspectionCase, IpqcWorkflowStatus

DashboardBucket = Literal["due", "overdue", "failure", "open", "all"]


@dataclass(frozen=True, slots=True)
class IpqcDashboardSnapshot:
    as_of: datetime
    due_count: int
    overdue_count: int
    failure_count: int
    open_count: int
    due_case_ids: tuple[str, ...]
    overdue_case_ids: tuple[str, ...]
    failure_case_ids: tuple[str, ...]


def cases_for_organization(organization_id: uuid.UUID) -> QuerySet[IpqcInspectionCase]:
    return IpqcInspectionCase.objects.filter(organization_id=organization_id)


def cases_for_process_scope(
    *,
    organization_id: uuid.UUID,
    production_line_code: str = "",
    batch_reference: str = "",
    product_id: uuid.UUID | None = None,
) -> QuerySet[IpqcInspectionCase]:
    qs = IpqcInspectionCase.objects.filter(organization_id=organization_id)
    line = (production_line_code or "").strip()
    if line:
        qs = qs.filter(production_line_code__iexact=line)
    batch = (batch_reference or "").strip()
    if batch:
        qs = qs.filter(batch_reference__iexact=batch)
    if product_id is not None:
        qs = qs.filter(product_id=product_id)
    return qs


def _open_statuses() -> set[str]:
    return {
        IpqcWorkflowStatus.OPEN,
        IpqcWorkflowStatus.TASK_CREATED,
        IpqcWorkflowStatus.IN_PROGRESS,
        IpqcWorkflowStatus.MEASURED,
        IpqcWorkflowStatus.FAILED,
        IpqcWorkflowStatus.ESCALATED,
    }


def cases_due(
    *,
    organization_id: uuid.UUID,
    as_of: datetime | None = None,
) -> QuerySet[IpqcInspectionCase]:
    """Cases with due_at at/after as_of that are still open (not yet overdue)."""
    instant = as_of or timezone.now()
    return (
        IpqcInspectionCase.objects.filter(
            organization_id=organization_id,
            workflow_status__in=_open_statuses(),
            due_at__isnull=False,
            due_at__gte=instant,
            failure_detected=False,
        )
        .select_related("definition", "product", "shift")
        .order_by("due_at")
    )


def cases_overdue(
    *,
    organization_id: uuid.UUID,
    as_of: datetime | None = None,
) -> QuerySet[IpqcInspectionCase]:
    instant = as_of or timezone.now()
    return (
        IpqcInspectionCase.objects.filter(
            organization_id=organization_id,
            workflow_status__in=_open_statuses(),
            due_at__isnull=False,
            due_at__lt=instant,
        )
        .select_related("definition", "product", "shift")
        .order_by("due_at")
    )


def cases_with_failure(
    *,
    organization_id: uuid.UUID,
) -> QuerySet[IpqcInspectionCase]:
    return (
        IpqcInspectionCase.objects.filter(
            organization_id=organization_id,
            failure_detected=True,
        )
        .select_related("definition", "product", "nonconformance", "hold_case")
        .order_by("-updated_at")
    )


def build_ipqc_dashboard(
    *,
    organization_id: uuid.UUID,
    as_of: datetime | None = None,
) -> IpqcDashboardSnapshot:
    """Current IPQC due / overdue / failure visibility (read model only)."""
    instant = as_of or timezone.now()
    due = list(
        cases_due(organization_id=organization_id, as_of=instant).values_list("id", flat=True)[:200]
    )
    overdue = list(
        cases_overdue(organization_id=organization_id, as_of=instant).values_list("id", flat=True)[
            :200
        ]
    )
    failures = list(
        cases_with_failure(organization_id=organization_id).values_list("id", flat=True)[:200]
    )
    open_count = IpqcInspectionCase.objects.filter(
        organization_id=organization_id,
        workflow_status__in=_open_statuses(),
    ).count()
    return IpqcDashboardSnapshot(
        as_of=instant,
        due_count=len(due),
        overdue_count=len(overdue),
        failure_count=len(failures),
        open_count=open_count,
        due_case_ids=tuple(str(x) for x in due),
        overdue_case_ids=tuple(str(x) for x in overdue),
        failure_case_ids=tuple(str(x) for x in failures),
    )
