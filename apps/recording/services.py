"""Checklist recording services — draft save + immutable submission (Phase 08B)."""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError

from apps.access_control.services import require_permission
from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistItem,
    ChecklistItemKind,
    ChecklistItemOption,
    ChecklistResponseType,
    ChecklistVersionStatus,
)
from apps.checklists.compat_queries import load_version_items_for_recording
from apps.core.persistence import (
    TransitionConflictError,
    atomic,
    create_immutable_unique,
    lock_queryset,
    require_conditional_update,
)
from apps.core.idempotency import execute_idempotent
from apps.recording.models import (
    ChecklistRecord,
    ChecklistRecordStatus,
    ChecklistResponse,
    ChecklistSubmission,
    ChecklistSubmissionResponse,
    ChoiceResponseValue,
)
from apps.recording.repeating import (
    ResponseKey,
    active_sample_count,
    assert_sample_index_allowed,
    effective_repeat_min,
    normalize_answers,
    partition_definition_items,
    responses_by_key,
    validate_repeating_submit_shape,
)
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
from apps.scheduling.services import RECORD_CHECKLIST_TASK, task_authorization_scope
from apps.security_audit.services import record_event

YES_NO_VALUES = frozenset({ChoiceResponseValue.YES, ChoiceResponseValue.NO})
YES_NO_NA_VALUES = frozenset(
    {ChoiceResponseValue.YES, ChoiceResponseValue.NO, ChoiceResponseValue.NA}
)


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _record_metadata(
    record: ChecklistRecord,
    *,
    changed_item_count: int | None = None,
    submission: ChecklistSubmission | None = None,
    answered_item_count: int | None = None,
) -> dict[str, Any]:
    task = record.checklist_task
    metadata: dict[str, Any] = {
        "checklist_record_id": str(record.id),
        "checklist_task_id": str(task.id),
        "organization_id": str(record.organization_id),
        "checklist_template_id": str(task.checklist_template_id),
        "checklist_version_id": str(task.checklist_version_id),
        "batch_reference": task.batch_reference,
    }
    if changed_item_count is not None:
        metadata["changed_item_count"] = changed_item_count
    if answered_item_count is not None:
        metadata["answered_item_count"] = answered_item_count
    if submission is not None:
        metadata["checklist_submission_id"] = str(submission.id)
        metadata["submission_number"] = submission.submission_number
    return metadata


def _assert_task_recordable(task: ChecklistTask) -> None:
    if task.status != ChecklistTaskStatus.PENDING:
        raise ValidationError({"task": "Only PENDING checklist tasks may be recorded."})
    if task.checklist_version.status != ChecklistVersionStatus.PUBLISHED:
        raise ValidationError(
            {
                "task": (
                    "Checklist task definition must remain a PUBLISHED version. "
                    "Recording cannot substitute another version."
                )
            }
        )


def _assert_record_is_draft(record: ChecklistRecord) -> None:
    if record.status != ChecklistRecordStatus.DRAFT:
        raise ValidationError(
            {
                "status": (
                    "Submitted checklist records cannot be edited. "
                    "Future corrections require an explicit resubmission workflow."
                )
            }
        )


def transition_record_to_submitted(record: ChecklistRecord) -> ChecklistRecord:
    """Centralized DRAFT → SUBMITTED transition. Reverse is not allowed in 08B."""
    if record.status == ChecklistRecordStatus.SUBMITTED:
        return record
    if record.status != ChecklistRecordStatus.DRAFT:
        raise ValidationError(
            {"status": f"Cannot transition checklist record from {record.status} to SUBMITTED."}
        )
    record.status = ChecklistRecordStatus.SUBMITTED
    record.save(update_fields=["status", "updated_at"])
    return record


