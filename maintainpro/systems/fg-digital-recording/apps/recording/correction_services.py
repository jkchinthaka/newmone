"""Checklist correction / resubmission services (Phase 09B)."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import IntegrityError, models
from django.utils import timezone

from apps.access_control.services import require_permission
from apps.accounts.models import User
from apps.checklists.models import ChecklistItem, ChecklistItemKind
from apps.checklists.compat_queries import load_version_items_for_recording
from apps.core.persistence import atomic, lock_queryset
from apps.recording.models import (
    ChecklistCorrection,
    ChecklistCorrectionStatus,
    ChecklistRecord,
    ChecklistRecordStatus,
    ChecklistResponse,
    ChecklistSubmission,
    ChecklistSubmissionResponse,
)
from apps.recording.repeating import responses_by_key
from apps.recording.services import (
    _assert_task_recordable,
    _record_metadata,
    _require_authenticated_actor,
    _response_is_structurally_valid,
    validate_record_ready_for_submission,
)
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.scheduling.models import ChecklistTaskStatus
from apps.scheduling.services import RECORD_CHECKLIST_TASK, task_authorization_scope
from apps.security_audit.services import record_event

# Re-export for callers that import from correction_services historically.
__all__ = [
    "get_active_correction_for_record",
    "get_latest_submission_for_record",
    "resubmit_checklist_correction",
    "start_checklist_correction",
    "transition_correction_to_resubmitted",
]


def get_latest_submission_for_record(record: ChecklistRecord) -> ChecklistSubmission | None:
    return (
        ChecklistSubmission.objects.filter(checklist_record_id=record.id)
        .order_by("-submission_number")
        .first()
    )


def get_active_correction_for_record(record: ChecklistRecord) -> ChecklistCorrection | None:
    return (
        ChecklistCorrection.objects.select_related(
            "source_submission",
            "resulting_submission",
            "started_by",
        )
        .filter(
            checklist_record_id=record.id,
            status=ChecklistCorrectionStatus.DRAFT,
        )
        .first()
    )


def _correction_metadata(
    correction: ChecklistCorrection,
    *,
    resulting_submission: ChecklistSubmission | None = None,
) -> dict[str, Any]:
    record = correction.checklist_record
    task = record.checklist_task
    source = correction.source_submission
    metadata: dict[str, Any] = {
        "checklist_correction_id": str(correction.id),
        "checklist_record_id": str(record.id),
        "source_submission_id": str(source.id),
        "source_submission_number": source.submission_number,
        "checklist_task_id": str(task.id),
        "organization_id": str(correction.organization_id),
        "checklist_template_id": str(task.checklist_template_id),
        "checklist_version_id": str(task.checklist_version_id),
        "batch_reference": task.batch_reference,
    }
    result = resulting_submission or correction.resulting_submission
    if result is not None:
        metadata["resulting_submission_id"] = str(result.id)
        metadata["resulting_submission_number"] = result.submission_number
    return metadata


def transition_correction_to_resubmitted(
    correction: ChecklistCorrection,
    *,
    resulting_submission: ChecklistSubmission,
) -> ChecklistCorrection:
    """Centralized DRAFT → RESUBMITTED. Reverse is not allowed in Phase 09B."""
    if correction.status == ChecklistCorrectionStatus.RESUBMITTED:
        return correction
    if correction.status != ChecklistCorrectionStatus.DRAFT:
        raise ValidationError(
            {
                "status": (
                    f"Cannot transition checklist correction from {correction.status} "
                    "to RESUBMITTED."
                )
            }
        )
    correction.status = ChecklistCorrectionStatus.RESUBMITTED
    correction.resulting_submission = resulting_submission
    correction.completed_at = timezone.now()
    correction.save(
        update_fields=[
            "status",
            "resulting_submission",
            "completed_at",
            "updated_at",
        ]
    )
    return correction


def _assert_task_not_cancelled(task: Any) -> None:
    if task.status == ChecklistTaskStatus.CANCELLED:
        raise ValidationError({"task": "Cancelled checklist tasks cannot be corrected."})
    _assert_task_recordable(task)


def _get_supervisor_review_for_submission(
    submission: ChecklistSubmission,
) -> SupervisorReview | None:
    try:
        return submission.supervisor_review
    except ObjectDoesNotExist:
        return SupervisorReview.objects.filter(checklist_submission_id=submission.id).first()


def _assert_source_eligible_for_correction(
    *,
    record: ChecklistRecord,
    source_submission: ChecklistSubmission,
) -> SupervisorReview:
    if record.status != ChecklistRecordStatus.SUBMITTED:
        raise ValidationError({"record": "Corrections require a SUBMITTED checklist record."})
    if source_submission.checklist_record_id != record.id:
        raise ValidationError(
            {"source_submission": "Source submission must belong to the checklist record."}
        )

    latest = get_latest_submission_for_record(record)
    if latest is None or latest.id != source_submission.id:
        raise ValidationError(
            {
                "source_submission": (
                    "Corrections may start only from the latest ChecklistSubmission for the record."
                )
            }
        )

    review = _get_supervisor_review_for_submission(source_submission)
    if review is None:
        raise ValidationError(
            {
                "source_submission": (
                    "Corrections require an immutable Supervisor review on the source submission."
                )
            }
        )
    if review.decision != SupervisorReviewDecision.RETURNED_FOR_CORRECTION:
        raise ValidationError(
            {
                "source_submission": (
                    "Corrections may start only when Supervisor decision is "
                    "RETURNED_FOR_CORRECTION. APPROVED and other decisions are not eligible."
                )
            }
        )
    return review


def _clone_working_responses_from_snapshot(
    *,
    record: ChecklistRecord,
    source_submission: ChecklistSubmission,
) -> int:
    """
    Rebuild ChecklistResponse working state from immutable source snapshot.

    Called only on initial correction creation — never on idempotent re-start.
    """
    ChecklistResponse.objects.filter(checklist_record_id=record.id).delete()
    snapshot_rows = list(
        ChecklistSubmissionResponse.objects.filter(
            checklist_submission_id=source_submission.id
        ).select_related("checklist_item", "selected_option")
    )
    working_rows: list[ChecklistResponse] = []
    for snap in snapshot_rows:
        working_rows.append(
            ChecklistResponse(
                checklist_record=record,
                checklist_item_id=snap.checklist_item_id,
                sample_index=snap.sample_index,
                choice_value=snap.choice_value,
                number_value=snap.number_value,
                text_value=snap.text_value,
                selected_option_id=snap.selected_option_id,
                calculation_context=snap.calculation_context,
                condition_context=snap.condition_context,
                evaluation_result=snap.evaluation_result,
                evaluation_context=snap.evaluation_context,
            )
        )
    if working_rows:
        ChecklistResponse.objects.bulk_create(working_rows)
    return len(working_rows)


def start_checklist_correction(
    *,
    actor: User | None,
    source_submission_id: uuid.UUID,
) -> ChecklistCorrection:
    """
    Start (or return existing) correction cycle for a RETURNED latest submission.

    Idempotent: duplicate Start returns existing correction without resetting
    already-edited working responses.
    Ownership policy (original submitter only) remains EVIDENCE REQUIRED —
    any authorized recorder in Organization scope may start correction.
    """
    user = _require_authenticated_actor(actor)

    try:
        with atomic():
            source = (
                lock_queryset(
                    ChecklistSubmission.objects.select_related(
                        "checklist_record",
                        "checklist_record__organization",
                        "checklist_record__checklist_task",
                        "checklist_record__checklist_task__checklist_template",
                        "checklist_record__checklist_task__checklist_version",
                        "submitted_by",
                    )
                )
                .filter(pk=source_submission_id)
                .first()
            )
            if source is None:
                raise ValidationError({"source_submission": "Checklist submission not found."})

            record = (
                lock_queryset(
                    ChecklistRecord.objects.select_related(
                        "organization",
                        "checklist_task",
                        "checklist_task__checklist_template",
                        "checklist_task__checklist_version",
                    )
                )
                .filter(pk=source.checklist_record_id)
                .first()
            )
            if record is None:
                raise ValidationError({"record": "Checklist record not found."})

            task = record.checklist_task
            require_permission(user, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(task))
            if record.organization_id != task.organization_id:
                raise ValidationError({"organization": "Record organization mismatch."})
            _assert_task_not_cancelled(task)
            _assert_source_eligible_for_correction(record=record, source_submission=source)

            existing = lock_queryset(
                ChecklistCorrection.objects.filter(source_submission_id=source.id)
            ).first()
            if existing is not None:
                return existing

            _clone_working_responses_from_snapshot(record=record, source_submission=source)

            correction = ChecklistCorrection(
                organization_id=record.organization_id,
                checklist_record=record,
                source_submission=source,
                status=ChecklistCorrectionStatus.DRAFT,
                started_by=user,
            )
            correction.full_clean()
            correction.save()

            record_event(
                event_type="CHECKLIST_CORRECTION_STARTED",
                actor=user,
                metadata=_correction_metadata(correction),
            )
    except IntegrityError:
        raced = (
            ChecklistCorrection.objects.select_related(
                "organization",
                "checklist_record",
                "source_submission",
                "started_by",
            )
            .filter(source_submission_id=source_submission_id)
            .first()
        )
        if raced is not None:
            return raced
        raise ValidationError({"correction": "Unable to start checklist correction."}) from None

    return ChecklistCorrection.objects.select_related(
        "organization",
        "checklist_record",
        "checklist_record__checklist_task",
        "source_submission",
        "resulting_submission",
        "started_by",
    ).get(pk=correction.id)


def assert_record_editable_for_actor(record: ChecklistRecord) -> ChecklistCorrection | None:
    """
    Allow edits when record is DRAFT, or SUBMITTED with an active eligible correction.

    Returns active correction when editing via correction workspace, else None.
    """
    if record.status == ChecklistRecordStatus.DRAFT:
        return None

    if record.status != ChecklistRecordStatus.SUBMITTED:
        raise ValidationError(
            {
                "status": (
                    "Submitted checklist records cannot be edited without an active "
                    "correction cycle."
                )
            }
        )

    correction = get_active_correction_for_record(record)
    if correction is None:
        raise ValidationError(
            {
                "status": (
                    "Submitted checklist records cannot be edited. "
                    "Start an explicit correction cycle after RETURNED_FOR_CORRECTION."
                )
            }
        )

    latest = get_latest_submission_for_record(record)
    if latest is None or latest.id != correction.source_submission_id:
        raise ValidationError(
            {"correction": ("Active correction source is no longer the latest submission.")}
        )
    _assert_source_eligible_for_correction(
        record=record, source_submission=correction.source_submission
    )
    return correction


def _measurement_context_for_response(
    response: ChecklistResponse, item: ChecklistItem
) -> dict[str, object] | None:
    ctx = getattr(response, "measurement_context", None)
    if isinstance(ctx, dict):
        return ctx
    if getattr(response, "number_value", None) is None:
        return None
    from apps.checklists.measurement import build_measurement_context

    return build_measurement_context(
        value=response.number_value,
        unit=getattr(item, "unit", "") or "",
        decimal_precision=getattr(item, "decimal_precision", None),
        rounding_mode=getattr(item, "rounding_mode", "") or "",
        rounding_applied=False,
        minimum_value=getattr(item, "minimum_value", None),
        maximum_value=getattr(item, "maximum_value", None),
        min_inclusive=bool(getattr(item, "min_inclusive", True)),
        max_inclusive=bool(getattr(item, "max_inclusive", True)),
    )


def _control_point_context_for_item(item: ChecklistItem) -> dict[str, object]:
    """Frozen definition metadata (06L + optional HACCP/sampling contexts)."""
    from apps.checklists.control_point import build_control_point_snapshot

    snap = build_control_point_snapshot(
        control_point_class=getattr(item, "control_point_class", "NONE") or "NONE",
        criticality=getattr(item, "criticality", "") or "",
    )
    from apps.haccp.snapshots import snapshot_for_checklist_item

    haccp = snapshot_for_checklist_item(item.id)
    if haccp:
        snap["haccp_context"] = haccp
    from apps.sampling.snapshots import snapshot_for_item_or_parent

    sampling = snapshot_for_item_or_parent(item)
    if sampling:
        snap["sampling_context"] = sampling
    from apps.sanitation.snapshots import snapshot_for_checklist_template

    template_id = getattr(
        getattr(getattr(item, "section", None), "version", None), "template_id", None
    )
    if template_id:
        sanitation = snapshot_for_checklist_template(template_id)
        if sanitation:
            snap["sanitation_context"] = sanitation
    from apps.packaging.snapshots import snapshot_for_checklist_item as artwork_snapshot

    packaging = artwork_snapshot(item.id)
    if packaging:
        snap["packaging_artwork_context"] = packaging
    return snap


def resubmit_checklist_correction(
    *,
    actor: User | None,
    correction_id: uuid.UUID,
) -> ChecklistSubmission:
    """
    Resubmit an active correction as immutable Submission N+1 (full-state snapshot).

    Idempotent when already RESUBMITTED. Does not mutate source submission/review.
    ChecklistRecord remains SUBMITTED. ChecklistTask remains PENDING.
    """
    user = _require_authenticated_actor(actor)

    try:
        with atomic():
            correction = (
                lock_queryset(
                    ChecklistCorrection.objects.select_related(
                        "organization",
                        "checklist_record",
                        "checklist_record__organization",
                        "checklist_record__checklist_task",
                        "checklist_record__checklist_task__checklist_template",
                        "checklist_record__checklist_task__checklist_version",
                        "source_submission",
                        "started_by",
                    )
                )
                .filter(pk=correction_id)
                .first()
            )
            if correction is None:
                raise ValidationError({"correction": "Checklist correction not found."})

            # Load nullable OneToOne separately — PostgreSQL rejects FOR UPDATE on
            # nullable outer joins (same pattern as SupervisorReview in Phase 09A).
            resulting_loaded: ChecklistSubmission | None = None
            if correction.resulting_submission_id is not None:
                resulting_loaded = ChecklistSubmission.objects.filter(
                    pk=correction.resulting_submission_id
                ).first()

            record = (
                lock_queryset(
                    ChecklistRecord.objects.select_related(
                        "organization",
                        "checklist_task",
                        "checklist_task__checklist_template",
                        "checklist_task__checklist_version",
                    )
                )
                .filter(pk=correction.checklist_record_id)
                .first()
            )
            if record is None:
                raise ValidationError({"record": "Checklist record not found."})

            task = record.checklist_task
            require_permission(user, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(task))
            if record.organization_id != task.organization_id:
                raise ValidationError({"organization": "Record organization mismatch."})
            _assert_task_not_cancelled(task)

            if correction.status == ChecklistCorrectionStatus.RESUBMITTED:
                if resulting_loaded is not None:
                    return resulting_loaded
                raise ValidationError(
                    {
                        "correction": (
                            "Correction is RESUBMITTED but resulting submission is missing."
                        )
                    }
                )

            if correction.status != ChecklistCorrectionStatus.DRAFT:
                raise ValidationError({"correction": "Only DRAFT corrections may be resubmitted."})

            _assert_source_eligible_for_correction(
                record=record, source_submission=correction.source_submission
            )

            version_id = task.checklist_version_id
            item_rows = load_version_items_for_recording(version_id)
            existing = responses_by_key(
                list(
                    lock_queryset(
                        ChecklistResponse.objects.filter(checklist_record_id=record.id),
                        of=("self",),
                    ).select_related("selected_option")
                )
            )
            from apps.recording.calculation_runtime import apply_calculations_to_draft
            from apps.recording.condition_runtime import resolve_condition_flags
            from apps.recording.evaluation_runtime import apply_evaluations_to_drafts

            existing = apply_calculations_to_draft(
                record_id=record.id,
                items=item_rows,
                responses=existing,
            )
            flags = resolve_condition_flags(items=item_rows, responses=existing)
            apply_evaluations_to_drafts(items=item_rows, responses=existing, condition_flags=flags)
            stats = validate_record_ready_for_submission(
                record=record, items=item_rows, responses=existing
            )
            responses = stats["responses"]

            max_number = (
                ChecklistSubmission.objects.filter(checklist_record_id=record.id).aggregate(
                    max_n=models.Max("submission_number")
                )["max_n"]
                or 0
            )
            next_number = int(max_number) + 1

            submission = ChecklistSubmission(
                checklist_record=record,
                submission_number=next_number,
                submitted_by=user,
            )
            submission.full_clean()
            submission.save()

            items_by_id = {item.id: item for item in stats["items"]}
            snapshot_rows: list[ChecklistSubmissionResponse] = []
            for (item_id, sample_index), response in sorted(
                responses.items(), key=lambda pair: (str(pair[0][0]), pair[0][1])
            ):
                item = items_by_id.get(item_id)
                if item is None:
                    continue
                if item.item_kind == ChecklistItemKind.SIMPLE:
                    if not _response_is_structurally_valid(item, response):
                        continue
                    snapshot = ChecklistSubmissionResponse(
                        checklist_submission=submission,
                        checklist_item=item,
                        sample_index=sample_index,
                        choice_value=response.choice_value,
                        number_value=response.number_value,
                        text_value=response.text_value,
                        selected_option_id=response.selected_option_id,
                        calculation_context=None,
                        condition_context=response.condition_context,
                        evaluation_result=response.evaluation_result,
                        evaluation_context=response.evaluation_context,
                        control_point_context=_control_point_context_for_item(item),
                        measurement_context=_measurement_context_for_response(response, item),
                        equipment_id=response.equipment_id,
                        calibration_record_id=response.calibration_record_id,
                        measurement_recorded_at=response.measurement_recorded_at,
                        device_trace_context=response.device_trace_context,
                        evidence_hook=response.evidence_hook,
                    )
                elif item.item_kind == ChecklistItemKind.CALCULATED:
                    if response.number_value is None:
                        continue
                    snapshot = ChecklistSubmissionResponse(
                        checklist_submission=submission,
                        checklist_item=item,
                        sample_index=sample_index,
                        choice_value="",
                        number_value=response.number_value,
                        text_value="",
                        selected_option_id=None,
                        calculation_context=response.calculation_context,
                        condition_context=response.condition_context,
                        evaluation_result=response.evaluation_result,
                        evaluation_context=response.evaluation_context,
                        control_point_context=_control_point_context_for_item(item),
                        measurement_context=_measurement_context_for_response(response, item),
                        equipment_id=response.equipment_id,
                        calibration_record_id=response.calibration_record_id,
                        measurement_recorded_at=response.measurement_recorded_at,
                        device_trace_context=response.device_trace_context,
                        evidence_hook=response.evidence_hook,
                    )
                else:
                    continue
                snapshot.full_clean()
                snapshot_rows.append(snapshot)
            ChecklistSubmissionResponse.objects.bulk_create(snapshot_rows)

            transition_correction_to_resubmitted(correction, resulting_submission=submission)
            # Record remains SUBMITTED — do not reverse to DRAFT.
            record.save(update_fields=["updated_at"])

            record_event(
                event_type="CHECKLIST_CORRECTION_RESUBMITTED",
                actor=user,
                metadata=_correction_metadata(correction, resulting_submission=submission)
                | {
                    "answered_item_count": len(snapshot_rows),
                },
            )
            # Also emit standard submitted event for operational continuity.
            record_event(
                event_type="CHECKLIST_RECORD_SUBMITTED",
                actor=user,
                metadata=_record_metadata(
                    record,
                    submission=submission,
                    answered_item_count=len(snapshot_rows),
                ),
            )
    except IntegrityError:
        raced = (
            ChecklistCorrection.objects.select_related("resulting_submission")
            .filter(pk=correction_id)
            .first()
        )
        if (
            raced is not None
            and raced.status == ChecklistCorrectionStatus.RESUBMITTED
            and raced.resulting_submission_id is not None
        ):
            raced_result = ChecklistSubmission.objects.filter(
                pk=raced.resulting_submission_id
            ).first()
            if raced_result is not None:
                return raced_result
        raise ValidationError({"correction": "Unable to resubmit checklist correction."}) from None

    return ChecklistSubmission.objects.select_related(
        "checklist_record",
        "checklist_record__organization",
        "checklist_record__checklist_task",
        "checklist_record__checklist_task__checklist_template",
        "checklist_record__checklist_task__checklist_version",
        "submitted_by",
    ).get(pk=submission.id)
