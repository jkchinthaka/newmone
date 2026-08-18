"""Report query builders — org-scoped; historical reports use immutable snapshots."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from django.db.models import QuerySet
from django.utils import timezone

from apps.capa.models import CorrectiveAction
from apps.nonconformance.models import HoldCase, NonConformanceRecord
from apps.quality.models import QAReview
from apps.recording.models import ChecklistCorrection, ChecklistResponse, ChecklistSubmission
from apps.reviews.models import SupervisorReview
from apps.scheduling.models import (
    ChecklistTask,
    ChecklistTaskStatus,
    ExternalBatchEvent,
    ExternalBatchEventStatus,
)
from apps.security_audit.models import SecurityAuditEvent

# Site path on ChecklistTask (no direct site FK).
_TASK_SITE = "assigned_department__site_id"
_SUB_TASK_SITE = "checklist_record__checklist_task__assigned_department__site_id"
_REV_TASK_SITE = (
    "checklist_submission__checklist_record__checklist_task__assigned_department__site_id"
)


def _parse_dt(value: str | datetime | None) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        text = f"{text}T00:00:00+00:00"
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def assert_not_draft_source(qs_model: type) -> None:
    """Hard guard: historical answer reports must never bind ChecklistResponse."""
    if qs_model is ChecklistResponse:
        raise RuntimeError("Historical reports must not read mutable ChecklistResponse drafts.")


class ReportFilters:
    """Normalized filter bag — only opaque ids/codes; no invented business values."""

    def __init__(self, raw: dict[str, Any] | None = None) -> None:
        data = dict(raw or {})
        self.date_from = _parse_dt(data.get("date_from"))
        self.date_to = _parse_dt(data.get("date_to"))
        self.batch_reference = (data.get("batch_reference") or "").strip()
        self.product_id = data.get("product_id")
        self.site_id = data.get("site_id")
        self.department_id = data.get("department_id")
        self.shift_id = data.get("shift_id")
        self.status = (data.get("status") or "").strip()
        self.user_id = data.get("user_id")
        self.reviewer_id = data.get("reviewer_id")
        self.disposition = (data.get("disposition") or "").strip()
        self.limit = int(data.get("limit") or 500)
        if self.limit < 1:
            self.limit = 1
        if self.limit > 5000:
            self.limit = 5000
        self.offset = max(0, int(data.get("offset") or 0))
        raw_allowed = data.get("allowed_site_ids")
        self.allowed_site_ids: list[uuid.UUID] | None = None
        if raw_allowed is not None:
            self.allowed_site_ids = [uuid.UUID(str(x)) for x in raw_allowed]


def _apply_site_rbac(
    qs: QuerySet[Any, Any], *, site_field: str, filters: ReportFilters
) -> QuerySet[Any, Any]:
    """Constrain queryset to caller's accessible sites when not org-wide."""
    if filters.allowed_site_ids is None:
        return qs
    return qs.filter(**{f"{site_field}__in": filters.allowed_site_ids})


def _apply_task_scope(
    qs: QuerySet[ChecklistTask], filters: ReportFilters
) -> QuerySet[ChecklistTask]:
    """ChecklistTask has no site FK — site filters via assigned department site."""
    qs = _apply_site_rbac(qs, site_field=_TASK_SITE, filters=filters)
    if filters.batch_reference:
        qs = qs.filter(batch_reference__iexact=filters.batch_reference)
    if filters.site_id:
        qs = qs.filter(assigned_department__site_id=filters.site_id)
    if filters.department_id:
        qs = qs.filter(assigned_department_id=filters.department_id)
    if filters.shift_id:
        qs = qs.filter(shift_id=filters.shift_id)
    if filters.status:
        qs = qs.filter(status=filters.status)
    return qs