def start_checklist_recording(
    *,
    actor: User | None,
    task_id: uuid.UUID,
) -> ChecklistRecord:
    """
    Start (or return existing) ChecklistRecord for a PENDING task.

    Idempotent and race-safe. Does not transfer started_by ownership.
    """
    user = _require_authenticated_actor(actor)

    task = (
        ChecklistTask.objects.select_related(
            "organization",
            "checklist_template",
            "checklist_version",
        )
        .filter(pk=task_id)
        .first()
    )
    if task is None:
        raise ValidationError({"task": "Checklist task not found."})

    require_permission(user, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(task))
    _assert_task_recordable(task)

    existing = (
        ChecklistRecord.objects.select_related(
            "organization",
            "checklist_task",
            "checklist_task__checklist_template",
            "checklist_task__checklist_version",
            "started_by",
        )
        .filter(checklist_task_id=task.id)
        .first()
    )
    if existing is not None:
        return existing

    with atomic():
        locked = (
            ChecklistTask.objects.select_related(
                "organization",
                "checklist_template",
                "checklist_version",
            )
            .filter(pk=task.id)
            .first()
        )
        if locked is None:
            raise ValidationError({"task": "Checklist task not found."})
        _assert_task_recordable(locked)

        raced_existing = (
            ChecklistRecord.objects.select_related(
                "organization",
                "checklist_task",
                "checklist_task__checklist_template",
                "checklist_task__checklist_version",
                "started_by",
            )
            .filter(checklist_task_id=locked.id)
            .first()
        )
        if raced_existing is not None:
            return raced_existing

        try:
            record, created = create_immutable_unique(
                model=ChecklistRecord,
                create_kwargs={
                    "organization_id": locked.organization_id,
                    "checklist_task": locked,
                    "status": ChecklistRecordStatus.DRAFT,
                    "started_by": user,
                },
                unique_lookup={"checklist_task_id": locked.id},
                decision_field="checklist_task_id",
                decision_value=locked.id,
            )
        except TransitionConflictError as exc:
            raced = ChecklistRecord.objects.filter(checklist_task_id=task.id).first()
            if raced is not None:
                return raced
            raise ValidationError({"task": "Unable to start checklist recording."}) from exc

        if created:
            record_event(
                event_type="CHECKLIST_RECORD_STARTED",
                actor=user,
                metadata=_record_metadata(record),
            )

    return ChecklistRecord.objects.select_related(
        "organization",
        "checklist_task",
        "checklist_task__checklist_template",
        "checklist_task__checklist_version",
        "started_by",
    ).get(pk=record.id)


def _clear_value_fields(response: ChecklistResponse) -> None:
    response.choice_value = ""
    response.number_value = None
    response.text_value = ""
    response.selected_option = None
    response.measurement_context = None


def _apply_typed_value(
    *,
    response: ChecklistResponse,
    item: ChecklistItem,
    raw: Any,
) -> None:
    response_type = item.response_type
    _clear_value_fields(response)

    if response_type == ChecklistResponseType.YES_NO:
        value = str(raw).strip().upper()
        if value not in YES_NO_VALUES:
            raise ValidationError({str(item.id): "Answer must be YES or NO."})
        response.choice_value = value
        return

    if response_type == ChecklistResponseType.YES_NO_NA:
        value = str(raw).strip().upper()
        if value not in YES_NO_NA_VALUES:
            raise ValidationError({str(item.id): "Answer must be YES, NO, or NA."})
        response.choice_value = value
        return

    if response_type == ChecklistResponseType.NUMBER:
        from apps.checklists.measurement import (
            apply_configured_rounding,
            build_measurement_context,
            parse_decimal_strict,
        )

        try:
            # Always via str/Decimal path — never float authority.
            if isinstance(raw, float):
                number = parse_decimal_strict(str(raw))
            else:
                number = parse_decimal_strict(raw if isinstance(raw, Decimal) else str(raw).strip())
        except ValidationError as exc:
            raise ValidationError({str(item.id): "Enter a valid number."}) from exc
        except (InvalidOperation, AttributeError, TypeError) as exc:
            raise ValidationError({str(item.id): "Enter a valid number."}) from exc
        precision = getattr(item, "decimal_precision", None)
        mode = getattr(item, "rounding_mode", "") or ""
        number, rounded = apply_configured_rounding(number, precision, mode)
        # Informational min/max intentionally do NOT block save/submit.
        response.number_value = number
        response.measurement_context = build_measurement_context(
            value=number,
            unit=getattr(item, "unit", "") or "",
            decimal_precision=precision,
            rounding_mode=mode,
            rounding_applied=rounded,
            minimum_value=getattr(item, "minimum_value", None),
            maximum_value=getattr(item, "maximum_value", None),
            min_inclusive=bool(getattr(item, "min_inclusive", True)),
            max_inclusive=bool(getattr(item, "max_inclusive", True)),
        )
        return

    if response_type == ChecklistResponseType.TEXT:
        text = str(raw)
        if not text.strip():
            raise ValidationError({str(item.id): "Text answer cannot be blank."})
        response.text_value = text
        return

    if response_type == ChecklistResponseType.SELECT:
        try:
            option_id = uuid.UUID(str(raw))
        except (TypeError, ValueError, AttributeError) as exc:
            raise ValidationError({str(item.id): "Select a valid option."}) from exc
        option = ChecklistItemOption.objects.filter(pk=option_id, item_id=item.id).first()
        if option is None:
            raise ValidationError({str(item.id): "Select a valid option."})
        response.selected_option = option
        return

    raise ValidationError({str(item.id): "Unsupported response type."})


