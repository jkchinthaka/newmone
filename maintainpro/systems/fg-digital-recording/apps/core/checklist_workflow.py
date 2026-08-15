"""Phase 10B — derived checklist operational workflow (no duplicated status fields).

Authoritative owners remain on their models. This module only *derives* a
coherent operator-facing lifecycle label from those owners.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from dataclasses import dataclass

from django.db.models import Prefetch, QuerySet

from apps.core.persistence import prefetch_related_compat
from apps.quality.models import QAReview, QAReviewDecision
from apps.recording.models import (
    ChecklistCorrection,
    ChecklistCorrectionStatus,
    ChecklistRecord,
    ChecklistRecordStatus,
    ChecklistSubmission,
)
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus


class ChecklistOperationalWorkflowState:
    """
    Derived operational workflow labels (Phase 10B).

    Not stored on Task/Record/Submission/Review/Correction/QA models.
    """

    PENDING = "PENDING"
    IN_RECORDING = "IN_RECORDING"
    AWAITING_SUPERVISOR = "AWAITING_SUPERVISOR"
    RETURNED_FOR_CORRECTION = "RETURNED_FOR_CORRECTION"
    CORRECTION_DRAFT = "CORRECTION_DRAFT"
    AWAITING_SUPERVISOR_RESUBMISSION = "AWAITING_SUPERVISOR_RESUBMISSION"
    AWAITING_QA = "AWAITING_QA"
    QA_RELEASED = "QA_RELEASED"
    QA_HELD = "QA_HELD"
    QA_REJECTED = "QA_REJECTED"
    CANCELLED = "CANCELLED"

    CHOICES: tuple[tuple[str, str], ...] = (
        (PENDING, "Pending recording"),
        (IN_RECORDING, "In recording"),
        (AWAITING_SUPERVISOR, "Awaiting Supervisor"),
        (RETURNED_FOR_CORRECTION, "Returned for correction"),
        (CORRECTION_DRAFT, "Correction draft"),
        (AWAITING_SUPERVISOR_RESUBMISSION, "Awaiting Supervisor (resubmission)"),
        (AWAITING_QA, "Awaiting QA"),
        (QA_RELEASED, "QA released (provisional)"),
        (QA_HELD, "QA held (provisional)"),
        (QA_REJECTED, "QA rejected (provisional)"),
        (CANCELLED, "Cancelled"),
    )

    ALL: frozenset[str] = frozenset(code for code, _ in CHOICES)

    # QA terminal *application* dispositions — do NOT close warehouse/ERP/dispatch.
    QA_TERMINAL: frozenset[str] = frozenset({QA_RELEASED, QA_HELD, QA_REJECTED})


STATE_LABELS: dict[str, str] = dict(ChecklistOperationalWorkflowState.CHOICES)

STATE_OWNERSHIP: dict[str, str] = {
    "ChecklistTask": "Operational task orchestration (PENDING/CANCELLED/OVERDUE/MISSED timeliness)",
    "ChecklistRecord": "Editable recording session (DRAFT/SUBMITTED)",
    "ChecklistSubmission": "Immutable submitted evidence snapshot",
    "SupervisorReview": "Immutable Supervisor decision on a submission",
    "ChecklistCorrection": "Correction workflow cycle (DRAFT/RESUBMITTED)",
    "QAReview": "Immutable QA disposition on a submission (RELEASE/HOLD/REJECT)",
}

QA_TERMINAL_SEMANTICS_NOTE = (
    "QA_RELEASED / QA_HELD / QA_REJECTED are provisional application dispositions only. "
    "They do not close warehouse, ERP, inventory, or dispatch lifecycle."
)


@dataclass(frozen=True)
class WorkflowSnapshot:
    state: str
    label: str
    task_id: uuid.UUID
    record_id: uuid.UUID | None
    latest_submission_id: uuid.UUID | None
    latest_submission_number: int | None
    supervisor_decision: str | None
    correction_status: str | None
    qa_decision: str | None
    owners: dict[str, str]
    qa_closes_downstream: bool
    inconsistencies: tuple[str, ...]

    @property
    def is_qa_terminal(self) -> bool:
        return self.state in ChecklistOperationalWorkflowState.QA_TERMINAL


def workflow_badge_class(state: str | None) -> str:
    mapping = {
        ChecklistOperationalWorkflowState.PENDING: "status-pill status-pill--neutral",
        ChecklistOperationalWorkflowState.IN_RECORDING: "status-pill status-pill--info",
        ChecklistOperationalWorkflowState.AWAITING_SUPERVISOR: "status-pill status-pill--warning",
        ChecklistOperationalWorkflowState.RETURNED_FOR_CORRECTION: (
            "status-pill status-pill--warning"
        ),
        ChecklistOperationalWorkflowState.CORRECTION_DRAFT: "status-pill status-pill--info",
        ChecklistOperationalWorkflowState.AWAITING_SUPERVISOR_RESUBMISSION: (
            "status-pill status-pill--warning"
        ),
        ChecklistOperationalWorkflowState.AWAITING_QA: "status-pill status-pill--info",
        ChecklistOperationalWorkflowState.QA_RELEASED: "status-pill status-pill--success",
        ChecklistOperationalWorkflowState.QA_HELD: "status-pill status-pill--warning",
        ChecklistOperationalWorkflowState.QA_REJECTED: "status-pill status-pill--danger",
        ChecklistOperationalWorkflowState.CANCELLED: "status-pill status-pill--muted",
    }
    return mapping.get(state or "", "status-pill status-pill--muted")


def _latest_submission(record: ChecklistRecord | None) -> ChecklistSubmission | None:
    if record is None:
        return None
    # Prefer prefetched cache when present.
    prefetched = getattr(record, "_prefetched_objects_cache", {})
    if "submissions" in prefetched:
        rows = list(record.submissions.all())
        if not rows:
            return None
        return max(rows, key=lambda s: (s.submission_number, s.submitted_at))
    return (
        ChecklistSubmission.objects.filter(checklist_record_id=record.id)
        .order_by("-submission_number", "-submitted_at")
        .first()
    )


def _active_correction_draft(record: ChecklistRecord | None) -> ChecklistCorrection | None:
    if record is None:
        return None
    prefetched = getattr(record, "_prefetched_objects_cache", {})
    if "corrections" in prefetched:
        for row in record.corrections.all():
            if row.status == ChecklistCorrectionStatus.DRAFT:
                return row
        return None
    return (
        ChecklistCorrection.objects.filter(
            checklist_record_id=record.id,
            status=ChecklistCorrectionStatus.DRAFT,
        )
        .order_by("-started_at")
        .first()
    )


def detect_workflow_inconsistencies(
    *,
    task: ChecklistTask,
    record: ChecklistRecord | None,
    latest: ChecklistSubmission | None,
    supervisor: SupervisorReview | None,
    correction_draft: ChecklistCorrection | None,
    qa: QAReview | None,
) -> tuple[str, ...]:
    """Detect impossible combinations without inventing repair policy."""
    issues: list[str] = []
    if task.status == ChecklistTaskStatus.CANCELLED and record is not None:
        if record.status == ChecklistRecordStatus.DRAFT:
            issues.append("CANCELLED_TASK_WITH_DRAFT_RECORD")
    if record is not None and record.status == ChecklistRecordStatus.DRAFT and latest is not None:
        issues.append("DRAFT_RECORD_WITH_SUBMISSION")
    if record is not None and record.status == ChecklistRecordStatus.SUBMITTED and latest is None:
        issues.append("SUBMITTED_RECORD_WITHOUT_SUBMISSION")
    if correction_draft is not None:
        if record is None or record.status != ChecklistRecordStatus.SUBMITTED:
            issues.append("CORRECTION_DRAFT_WITHOUT_SUBMITTED_RECORD")
        if (
            supervisor is None
            or supervisor.decision != SupervisorReviewDecision.RETURNED_FOR_CORRECTION
        ):
            # Correction must start from RETURNED on its source; if latest already moved on,
            # draft correction on non-latest source is still possible historically — flag when
            # latest supervisor is APPROVED while a draft correction exists.
            if supervisor is not None and supervisor.decision == SupervisorReviewDecision.APPROVED:
                issues.append("CORRECTION_DRAFT_WITH_LATEST_APPROVED")
        if qa is not None:
            issues.append("CORRECTION_DRAFT_WITH_QA_ON_LATEST")
    if qa is not None and supervisor is not None:
        if supervisor.decision != SupervisorReviewDecision.APPROVED:
            issues.append("QA_WITHOUT_APPROVED_SUPERVISOR_ON_LATEST")
    if qa is not None and latest is not None and qa.checklist_submission_id != latest.id:
        issues.append("QA_NOT_ON_LATEST_SUBMISSION")
    if (
        supervisor is not None
        and supervisor.decision == SupervisorReviewDecision.RETURNED_FOR_CORRECTION
        and qa is not None
        and latest is not None
        and qa.checklist_submission_id == latest.id
    ):
        issues.append("QA_ON_RETURNED_LATEST_SUBMISSION")
    return tuple(issues)


def derive_checklist_workflow(
    task: ChecklistTask,
    *,
    record: ChecklistRecord | None = None,
    latest_submission: ChecklistSubmission | None = None,
    supervisor_review: SupervisorReview | None = None,
    correction_draft: ChecklistCorrection | None = None,
    qa_review: QAReview | None = None,
) -> WorkflowSnapshot:
    """
    Derive operational workflow state from authoritative owners.

    Does not write status onto any model. QA terminals never imply ERP/warehouse close.
    """
    if record is None:
        # Prefer explicit lookup to avoid stale reverse-OneToOne cache after create.
        record = ChecklistRecord.objects.filter(checklist_task_id=task.id).first()

    latest = latest_submission if latest_submission is not None else _latest_submission(record)
    correction = (
        correction_draft if correction_draft is not None else _active_correction_draft(record)
    )

    supervisor = supervisor_review
    if supervisor is None and latest is not None:
        supervisor = getattr(latest, "supervisor_review", None)
        if supervisor is None:
            try:
                supervisor = latest.supervisor_review
            except SupervisorReview.DoesNotExist:
                supervisor = None

    qa = qa_review
    if qa is None and latest is not None:
        try:
            qa = latest.qa_review
        except QAReview.DoesNotExist:
            qa = None

    inconsistencies = detect_workflow_inconsistencies(
        task=task,
        record=record,
        latest=latest,
        supervisor=supervisor,
        correction_draft=correction,
        qa=qa,
    )

    # Derive — priority order (QA terminals before correction; no duplicated stored status).
    if task.status in {ChecklistTaskStatus.CANCELLED, ChecklistTaskStatus.MISSED}:
        state = ChecklistOperationalWorkflowState.CANCELLED
    elif record is None:
        state = ChecklistOperationalWorkflowState.PENDING
    elif record.status == ChecklistRecordStatus.DRAFT:
        state = ChecklistOperationalWorkflowState.IN_RECORDING
    elif qa is not None:
        if qa.decision == QAReviewDecision.RELEASE:
            state = ChecklistOperationalWorkflowState.QA_RELEASED
        elif qa.decision == QAReviewDecision.HOLD:
            state = ChecklistOperationalWorkflowState.QA_HELD
        elif qa.decision == QAReviewDecision.REJECT:
            state = ChecklistOperationalWorkflowState.QA_REJECTED
        else:
            state = ChecklistOperationalWorkflowState.AWAITING_QA
    elif supervisor is not None:
        if supervisor.decision == SupervisorReviewDecision.APPROVED:
            state = ChecklistOperationalWorkflowState.AWAITING_QA
        elif supervisor.decision == SupervisorReviewDecision.RETURNED_FOR_CORRECTION:
            if correction is not None:
                state = ChecklistOperationalWorkflowState.CORRECTION_DRAFT
            else:
                state = ChecklistOperationalWorkflowState.RETURNED_FOR_CORRECTION
        else:
            state = ChecklistOperationalWorkflowState.AWAITING_SUPERVISOR
    elif latest is not None and int(latest.submission_number) > 1:
        state = ChecklistOperationalWorkflowState.AWAITING_SUPERVISOR_RESUBMISSION
    elif latest is not None:
        state = ChecklistOperationalWorkflowState.AWAITING_SUPERVISOR
    else:
        # SUBMITTED without submission is inconsistent; surface as IN_RECORDING-safe fallback
        state = ChecklistOperationalWorkflowState.IN_RECORDING

    return WorkflowSnapshot(
        state=state,
        label=STATE_LABELS.get(state, state),
        task_id=task.id,
        record_id=record.id if record is not None else None,
        latest_submission_id=latest.id if latest is not None else None,
        latest_submission_number=int(latest.submission_number) if latest is not None else None,
        supervisor_decision=supervisor.decision if supervisor is not None else None,
        correction_status=correction.status if correction is not None else None,
        qa_decision=qa.decision if qa is not None else None,
        owners=dict(STATE_OWNERSHIP),
        qa_closes_downstream=False,
        inconsistencies=inconsistencies,
    )


def prefetch_workflow_graph(qs: QuerySet[ChecklistTask]) -> QuerySet[ChecklistTask]:
    """Prefetch record/submission/review/correction/QA for derived workflow reads."""
    return prefetch_related_compat(
        qs.select_related(
            "organization",
            "checklist_template",
            "checklist_version",
            "checklist_record",
        ),
        Prefetch(
            "checklist_record__submissions",
            queryset=ChecklistSubmission.objects.select_related(
                "supervisor_review",
                "qa_review",
            ).order_by("-submission_number", "-submitted_at"),
        ),
        Prefetch(
            "checklist_record__corrections",
            queryset=ChecklistCorrection.objects.order_by("-started_at"),
        ),
    )


def filter_tasks_by_workflow_state(
    tasks: Iterable[ChecklistTask],
    *,
    workflow_state: str,
) -> list[ChecklistTask]:
    """Exact Python-side filter using derive (authoritative; no duplicated status column)."""
    wanted = (workflow_state or "").strip().upper()
    if wanted not in ChecklistOperationalWorkflowState.ALL:
        return []
    matched: list[ChecklistTask] = []
    for task in tasks:
        snap = derive_checklist_workflow(task)
        if snap.state == wanted:
            # Attach for template convenience (non-persisted).
            task.workflow_snapshot = snap  # type: ignore[attr-defined]
            matched.append(task)
    return matched


def attach_workflow_snapshots(tasks: Iterable[ChecklistTask]) -> list[ChecklistTask]:
    rows = list(tasks)
    for task in rows:
        task.workflow_snapshot = derive_checklist_workflow(task)  # type: ignore[attr-defined]
    return rows


def workflow_prefilter_queryset(
    qs: QuerySet[ChecklistTask],
    *,
    workflow_state: str,
) -> QuerySet[ChecklistTask]:
    """
    Narrow candidates before exact derive. Never invents a stored workflow column.
    """
    state = (workflow_state or "").strip().upper()
    workflow_states = ChecklistOperationalWorkflowState
    if state not in workflow_states.ALL:
        return qs.none()
    if state == workflow_states.CANCELLED:
        return qs.filter(status__in=[ChecklistTaskStatus.CANCELLED, ChecklistTaskStatus.MISSED])
    qs = qs.exclude(status__in=[ChecklistTaskStatus.CANCELLED, ChecklistTaskStatus.MISSED])
    if state == workflow_states.PENDING:
        return qs.filter(checklist_record__isnull=True)
    if state == workflow_states.IN_RECORDING:
        return qs.filter(checklist_record__status=ChecklistRecordStatus.DRAFT)
    # Remaining states require SUBMITTED record.
    qs = qs.filter(checklist_record__status=ChecklistRecordStatus.SUBMITTED)
    if state == workflow_states.CORRECTION_DRAFT:
        return qs.filter(
            checklist_record__corrections__status=ChecklistCorrectionStatus.DRAFT
        ).distinct()
    if state in workflow_states.QA_TERMINAL or state == workflow_states.AWAITING_QA:
        # Broad: has APPROVED supervisor on some submission; exact derive finalizes.
        return qs.filter(
            checklist_record__submissions__supervisor_review__decision=SupervisorReviewDecision.APPROVED
        ).distinct()
    if state in {
        workflow_states.AWAITING_SUPERVISOR,
        workflow_states.AWAITING_SUPERVISOR_RESUBMISSION,
        workflow_states.RETURNED_FOR_CORRECTION,
    }:
        return qs
    return qs


# Compatibility aliases (Phase 10B facade / drafting names).
ChecklistWorkflowState = ChecklistOperationalWorkflowState
WorkflowFilter = str


def filter_tasks_by_workflow(
    tasks: Iterable[ChecklistTask],
    *,
    workflow_state: str,
) -> list[ChecklistTask]:
    return filter_tasks_by_workflow_state(tasks, workflow_state=workflow_state)


def annotate_workflow_display(tasks: Iterable[ChecklistTask]) -> list[ChecklistTask]:
    return attach_workflow_snapshots(tasks)


def workflow_prefetch_queryset(qs: QuerySet[ChecklistTask]) -> QuerySet[ChecklistTask]:
    return prefetch_workflow_graph(qs)


def workflow_context_for_task(task: ChecklistTask) -> dict[str, object]:
    snap = derive_checklist_workflow(task)
    return {
        "workflow": snap,
        "workflow_state": snap.state,
        "workflow_label": snap.label,
        "qa_closes_downstream": False,
        "qa_terminal_note": QA_TERMINAL_SEMANTICS_NOTE if snap.is_qa_terminal else "",
        "state_ownership": STATE_OWNERSHIP,
    }