def query_batch_checklist(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    qs = ChecklistTask.objects.filter(organization_id=organization_id).select_related(
        "checklist_template", "shift", "assigned_department"
    )
    qs = _apply_task_scope(qs, filters)
    if filters.date_from:
        qs = qs.filter(created_at__gte=filters.date_from)
    if filters.date_to:
        qs = qs.filter(created_at__lte=filters.date_to)
    headers = [
        "task_id",
        "template_code",
        "batch_reference",
        "status",
        "department_id",
        "site_id",
        "shift_id",
        "due_at",
        "created_at",
    ]
    rows: list[dict[str, object]] = []
    for task in qs.order_by("-created_at")[filters.offset : filters.offset + filters.limit]:
        dept = task.assigned_department
        site_id = ""
        if dept is not None and dept.site_id:
            site_id = str(dept.site_id)
        rows.append(
            {
                "task_id": str(task.id),
                "template_code": task.checklist_template.code,
                "batch_reference": task.batch_reference,
                "status": task.status,
                "department_id": str(task.assigned_department_id)
                if task.assigned_department_id
                else "",
                "site_id": site_id,
                "shift_id": str(task.shift_id) if task.shift_id else "",
                "due_at": task.due_at.isoformat() if task.due_at else "",
                "created_at": task.created_at.isoformat(),
            }
        )
    return headers, rows


def query_submission_history(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    """Immutable submissions only — never ChecklistResponse drafts."""
    assert_not_draft_source(ChecklistSubmission)
    qs = ChecklistSubmission.objects.filter(
        checklist_record__organization_id=organization_id
    ).select_related(
        "checklist_record",
        "checklist_record__checklist_task",
        "checklist_record__checklist_task__assigned_department",
        "submitted_by",
    )
    qs = _apply_site_rbac(qs, site_field=_SUB_TASK_SITE, filters=filters)
    if filters.batch_reference:
        qs = qs.filter(
            checklist_record__checklist_task__batch_reference__iexact=filters.batch_reference
        )
    if filters.date_from:
        qs = qs.filter(submitted_at__gte=filters.date_from)
    if filters.date_to:
        qs = qs.filter(submitted_at__lte=filters.date_to)
    if filters.user_id:
        qs = qs.filter(submitted_by_id=filters.user_id)
    if filters.site_id:
        qs = qs.filter(**{_SUB_TASK_SITE: filters.site_id})
    if filters.shift_id:
        qs = qs.filter(checklist_record__checklist_task__shift_id=filters.shift_id)
    if filters.department_id:
        qs = qs.filter(
            checklist_record__checklist_task__assigned_department_id=filters.department_id
        )
    headers = [
        "submission_id",
        "submission_number",
        "record_id",
        "task_id",
        "batch_reference",
        "submitted_by",
        "submitted_at",
    ]
    rows: list[dict[str, object]] = []
    for sub in qs.order_by("-submitted_at")[filters.offset : filters.offset + filters.limit]:
        task = sub.checklist_record.checklist_task
        rows.append(
            {
                "submission_id": str(sub.id),
                "submission_number": sub.submission_number,
                "record_id": str(sub.checklist_record_id),
                "task_id": str(task.id),
                "batch_reference": task.batch_reference,
                "submitted_by": sub.submitted_by.employee_code,
                "submitted_at": sub.submitted_at.isoformat(),
            }
        )
    return headers, rows


def query_supervisor_reviews(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    qs = SupervisorReview.objects.filter(organization_id=organization_id).select_related(
        "checklist_submission",
        "checklist_submission__checklist_record__checklist_task",
        "reviewed_by",
    )
    qs = _apply_site_rbac(qs, site_field=_REV_TASK_SITE, filters=filters)
    if filters.date_from:
        qs = qs.filter(reviewed_at__gte=filters.date_from)
    if filters.date_to:
        qs = qs.filter(reviewed_at__lte=filters.date_to)
    if filters.reviewer_id:
        qs = qs.filter(reviewed_by_id=filters.reviewer_id)
    if filters.status:
        qs = qs.filter(decision=filters.status)
    if filters.site_id:
        qs = qs.filter(**{_REV_TASK_SITE: filters.site_id})
    if filters.batch_reference:
        qs = qs.filter(
            checklist_submission__checklist_record__checklist_task__batch_reference__iexact=(
                filters.batch_reference
            )
        )
    headers = [
        "review_id",
        "submission_id",
        "batch_reference",
        "decision",
        "reviewed_by",
        "reviewed_at",
    ]
    rows: list[dict[str, object]] = []
    for rev in qs.order_by("-reviewed_at")[filters.offset : filters.offset + filters.limit]:
        task = rev.checklist_submission.checklist_record.checklist_task
        rows.append(
            {
                "review_id": str(rev.id),
                "submission_id": str(rev.checklist_submission_id),
                "batch_reference": task.batch_reference,
                "decision": rev.decision,
                "reviewed_by": rev.reviewed_by.employee_code,
                "reviewed_at": rev.reviewed_at.isoformat(),
            }
        )
    return headers, rows


def query_qa_dispositions(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    qs = QAReview.objects.filter(organization_id=organization_id).select_related(
        "checklist_submission__checklist_record__checklist_task",
        "reviewed_by",
    )
    qs = _apply_site_rbac(qs, site_field=_REV_TASK_SITE, filters=filters)
    if filters.date_from:
        qs = qs.filter(reviewed_at__gte=filters.date_from)
    if filters.date_to:
        qs = qs.filter(reviewed_at__lte=filters.date_to)
    if filters.disposition:
        qs = qs.filter(decision=filters.disposition)
    if filters.reviewer_id:
        qs = qs.filter(reviewed_by_id=filters.reviewer_id)
    if filters.site_id:
        qs = qs.filter(**{_REV_TASK_SITE: filters.site_id})
    if filters.batch_reference:
        qs = qs.filter(
            checklist_submission__checklist_record__checklist_task__batch_reference__iexact=(
                filters.batch_reference
            )
        )
    headers = [
        "qa_review_id",
        "submission_id",
        "batch_reference",
        "decision",
        "reviewed_by",
        "reviewed_at",
    ]
    rows: list[dict[str, object]] = []
    for qa in qs.order_by("-reviewed_at")[filters.offset : filters.offset + filters.limit]:
        task = qa.checklist_submission.checklist_record.checklist_task
        rows.append(
            {
                "qa_review_id": str(qa.id),
                "submission_id": str(qa.checklist_submission_id),
                "batch_reference": task.batch_reference,
                "decision": qa.decision,
                "reviewed_by": qa.reviewed_by.employee_code,
                "reviewed_at": qa.reviewed_at.isoformat(),
            }
        )
    return headers, rows


def query_corrections(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    qs = ChecklistCorrection.objects.filter(organization_id=organization_id).select_related(
        "source_submission", "started_by"
    )
    if filters.date_from:
        qs = qs.filter(started_at__gte=filters.date_from)
    if filters.date_to:
        qs = qs.filter(started_at__lte=filters.date_to)
    if filters.status:
        qs = qs.filter(status=filters.status)
    if filters.user_id:
        qs = qs.filter(started_by_id=filters.user_id)
    headers = [
        "correction_id",
        "source_submission_id",
        "status",
        "started_by",
        "started_at",
    ]
    rows: list[dict[str, object]] = []
    for corr in qs.order_by("-started_at")[filters.offset : filters.offset + filters.limit]:
        rows.append(
            {
                "correction_id": str(corr.id),
                "source_submission_id": str(corr.source_submission_id),
                "status": corr.status,
                "started_by": corr.started_by.employee_code,
                "started_at": corr.started_at.isoformat(),
            }
        )
    return headers, rows


def query_hold_ncr_capa(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    headers = ["case_kind", "case_id", "code", "status", "batch_reference", "opened_at"]
    rows: list[dict[str, object]] = []
    ncr_qs = NonConformanceRecord.objects.filter(organization_id=organization_id)
    hold_qs = HoldCase.objects.filter(organization_id=organization_id)
    capa_qs = CorrectiveAction.objects.filter(organization_id=organization_id)
    if filters.status:
        ncr_qs = ncr_qs.filter(status=filters.status)
        hold_qs = hold_qs.filter(status=filters.status)
        capa_qs = capa_qs.filter(status=filters.status)
    if filters.batch_reference:
        ncr_qs = ncr_qs.filter(batch_reference__iexact=filters.batch_reference)
        hold_qs = hold_qs.filter(batch_reference__iexact=filters.batch_reference)
    if filters.date_from:
        ncr_qs = ncr_qs.filter(created_at__gte=filters.date_from)
        hold_qs = hold_qs.filter(opened_at__gte=filters.date_from)
        capa_qs = capa_qs.filter(created_at__gte=filters.date_from)
    if filters.date_to:
        ncr_qs = ncr_qs.filter(created_at__lte=filters.date_to)
        hold_qs = hold_qs.filter(opened_at__lte=filters.date_to)
        capa_qs = capa_qs.filter(created_at__lte=filters.date_to)
    for ncr in ncr_qs.order_by("-created_at"):
        rows.append(
            {
                "case_kind": "NCR",
                "case_id": str(ncr.id),
                "code": ncr.code,
                "status": ncr.status,
                "batch_reference": ncr.batch_reference,
                "opened_at": ncr.created_at.isoformat(),
            }
        )
    for hold in hold_qs.order_by("-opened_at"):
        rows.append(
            {
                "case_kind": "HOLD",
                "case_id": str(hold.id),
                "code": hold.code,
                "status": hold.status,
                "batch_reference": hold.batch_reference,
                "opened_at": hold.opened_at.isoformat(),
            }
        )
    for capa in capa_qs.order_by("-created_at"):
        rows.append(
            {
                "case_kind": "CAPA",
                "case_id": str(capa.id),
                "code": capa.code,
                "status": capa.status,
                "batch_reference": "",
                "opened_at": capa.created_at.isoformat(),
            }
        )
    rows = rows[filters.offset : filters.offset + filters.limit]
    return headers, rows


def query_overdue_tasks(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    now = timezone.now()
    # Orchestration statuses only — no invented COMPLETED terminal.
    qs = ChecklistTask.objects.filter(
        organization_id=organization_id,
        due_at__lt=now,
    ).exclude(status=ChecklistTaskStatus.CANCELLED)
    qs = _apply_task_scope(qs, filters)
    headers = ["task_id", "template_code", "batch_reference", "status", "due_at"]
    rows: list[dict[str, object]] = []
    for task in qs.select_related("checklist_template").order_by("due_at")[
        filters.offset : filters.offset + filters.limit
    ]:
        rows.append(
            {
                "task_id": str(task.id),
                "template_code": task.checklist_template.code,
                "batch_reference": task.batch_reference,
                "status": task.status,
                "due_at": task.due_at.isoformat() if task.due_at else "",
            }
        )
    return headers, rows


def query_audit_events(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    """
    Audit export filtered by organization_id in metadata.

    Events without matching organization_id are excluded (deny-by-default cross-org).
    """
    qs = SecurityAuditEvent.objects.all()
    if filters.date_from:
        qs = qs.filter(created_at__gte=filters.date_from)
    if filters.date_to:
        qs = qs.filter(created_at__lte=filters.date_to)
    if filters.status:
        qs = qs.filter(event_type=filters.status)
    headers = ["event_id", "event_type", "actor_id", "created_at", "organization_id"]
    rows: list[dict[str, object]] = []
    org_str = str(organization_id)
    for event in qs.order_by("-created_at")[filters.offset : filters.offset + filters.limit * 5]:
        meta = event.metadata or {}
        meta_org = str(meta.get("organization_id") or "")
        if meta_org != org_str:
            continue
        rows.append(
            {
                "event_id": str(event.id),
                "event_type": event.event_type,
                "actor_id": str(event.actor_id) if event.actor_id else "",
                "created_at": event.created_at.isoformat(),
                "organization_id": meta_org,
            }
        )
        if len(rows) >= filters.limit:
            break
    return headers, rows


def query_integration_failures(
    *, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    failure_statuses = [
        ExternalBatchEventStatus.MAPPING_FAILED,
        ExternalBatchEventStatus.APPLICABILITY_FAILED,
        ExternalBatchEventStatus.VERSION_FAILED,
        ExternalBatchEventStatus.REJECTED,
    ]
    qs = ExternalBatchEvent.objects.filter(
        organization_id=organization_id,
        status__in=failure_statuses,
    )
    qs = _apply_site_rbac(qs, site_field="site_id", filters=filters)
    if filters.date_from:
        qs = qs.filter(created_at__gte=filters.date_from)
    if filters.date_to:
        qs = qs.filter(created_at__lte=filters.date_to)
    if filters.status:
        qs = qs.filter(status=filters.status)
    if filters.site_id:
        qs = qs.filter(site_id=filters.site_id)
    if filters.product_id:
        qs = qs.filter(product_id=filters.product_id)
    if filters.batch_reference:
        qs = qs.filter(external_batch_id__iexact=filters.batch_reference)
    headers = [
        "event_id",
        "status",
        "source_system",
        "source_event_id",
        "external_batch_id",
        "created_at",
        "failure_code",
        "failure_message",
    ]
    rows: list[dict[str, object]] = []
    for ev in qs.order_by("-created_at")[filters.offset : filters.offset + filters.limit]:
        rows.append(
            {
                "event_id": str(ev.id),
                "status": ev.status,
                "source_system": ev.source_system,
                "source_event_id": ev.source_event_id,
                "external_batch_id": ev.external_batch_id,
                "created_at": ev.created_at.isoformat(),
                "failure_code": ev.failure_code,
                "failure_message": (ev.failure_message or "")[:200],
            }
        )
    return headers, rows