def _is_blank_answer(raw: Any) -> bool:
    if raw is None:
        return True
    if isinstance(raw, str) and not raw.strip():
        return True
    return False


def _response_is_structurally_valid(item: ChecklistItem, response: ChecklistResponse) -> bool:
    response_type = item.response_type
    if response_type == ChecklistResponseType.YES_NO:
        return response.choice_value in YES_NO_VALUES
    if response_type == ChecklistResponseType.YES_NO_NA:
        return response.choice_value in YES_NO_NA_VALUES
    if response_type == ChecklistResponseType.NUMBER:
        return response.number_value is not None
    if response_type == ChecklistResponseType.TEXT:
        return bool((response.text_value or "").strip())
    if response_type == ChecklistResponseType.SELECT:
        return (
            response.selected_option_id is not None
            and response.selected_option is not None
            and response.selected_option.item_id == item.id
        )
    return False


def collect_submission_completeness(
    *,
    record: ChecklistRecord,
    items: list[ChecklistItem] | None = None,
    responses: dict[ResponseKey, ChecklistResponse] | None = None,
) -> dict[str, Any]:
    """
    Completeness metrics for submission UX / validation.

    Does not evaluate PASS/FAIL or min/max conformance.
    REPEATING_GROUP containers are not answerable; child SIMPLE rows use sample_index.
    """
    version_id = record.checklist_task.checklist_version_id
    if items is None:
        items = load_version_items_for_recording(version_id)
    if responses is None:
        responses = responses_by_key(
            list(
                ChecklistResponse.objects.filter(checklist_record_id=record.id).select_related(
                    "selected_option"
                )
            )
        )

    top_simple, groups, children_by_parent, top_calculated = partition_definition_items(items)
    from apps.recording.condition_runtime import resolve_condition_flags

    flags = resolve_condition_flags(items=items, responses=responses)
    missing_required: list[ChecklistItem] = []
    answered_count = 0
    required_slots = 0
    answered_required_slots = 0
    evidence_required_items: list[ChecklistItem] = []

    def _slot_meta(item: ChecklistItem, sample_index: int) -> dict[str, Any]:
        return flags.get(
            (item.id, sample_index),
            {
                "visible": True,
                "required": bool(item.is_required),
                "evidence_required": False,
            },
        )

    for item in top_simple:
        meta = _slot_meta(item, 1)
        if not meta["visible"]:
            continue
        response = responses.get((item.id, 1))
        valid = response is not None and _response_is_structurally_valid(item, response)
        if valid:
            answered_count += 1
        if meta["required"]:
            required_slots += 1
            if valid:
                answered_required_slots += 1
            else:
                missing_required.append(item)
        if meta["evidence_required"] and item not in evidence_required_items:
            evidence_required_items.append(item)

    for item in top_calculated:
        meta = _slot_meta(item, 1)
        if not meta["visible"]:
            continue
        response = responses.get((item.id, 1))
        valid = response is not None and response.number_value is not None
        if valid:
            answered_count += 1
        if meta["required"]:
            required_slots += 1
            if valid:
                answered_required_slots += 1
            else:
                missing_required.append(item)
        if meta["evidence_required"] and item not in evidence_required_items:
            evidence_required_items.append(item)

    for group in groups:
        children = children_by_parent.get(group.id, [])
        simple_children = [c for c in children if c.item_kind == ChecklistItemKind.SIMPLE]
        calculated_children = [c for c in children if c.item_kind == ChecklistItemKind.CALCULATED]
        n = active_sample_count(children=simple_children or children, responses=responses)
        min_required = effective_repeat_min(group, simple_children or children)
        target_n = max(n, min_required)
        if n < min_required:
            for child in simple_children:
                meta = _slot_meta(child, 1)
                if meta["visible"] and meta["required"] and child not in missing_required:
                    missing_required.append(child)
        for sample_index in range(1, target_n + 1):
            for child in simple_children:
                meta = _slot_meta(child, sample_index)
                if not meta["visible"]:
                    continue
                response = responses.get((child.id, sample_index))
                valid = response is not None and _response_is_structurally_valid(child, response)
                if valid and sample_index <= n:
                    answered_count += 1
                if meta["required"] and sample_index <= target_n:
                    required_slots += 1
                    if valid and sample_index <= n:
                        answered_required_slots += 1
                    elif sample_index <= max(n, min_required):
                        if child not in missing_required:
                            missing_required.append(child)
                if meta["evidence_required"] and child not in evidence_required_items:
                    evidence_required_items.append(child)
            for child in calculated_children:
                meta = _slot_meta(child, sample_index)
                if not meta["visible"]:
                    continue
                response = responses.get((child.id, sample_index))
                valid = response is not None and response.number_value is not None
                if valid and sample_index <= n:
                    answered_count += 1
                if meta["required"] and sample_index <= target_n:
                    required_slots += 1
                    if valid and sample_index <= n:
                        answered_required_slots += 1
                    elif sample_index <= max(n, min_required):
                        if child not in missing_required:
                            missing_required.append(child)
                if meta["evidence_required"] and child not in evidence_required_items:
                    evidence_required_items.append(child)

    answerable = [
        item
        for item in items
        if item.item_kind in {ChecklistItemKind.SIMPLE, ChecklistItemKind.CALCULATED}
    ]
    return {
        "total_items": len(answerable),
        "required_items": required_slots,
        "answered_required_items": answered_required_slots,
        "missing_required_items": missing_required,
        "evidence_required_items": evidence_required_items,
        "answered_items": answered_count,
        "items": items,
        "responses": responses,
        "condition_flags": flags,
    }


