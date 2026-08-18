"""Quality trend counts from stored records only — no invented targets."""

from __future__ import annotations

import statistics
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from django.utils import timezone

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.checklists.controlled_forms import CONTROLLED_FORM_CODES
from apps.customer_complaints.models import CustomerComplaintCase
from apps.nonconformance.models import NonConformanceRecord
from apps.quality.models import QAReview
from apps.rca.models import RootCauseAnalysis
from apps.recording.models import ChecklistSubmissionResponse
from apps.reports.selectors import organizations_for_reporting
from apps.reviews.models import SupervisorReviewDecision
from apps.scheduling.selectors import organizations_for_task_record


def _org_ids(actor: User) -> list[uuid.UUID]:
    ids = set(organizations_for_reporting(actor).values_list("id", flat=True))
    ids.update(organizations_for_task_record(actor).values_list("id", flat=True))
    return list(ids)


def quality_trend_counts(
    *, actor: User, date_from: date | None, date_to: date | None
) -> dict[str, int]:
    org_ids = _org_ids(actor)
    empty = {
        "cleaning_unacceptable": 0,
        "cold_room_out_of_target": 0,
        "dispatch_out_of_target": 0,
        "truck_fail": 0,
        "ncr": 0,
        "capa": 0,
        "rca": 0,
        "complaints": 0,
        "supervisor_returns": 0,
        "qa_hold": 0,
        "qa_reject": 0,
    }
    if not org_ids:
        return empty
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(date_from or date(2000, 1, 1), time.min), tz)
    finish = timezone.make_aware(datetime.combine(date_to or timezone.localdate(), time.max), tz)
    responses = ChecklistSubmissionResponse.objects.filter(
        checklist_submission__checklist_record__organization_id__in=org_ids,
        checklist_submission__submitted_at__gte=start,
        checklist_submission__submitted_at__lte=finish,
        checklist_submission__checklist_record__checklist_task__checklist_template__code__in=CONTROLLED_FORM_CODES,
    )
    empty["cleaning_unacceptable"] = responses.filter(
        checklist_submission__checklist_record__checklist_task__checklist_template__code="NMS/PPU/CL/24",
        choice_value="NO",
    ).count()
    empty["truck_fail"] = responses.filter(
        checklist_submission__checklist_record__checklist_task__checklist_template__code="NMS/PPU/CL/30",
        choice_value="NO",
    ).count()
    empty["cold_room_out_of_target"] = responses.filter(
        checklist_submission__checklist_record__checklist_task__checklist_template__code="NMS/PPU/CL/39",
        evaluation_result="FAIL",
    ).count()
    empty["dispatch_out_of_target"] = responses.filter(
        checklist_submission__checklist_record__checklist_task__checklist_template__code="NMS/PPU/CL/18",
        evaluation_result="FAIL",
    ).count()
    empty["ncr"] = NonConformanceRecord.objects.filter(
        organization_id__in=org_ids, created_at__gte=start, created_at__lte=finish
    ).count()
    empty["capa"] = CorrectiveAction.objects.filter(
        organization_id__in=org_ids, created_at__gte=start, created_at__lte=finish
    ).count()
    empty["rca"] = RootCauseAnalysis.objects.filter(
        organization_id__in=org_ids, started_at__gte=start, started_at__lte=finish
    ).count()
    empty["complaints"] = CustomerComplaintCase.objects.filter(
        organization_id__in=org_ids, created_at__gte=start, created_at__lte=finish
    ).count()
    empty["supervisor_returns"] = QAReview.objects.none().count()
    from apps.reviews.models import SupervisorReview

    empty["supervisor_returns"] = SupervisorReview.objects.filter(
        organization_id__in=org_ids,
        reviewed_at__gte=start,
        reviewed_at__lte=finish,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
    ).count()
    from apps.quality.models import QAReviewDecision

    empty["qa_hold"] = QAReview.objects.filter(
        organization_id__in=org_ids,
        reviewed_at__gte=start,
        reviewed_at__lte=finish,
        decision=QAReviewDecision.HOLD,
    ).count()
    empty["qa_reject"] = QAReview.objects.filter(
        organization_id__in=org_ids,
        reviewed_at__gte=start,
        reviewed_at__lte=finish,
        decision=QAReviewDecision.REJECT,
    ).count()
    return empty


def measurement_series_stats(
    *, actor: User, form_code: str
) -> dict[str, Decimal | int | str | None]:
    """Mean/min/max/stddev from stored numeric snapshots. No invented control limits."""
    org_ids = _org_ids(actor)
    values: list[Decimal] = []
    if org_ids:
        rows = ChecklistSubmissionResponse.objects.filter(
            checklist_submission__checklist_record__organization_id__in=org_ids,
            checklist_submission__checklist_record__checklist_task__checklist_template__code=form_code,
            number_value__isnull=False,
        ).values_list("number_value", flat=True)
        values = [Decimal(str(value)) for value in rows]
    count = len(values)
    if count == 0:
        return {
            "form_code": form_code,
            "count": 0,
            "mean": None,
            "minimum": None,
            "maximum": None,
            "stddev": None,
            "quality_component": None,
            "note": "No stored numeric measurements. Control limits are not invented.",
        }
    as_float = [float(value) for value in values]
    stddev = statistics.stdev(as_float) if count >= 2 else None
    fail_count = ChecklistSubmissionResponse.objects.filter(
        checklist_submission__checklist_record__organization_id__in=org_ids,
        checklist_submission__checklist_record__checklist_task__checklist_template__code=form_code,
        evaluation_result="FAIL",
    ).count()
    return {
        "form_code": form_code,
        "count": count,
        "mean": Decimal(str(round(statistics.mean(as_float), 4))),
        "minimum": min(values),
        "maximum": max(values),
        "stddev": Decimal(str(round(stddev, 4))) if stddev is not None else None,
        "quality_component": Decimal(str(round((count - fail_count) / count, 4))),
        "note": (
            "Quality component is good/total stored readings only. "
            "This is not full OEE. Control limits are not configured."
        ),
    }
