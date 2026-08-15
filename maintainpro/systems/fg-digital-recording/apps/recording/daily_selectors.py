"""Selectors for Daily Records queues, print packs, and history."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any

from django.db.models import Prefetch, QuerySet

from apps.accounts.models import User
from apps.checklists.controlled_forms import CONTROLLED_FORM_CODES, get_controlled_form
from apps.core.persistence import prefetch_related_compat
from apps.quality.models import QAReview
from apps.recording.models import (
    ChecklistRecord,
    ChecklistRecordStatus,
    ChecklistResponse,
    ChecklistSubmission,
    ChecklistSubmissionResponse,
)
from apps.recording.selectors import (
    actor_can_access_recording_module,
    load_record_editor_context,
    load_submitted_record_context,
)
from apps.recording.snapshot_display import render_snapshot_sections
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.scheduling.selectors import organizations_for_task_record

PAGE_SIZE = 25
_ISO_DATE = re.compile(r"(20\d{2}-\d{2}-\d{2})")


@dataclass(frozen=True, slots=True)
class DailyQueueCounts:
    today: int
    pending: int
    completed: int
    needs_correction: int
    awaiting_check: int
    awaiting_verification: int


def _org_ids(actor: User) -> list[uuid.UUID]:
    return list(organizations_for_task_record(actor).values_list("id", flat=True))


def date_from_batch(batch_reference: str) -> date | None:
    match = _ISO_DATE.search(batch_reference or "")
    if match is None:
        return None
    return date.fromisoformat(match.group(1))


def controlled_records_qs(actor: User) -> QuerySet[ChecklistRecord]:
    if not actor_can_access_recording_module(actor):
        return ChecklistRecord.objects.none()
    org_ids = _org_ids(actor)
    if not org_ids:
        return ChecklistRecord.objects.none()
    return ChecklistRecord.objects.filter(
        organization_id__in=org_ids,
        checklist_task__checklist_template__code__in=CONTROLLED_FORM_CODES,
    ).select_related(
        "checklist_task__checklist_template",
        "checklist_task__checklist_version",
        "checklist_task__organization",
        "started_by",
    )


def _with_latest_submission(qs: QuerySet[ChecklistRecord]) -> QuerySet[ChecklistRecord]:
    return prefetch_related_compat(
        qs,
        Prefetch(
            "submissions",
            queryset=ChecklistSubmission.objects.select_related(
                "submitted_by", "supervisor_review", "qa_review"
            ).order_by("-submission_number"),
        ),
    )


def classify_record_bucket(record: ChecklistRecord) -> str:
    if record.status == ChecklistRecordStatus.DRAFT:
        return "pending"
    submission = record.submissions.first() if hasattr(record, "submissions") else None
    if submission is None:
        return "pending"
    review = getattr(submission, "supervisor_review", None)
    if review is None:
        return "awaiting_check"
    if review.decision == SupervisorReviewDecision.RETURNED_FOR_CORRECTION:
        return "needs_correction"
    qa = getattr(submission, "qa_review", None)
    if qa is None:
        return "awaiting_verification"
    return "completed"


def daily_queue_counts(*, actor: User, record_date: date) -> DailyQueueCounts:
    qs = _with_latest_submission(
        controlled_records_qs(actor).filter(
            checklist_task__batch_reference__contains=record_date.isoformat()
        )
    )
    tallies = {
        "pending": 0,
        "completed": 0,
        "needs_correction": 0,
        "awaiting_check": 0,
        "awaiting_verification": 0,
    }
    today = 0
    for record in qs:
        today += 1
        tallies[classify_record_bucket(record)] += 1
    return DailyQueueCounts(today=today, **tallies)


def list_today_records(*, actor: User, record_date: date) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    qs = _with_latest_submission(
        controlled_records_qs(actor).filter(
            checklist_task__batch_reference__contains=record_date.isoformat()
        )
    )
    for record in qs:
        rows.append(
            {
                "record": record,
                "task": record.checklist_task,
                "spec": get_controlled_form(record.checklist_task.checklist_template.code),
                "bucket": classify_record_bucket(record),
                "submission": record.submissions.first(),
            }
        )
    return rows


def print_record_context(*, actor: User, record_id: uuid.UUID) -> dict[str, Any] | None:
    submitted = load_submitted_record_context(actor, record_id)
    if submitted is not None:
        record = submitted["record"]
        spec = get_controlled_form(record.checklist_task.checklist_template.code)
        supervisor = (
            SupervisorReview.objects.filter(checklist_submission=submitted["submission"])
            .select_related("reviewed_by")
            .first()
        )
        qa = (
            QAReview.objects.filter(checklist_submission=submitted["submission"])
            .select_related("reviewed_by")
            .first()
        )
        return {
            **submitted,
            "spec": spec,
            "supervisor": supervisor,
            "qa": qa,
            "is_draft": False,
        }
    record = controlled_records_qs(actor).filter(pk=record_id).first()
    if record is None:
        return None
    ctx = load_record_editor_context(actor, record.id)
    if ctx is None:
        return None
    return {
        "record": record,
        "task": record.checklist_task,
        "submission": None,
        "sections": ctx["sections"],
        "snapshot_responses": ctx["responses"],
        "rendered_sections": render_snapshot_sections(ctx["sections"], ctx["responses"]),
        "spec": get_controlled_form(record.checklist_task.checklist_template.code),
        "supervisor": None,
        "qa": None,
        "is_draft": True,
    }


def monthly_pack_context(*, actor: User, form_code: str, year: int, month: int) -> dict[str, Any]:
    spec = get_controlled_form(form_code)
    if spec is None:
        return {"spec": None, "days": [], "rows": [], "submissions": [], "by_day": {}}
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    start = date(year, month, 1)
    org_ids = _org_ids(actor)
    submissions = prefetch_related_compat(
        ChecklistSubmission.objects.filter(
            checklist_record__organization_id__in=org_ids,
            checklist_record__checklist_task__checklist_template__code=spec.code,
        ).select_related(
            "submitted_by",
            "checklist_record__checklist_task__checklist_template",
            "checklist_record__started_by",
            "supervisor_review__reviewed_by",
            "qa_review__reviewed_by",
        ),
        Prefetch(
            "responses",
            queryset=ChecklistSubmissionResponse.objects.select_related(
                "checklist_item", "selected_option"
            ),
        ),
    ).order_by("checklist_record__checklist_task__batch_reference", "submitted_at")
    days: list[date] = []
    cursor = start
    while cursor < end:
        days.append(cursor)
        cursor = date.fromordinal(cursor.toordinal() + 1)
    item_codes: list[tuple[str, str]] = []
    seen: set[str] = set()
    cells: dict[tuple[str, date], str] = {}
    by_day: dict[date, ChecklistSubmission] = {}
    in_month: list[ChecklistSubmission] = []
    for submission in submissions:
        day = date_from_batch(submission.checklist_record.checklist_task.batch_reference)
        if day is None or day < start or day >= end:
            continue
        in_month.append(submission)
        by_day[day] = submission
        for response in submission.responses.all():
            item = response.checklist_item
            if item.code not in seen:
                seen.add(item.code)
                item_codes.append((item.code, item.label))
            cells[(item.code, day)] = display_response(response)
    rows = [
        {
            "code": code,
            "label": label,
            "values": [cells.get((code, day), "") for day in days],
        }
        for code, label in item_codes
    ]
    return {
        "spec": spec,
        "days": days,
        "rows": rows,
        "submissions": in_month,
        "by_day": by_day,
        "month_label": f"{year:04d}-{month:02d}",
    }


def display_response(response: ChecklistSubmissionResponse | ChecklistResponse) -> str:
    if getattr(response, "number_value", None) is not None:
        value = response.number_value
        text = format(value.normalize(), "f") if value is not None else ""
        return text.rstrip("0").rstrip(".") if "." in text else text
    if getattr(response, "choice_value", ""):
        choice = response.choice_value
        if choice == "YES":
            return "YES / Acceptable / PASS"
        if choice == "NO":
            return "NO / Unacceptable / FAIL"
        return str(choice)
    if getattr(response, "text_value", ""):
        return str(response.text_value)
    option = getattr(response, "selected_option", None)
    if option is not None:
        return str(option.label)
    return ""


def history_queryset(
    *,
    actor: User,
    date_from: date | None = None,
    date_to: date | None = None,
    form_code: str = "",
    batch: str = "",
    vehicle: str = "",
    gin: str = "",
    cold_room: str = "",
    status: str = "",
    recorder: str = "",
) -> QuerySet[ChecklistRecord]:
    qs = controlled_records_qs(actor)
    if form_code:
        qs = qs.filter(checklist_task__checklist_template__code=form_code)
    if batch:
        qs = qs.filter(checklist_task__batch_reference__icontains=batch)
    if vehicle:
        qs = qs.filter(checklist_task__batch_reference__icontains=vehicle)
    if gin:
        qs = qs.filter(checklist_task__batch_reference__icontains=gin)
    if cold_room:
        qs = qs.filter(checklist_task__batch_reference__icontains=cold_room)
    if status == "DRAFT":
        qs = qs.filter(status=ChecklistRecordStatus.DRAFT)
    elif status == "SUBMITTED":
        qs = qs.filter(status=ChecklistRecordStatus.SUBMITTED)
    if recorder:
        qs = qs.filter(started_by__employee_code__icontains=recorder)
    if date_from is not None or date_to is not None:
        start = date_from or date.min
        finish = date_to or date.max
        matching_ids = [
            record.id
            for record in qs.only("id", "checklist_task__batch_reference")
            if (parsed := date_from_batch(record.checklist_task.batch_reference)) is not None
            and start <= parsed <= finish
        ]
        qs = controlled_records_qs(actor).filter(pk__in=matching_ids)
        if form_code:
            qs = qs.filter(checklist_task__checklist_template__code=form_code)
    return qs.order_by("-updated_at")