def validate_record_ready_for_submission(
    *,
    record: ChecklistRecord,
    items: list[ChecklistItem] | None = None,
    responses: dict[ResponseKey, ChecklistResponse] | None = None,
) -> dict[str, Any]:
    """Raise ValidationError if required completeness is not met."""
    stats = collect_submission_completeness(record=record, items=items, responses=responses)
    _, groups, children_by_parent, _ = partition_definition_items(stats["items"])
    validate_repeating_submit_shape(
        groups=groups,
        children_by_parent=children_by_parent,
        responses=stats["responses"],
    )
    missing = stats["missing_required_items"]
    if missing:
        errors: dict[str, list[str]] = {
            str(item.id): [f"Required item {item.code} must be answered before submission."]
            for item in missing
        }
        errors["completeness"] = [f"{len(missing)} required item(s) remain unanswered."]
        raise ValidationError(errors)
    evidence_needed = stats.get("evidence_required_items") or []
    if evidence_needed:
        raise ValidationError(
            {
                "evidence": [
                    "EVIDENCE_REQUIRED_IF is true for one or more items, but the evidence "
                    "attachment module is not yet available (Phase 11). Submission blocked "
                    "(fail-closed stub)."
                ],
                **{
                    str(item.id): [
                        f"Evidence required for {item.code} (EVIDENCE_REQUIRED_IF); "
                        "evidence module not available."
                    ]
                    for item in evidence_needed
                },
            }
        )
    return stats


def _apply_equipment_refs(
    *,
    record: ChecklistRecord,
    items: dict[Any, Any],
    existing: dict[Any, Any],
    equipment_refs: dict[Any, Any],
    actor: User | None = None,
    calibration_overrides: dict[Any, Any] | None = None,
) -> None:
    """Attach measuring device + frozen calibration snapshot; respect policy settings."""
    if not equipment_refs:
        return
    from django.utils import timezone

    from apps.instruments.device_traceability import (
        apply_calibration_policy,
        assess_device_eligibility,
        build_device_trace_snapshot,
    )
    from apps.instruments.models import Equipment

    overrides = calibration_overrides or {}

    def _key(raw_key: Any) -> tuple[Any, int]:
        if isinstance(raw_key, tuple) and len(raw_key) == 2:
            item_id = raw_key[0]
            if not isinstance(item_id, uuid.UUID):
                item_id = uuid.UUID(str(item_id))
            return item_id, int(raw_key[1])
        return uuid.UUID(str(raw_key)), 1

    for raw_key, equipment_id in equipment_refs.items():
        key = _key(raw_key)
        item = items.get(key[0])
        if item is None:
            continue
        response = existing.get(key)
        if response is None:
            continue
        requires = bool(getattr(item, "requires_equipment_reference", False))
        if not requires:
            continue
        if equipment_id in (None, ""):
            response.equipment = None
            response.calibration_record = None
            response.measurement_recorded_at = None
            response.device_trace_context = None
            response.evidence_hook = {
                "status": "EQUIPMENT_REFERENCE_CLEARED",
                "attachment_module": "Phase 11 - apps.evidence available",
            }
            response.save(
                update_fields=[
                    "equipment",
                    "calibration_record",
                    "measurement_recorded_at",
                    "device_trace_context",
                    "evidence_hook",
                    "updated_at",
                ]
            )
            continue
        equipment = Equipment.objects.filter(pk=equipment_id).first()
        if equipment is None:
            raise ValidationError({str(key[0]): ["Equipment not found."]})
        eligibility = assess_device_eligibility(
            equipment=equipment,
            organization_id=record.organization_id,
            site_id=getattr(record, "site_id", None),
            required_equipment_type=getattr(item, "required_equipment_type", "") or "",
        )
        override_payload = overrides.get(key) or overrides.get(raw_key) or {}
        policy = apply_calibration_policy(
            eligibility=eligibility,
            actor=actor,
            organization_id=record.organization_id,
            override=bool(override_payload.get("override")),
            override_reason=str(override_payload.get("reason") or ""),
        )
        if not policy.allowed:
            raise ValidationError(
                {str(key[0]): [f"Device not permitted ({policy.reason_code} / {policy.fitness})."]}
            )
        if eligibility.equipment is None:
            raise ValidationError({str(key[0]): ["Device not permitted (missing equipment)."]})
        measured_at = timezone.now()
        snap = build_device_trace_snapshot(
            equipment=eligibility.equipment,
            calibration_record=eligibility.calibration_record,
            fitness=eligibility.fitness,
            policy=policy,
            measurement_at=measured_at,
        )
        response.equipment = eligibility.equipment
        response.calibration_record = eligibility.calibration_record
        response.measurement_recorded_at = measured_at
        response.device_trace_context = snap
        response.evidence_hook = {
            "status": "EQUIPMENT_REFERENCE_SET",
            "equipment_id": str(eligibility.equipment.id),
            "equipment_code": eligibility.equipment.code,
            "calibration_record_id": (
                str(eligibility.calibration_record.id) if eligibility.calibration_record else None
            ),
            "fitness": eligibility.fitness,
            "policy_outcome": policy.outcome,
            "attachment_module": "Phase 11 - apps.evidence available",
            "not_qa_disposition": True,
        }
        response.save(
            update_fields=[
                "equipment",
                "calibration_record",
                "measurement_recorded_at",
                "device_trace_context",
                "evidence_hook",
                "updated_at",
            ]
        )


def save_checklist_draft_responses(
    *,
    actor: User | None,
    record_id: uuid.UUID,
    answers: dict[Any, Any],
    expected_draft_version: int | None = None,
    save_mode: str = "manual",
    equipment_refs: dict[Any, Any] | None = None,
    calibration_overrides: dict[Any, Any] | None = None,
) -> ChecklistRecord:
    """
    Save/update/clear typed draft responses.

    ``answers`` keys may be ``item_id`` (legacy sample_index=1) or
    ``(item_id, sample_index)``.

    Optimistic concurrency: when ``expected_draft_version`` is provided it must
    match ``record.draft_version`` or DraftConcurrencyConflict is raised
    (no silent last-write-wins). Server remains authoritative.

    ``equipment_refs`` optional map of answer key -> equipment UUID for items
    with ``requires_equipment_reference``. Calibration WARN/BLOCK follows
    INSTRUMENTS_CALIBRATION_ENFORCEMENT (default OFF).

    Allowed when:
    - ChecklistRecord is DRAFT (initial recording), or
    - ChecklistRecord is SUBMITTED with an eligible active ChecklistCorrection(DRAFT).
    """
    user = _require_authenticated_actor(actor)
    normalized = normalize_answers(answers)
    from apps.recording.concurrency import (
        SAVE_MODE_AUTOSAVE,
        assert_expected_draft_version,
        next_draft_version,
    )

    with atomic():
        record = (
            lock_queryset(
                ChecklistRecord.objects.select_related(
                    "organization",
                    "checklist_task",
                    "checklist_task__organization",
                    "checklist_task__checklist_template",
                    "checklist_task__checklist_version",
                )
            )
            .filter(pk=record_id)
            .first()
        )
        if record is None:
            raise ValidationError({"record": "Checklist record not found."})

        task = record.checklist_task
        require_permission(user, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(task))
        if record.organization_id != task.organization_id:
            raise ValidationError({"organization": "Record organization mismatch."})
        _assert_task_recordable(task)
        from apps.recording.correction_services import assert_record_editable_for_actor

        assert_record_editable_for_actor(record)
        assert_expected_draft_version(
            record_version=record.draft_version,
            expected_draft_version=expected_draft_version,
        )

        version_id = task.checklist_version_id
        item_rows = load_version_items_for_recording(version_id)
        items = {item.id: item for item in item_rows}
        existing = responses_by_key(
            list(lock_queryset(ChecklistResponse.objects.filter(checklist_record_id=record.id)))
        )

        # Server is authoritative for CALCULATED — ignore client-supplied values.
        errors: dict[str, list[str]] = {}
        filtered: dict[tuple[uuid.UUID, int], Any] = {}
        for key, raw in normalized.items():
            item = items.get(key[0])
            if item is None:
                errors.setdefault(str(key[0]), []).append(
                    "Item is not part of this checklist definition."
                )
                continue
            if item.item_kind == ChecklistItemKind.CALCULATED:
                continue
            if item.item_kind != ChecklistItemKind.SIMPLE:
                errors.setdefault(str(key[0]), []).append(
                    "Only SIMPLE items accept operator answers."
                )
                continue
            filtered[key] = raw
        normalized = filtered

        changed = 0

        for (item_id, sample_index), raw in normalized.items():
            item = items.get(item_id)
            if item is None:
                errors[str(item_id)] = ["Item is not part of this checklist definition."]
                continue
            try:
                assert_sample_index_allowed(item=item, sample_index=sample_index, items_by_id=items)
            except ValidationError as exc:
                if hasattr(exc, "message_dict"):
                    for err_key, msgs in exc.message_dict.items():
                        errors.setdefault(str(err_key), []).extend(str(m) for m in msgs)
                else:
                    errors.setdefault(str(item_id), []).extend(str(m) for m in exc.messages)
                continue

            response_key = (item_id, sample_index)
            if _is_blank_answer(raw):
                current = existing.get(response_key)
                if current is not None:
                    current.delete()
                    existing.pop(response_key, None)
                    changed += 1
                continue

            response = existing.get(response_key) or ChecklistResponse(
                checklist_record=record,
                checklist_item=item,
                sample_index=sample_index,
            )
            response.sample_index = sample_index
            response.calculation_context = None
            response.condition_context = None
            response.evaluation_result = ""
            response.evaluation_context = None
            try:
                _apply_typed_value(response=response, item=item, raw=raw)
                response.full_clean()
                response.save()
                existing[response_key] = response
                changed += 1
            except ValidationError as exc:
                if hasattr(exc, "message_dict"):
                    for key_name, msgs in exc.message_dict.items():
                        bucket = errors.setdefault(str(key_name), [])
                        bucket.extend(str(m) for m in msgs)
                else:
                    errors.setdefault(str(item_id), []).extend(str(m) for m in exc.messages)

        if errors:
            raise ValidationError(errors)

        from apps.recording.calculation_runtime import apply_calculations_to_draft
        from apps.recording.condition_runtime import (
            apply_condition_context_to_drafts,
            assert_no_answers_for_hidden_items,
            clear_hidden_draft_responses,
            resolve_condition_flags,
        )
        from apps.recording.evaluation_runtime import apply_evaluations_to_drafts

        existing = apply_calculations_to_draft(
            record_id=record.id,
            items=item_rows,
            responses=existing,
        )
        flags = resolve_condition_flags(items=item_rows, responses=existing)
        non_blank_pending = [key for key, raw in normalized.items() if not _is_blank_answer(raw)]
        assert_no_answers_for_hidden_items(flags=flags, pending_keys=non_blank_pending)
        existing = clear_hidden_draft_responses(flags=flags, existing=existing)
        apply_condition_context_to_drafts(flags=flags, existing=existing)
        apply_evaluations_to_drafts(items=item_rows, responses=existing, condition_flags=flags)
        changed += sum(1 for item in item_rows if item.item_kind == ChecklistItemKind.CALCULATED)

        _apply_equipment_refs(
            record=record,
            items=items,
            existing=existing,
            equipment_refs=equipment_refs or {},
            actor=user,
            calibration_overrides=calibration_overrides or {},
        )
        expected_version = record.draft_version
        record.draft_version = next_draft_version(expected_version)
        try:
            from django.utils import timezone as dj_timezone

            require_conditional_update(
                ChecklistRecord.objects.all(),
                expected={"pk": record.pk, "draft_version": expected_version},
                updates={
                    "draft_version": record.draft_version,
                    "updated_at": dj_timezone.now(),
                },
            )
        except TransitionConflictError as exc:
            from apps.recording.concurrency import DraftConcurrencyConflict

            current = ChecklistRecord.objects.filter(pk=record.pk).values_list(
                "draft_version", flat=True
            ).first()
            raise DraftConcurrencyConflict(
                current_version=current if current is not None else expected_version,
                expected_version=expected_draft_version,
            ) from exc
        meta = _record_metadata(record, changed_item_count=changed)
        meta["draft_version"] = record.draft_version
        meta["save_mode"] = save_mode
        meta["autosave"] = save_mode == SAVE_MODE_AUTOSAVE
        record_event(
            event_type="CHECKLIST_RECORD_DRAFT_SAVED",
            actor=user,
            metadata=meta,
        )

    return ChecklistRecord.objects.select_related(
        "organization",
        "checklist_task",
        "checklist_task__checklist_template",
        "checklist_task__checklist_version",
        "started_by",
    ).get(pk=record.id)


def _measurement_context_for_response(
    response: ChecklistResponse, item: ChecklistItem
) -> dict[str, object] | None:
    """Prefer draft measurement_context; rebuild from value+definition if needed."""
    ctx = getattr(response, "measurement_context", None)
    if isinstance(ctx, dict) and ctx.get("captured_value") is not None:
        return ctx
    if response.number_value is None:
        return None
    if (
        item.response_type != ChecklistResponseType.NUMBER
        and item.item_kind != ChecklistItemKind.CALCULATED
    ):
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


def submit_checklist_record(
    *,
    actor: User | None,
    record_id: uuid.UUID,
    idempotency_key: str = "",
) -> ChecklistSubmission:
    """
    Submit a complete DRAFT record and create immutable Submission #1 snapshot.

    Idempotent for already-submitted records with submission #1.
    Does not evaluate PASS/FAIL, HOLD, or QA disposition.
    ChecklistTask status remains PENDING until a later lifecycle unit.
    """
    user = _require_authenticated_actor(actor)
    preview = (
        ChecklistRecord.objects.select_related("organization", "checklist_task")
        .filter(pk=record_id)
        .first()
    )
    if preview is None:
        raise ValidationError({"record": "Checklist record not found."})
    if preview.status == ChecklistRecordStatus.SUBMITTED:
        existing = (
            ChecklistSubmission.objects.select_related(
                "checklist_record",
                "submitted_by",
            )
            .filter(checklist_record_id=preview.id, submission_number=1)
            .first()
        )
        if existing is not None:
            return existing

    key = (idempotency_key or "").strip() or f"submit:{record_id}:1"

    def _submit() -> ChecklistSubmission:
        return _submit_checklist_record_body(user=user, record_id=record_id)

    return execute_idempotent(
        organization=preview.organization,
        scope="recording.submit",
        key=key,
        fn=_submit,
        reload=lambda ref: ChecklistSubmission.objects.filter(pk=ref).first(),
        pending_fallback=lambda: ChecklistSubmission.objects.filter(
            checklist_record_id=record_id, submission_number=1
        ).first(),
    )


def _submit_checklist_record_body(
    *,
    user: User,
    record_id: uuid.UUID,
) -> ChecklistSubmission:
    try:
        with atomic():
            record = (
                lock_queryset(
                    ChecklistRecord.objects.select_related(
                        "organization",
                        "checklist_task",
                        "checklist_task__organization",
                        "checklist_task__checklist_template",
                        "checklist_task__checklist_version",
                        "started_by",
                    )
                )
                .filter(pk=record_id)
                .first()
            )
            if record is None:
                raise ValidationError({"record": "Checklist record not found."})

            task = record.checklist_task
            require_permission(user, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(task))
            if record.organization_id != task.organization_id:
                raise ValidationError({"organization": "Record organization mismatch."})
            _assert_task_recordable(task)

            if record.status == ChecklistRecordStatus.SUBMITTED:
                existing = (
                    ChecklistSubmission.objects.select_related(
                        "checklist_record",
                        "submitted_by",
                    )
                    .filter(checklist_record_id=record.id, submission_number=1)
                    .first()
                )
                if existing is not None:
                    return existing
                raise ValidationError(
                    {
                        "status": (
                            "Record is SUBMITTED but Submission #1 is missing. "
                            "Contact support — do not invent a replacement submission."
                        )
                    }
                )

            _assert_record_is_draft(record)
            version_id = task.checklist_version_id
            item_rows = load_version_items_for_recording(version_id)
            draft_responses = responses_by_key(
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

            draft_responses = apply_calculations_to_draft(
                record_id=record.id,
                items=item_rows,
                responses=draft_responses,
            )
            flags = resolve_condition_flags(items=item_rows, responses=draft_responses)
            apply_evaluations_to_drafts(
                items=item_rows, responses=draft_responses, condition_flags=flags
            )
            stats = validate_record_ready_for_submission(
                record=record, items=item_rows, responses=draft_responses
            )
            responses: dict[ResponseKey, ChecklistResponse] = stats["responses"]

            submission = ChecklistSubmission(
                checklist_record=record,
                submission_number=1,
                submitted_by=user,
            )
            submission.full_clean()
            submission.save()

            snapshot_rows: list[ChecklistSubmissionResponse] = []
            items_by_id = {item.id: item for item in stats["items"]}
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

            transition_record_to_submitted(record)
            from apps.evidence.services import mark_draft_response_evidence_immutable_for_record

            mark_draft_response_evidence_immutable_for_record(record_id=record.id)
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
            ChecklistSubmission.objects.select_related(
                "checklist_record",
                "submitted_by",
            )
            .filter(checklist_record_id=record_id, submission_number=1)
            .first()
        )
        if raced is not None:
            return raced
        raise ValidationError({"submission": "Unable to create checklist submission."}) from None

    return ChecklistSubmission.objects.select_related(
        "checklist_record",
        "checklist_record__organization",
        "checklist_record__checklist_task",
        "checklist_record__checklist_task__checklist_template",
        "checklist_record__checklist_task__checklist_version",
        "submitted_by",
    ).get(pk=submission.id)
