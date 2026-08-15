"""Checklist recording views — draft save + submit confirmation + submitted read-only."""

from __future__ import annotations

import uuid
from typing import Any

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.models import User
from apps.checklists.constants import REPEAT_SAMPLE_TECHNICAL_CEILING
from apps.checklists.controlled_forms import get_controlled_form
from apps.checklists.models import ChecklistResponseType
from apps.core.checklist_workflow import (
    ChecklistOperationalWorkflowState,
    attach_workflow_snapshots,
    filter_tasks_by_workflow_state,
)
from apps.recording.concurrency import (
    SAVE_MODE_AUTOSAVE,
    SAVE_MODE_MANUAL,
    DraftConcurrencyConflict,
)
from apps.recording.correction_services import (
    resubmit_checklist_correction,
    start_checklist_correction,
)
from apps.recording.forms import (
    ChecklistDraftForm,
    equipment_field_name,
    response_field_name,
    sample_count_field_name,
)
from apps.recording.models import (
    ChecklistCorrectionStatus,
    ChecklistRecord,
    ChecklistRecordStatus,
    ChecklistResponse,
)
from apps.recording.repeating import ResponseKey
from apps.recording.selectors import (
    actor_can_access_recording_module,
    get_checklist_correction,
    get_recordable_task,
    list_recordable_checklist_tasks,
    load_correction_editor_context,
    load_record_editor_context,
    load_record_history_context,
    load_returned_submission_context,
    load_submitted_record_context,
)
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.recording.snapshot_display import render_snapshot_sections
from apps.reviews.models import SupervisorReviewDecision
from apps.scheduling.models import ChecklistTask

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return request.user  # type: ignore[return-value]


def _require_recording_module(request: HttpRequest) -> None:
    if not actor_can_access_recording_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _validation_message(exc: ValidationError) -> str:
    if hasattr(exc, "message_dict"):
        parts: list[str] = []
        for msgs in exc.message_dict.values():
            parts.extend(str(m) for m in msgs)
        return "; ".join(parts)
    return "; ".join(str(m) for m in exc.messages)


def _initial_from_responses(
    responses: dict[ResponseKey, ChecklistResponse],
    items: list[Any],
) -> dict[ResponseKey, Any]:
    initial: dict[ResponseKey, Any] = {}
    for (item_id, sample_index), response in responses.items():
        item = next((row for row in items if row.id == item_id), None)
        if item is None:
            continue
        if item.response_type in {
            ChecklistResponseType.YES_NO,
            ChecklistResponseType.YES_NO_NA,
        }:
            initial[(item_id, sample_index)] = response.choice_value
        elif item.response_type == ChecklistResponseType.NUMBER:
            initial[(item_id, sample_index)] = response.number_value
        elif item.response_type == ChecklistResponseType.TEXT:
            initial[(item_id, sample_index)] = response.text_value
        elif item.response_type == ChecklistResponseType.SELECT:
            initial[(item_id, sample_index)] = response.selected_option_id
    return initial


def _parse_requested_sample_counts(
    post_data: Any,
    groups: list[Any],
) -> dict[uuid.UUID, int]:
    requested: dict[uuid.UUID, int] = {}
    for group in groups:
        raw = post_data.get(sample_count_field_name(group.id))
        if raw in (None, ""):
            continue
        try:
            count = int(raw)
        except (TypeError, ValueError):
            continue
        if group.repeat_max is not None:
            count = min(count, int(group.repeat_max))
        count = max(0, min(count, REPEAT_SAMPLE_TECHNICAL_CEILING))
        requested[group.id] = count
    action = str(post_data.get("sample_action") or "")
    if action.startswith("add:"):
        try:
            group_id = uuid.UUID(action.split(":", 1)[1])
        except (ValueError, IndexError):
            return requested
        group = next((row for row in groups if row.id == group_id), None)
        if group is None:
            return requested
        current = requested.get(group_id, 1)
        current += 1
        if group.repeat_max is not None:
            current = min(current, int(group.repeat_max))
        current = min(current, REPEAT_SAMPLE_TECHNICAL_CEILING)
        requested[group_id] = current
    elif action.startswith("remove:"):
        try:
            group_id = uuid.UUID(action.split(":", 1)[1])
        except (ValueError, IndexError):
            return requested
        group = next((row for row in groups if row.id == group_id), None)
        if group is None:
            return requested
        current = requested.get(group_id, 1)
        floor = int(group.repeat_min) if group.repeat_min is not None else 0
        requested[group_id] = max(floor, current - 1)
    return requested


def _apply_validation_error(form: ChecklistDraftForm, exc: ValidationError) -> None:
    if hasattr(exc, "message_dict"):
        for field, errors in exc.message_dict.items():
            target = None
            try:
                item_id = uuid.UUID(str(field))
                candidate = response_field_name(item_id)
                if candidate in form.fields:
                    target = candidate
            except (TypeError, ValueError, AttributeError):
                target = field if field in form.fields else None
            for error in errors:
                form.add_error(target, error)
        return
    form.add_error(None, "; ".join(str(m) for m in exc.messages))


@login_required
@require_GET
def recordable_task_list(request: HttpRequest) -> HttpResponse:
    _require_recording_module(request)
    workflow_raw = (request.GET.get("workflow") or "all").strip().upper()
    workflow_state = (
        workflow_raw if workflow_raw in ChecklistOperationalWorkflowState.ALL else "all"
    )
    tasks = list(list_recordable_checklist_tasks(_actor(request))[:500])
    ordered = attach_workflow_snapshots(tasks)
    if workflow_state != "all":
        ordered = filter_tasks_by_workflow_state(ordered, workflow_state=workflow_state)
    page = Paginator(ordered, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "recording/tasks/list.html",
        {
            "page": page,
            "tasks": page.object_list,
            "ChecklistRecordStatus": ChecklistRecordStatus,
            "workflow_state": workflow_state,
            "workflow_choices": ChecklistOperationalWorkflowState.CHOICES,
        },
    )


@login_required
@require_POST
def start_recording(request: HttpRequest, task_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    try:
        task = get_recordable_task(_actor(request), task_id)
    except PermissionDenied:
        raise
    if task is None:
        raise Http404("Checklist task not found.")
    try:
        record = start_checklist_recording(actor=_actor(request), task_id=task.id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages))
        return redirect("recording:task_list")
    messages.success(request, "Draft recording ready.")
    if record.status == ChecklistRecordStatus.SUBMITTED:
        return redirect("recording:record_submitted", record_id=record.id)
    return redirect("recording:record_detail", record_id=record.id)


def _equipment_choices_for_org(organization_id: uuid.UUID) -> list[tuple[str, str]]:
    from apps.instruments.device_traceability import equipment_choice_label
    from apps.instruments.models import Equipment

    rows = list(
        Equipment.objects.filter(organization_id=organization_id, is_active=True).order_by("code")[
            :500
        ]
    )
    return [("", "— Select device —")] + [
        (str(row.id), equipment_choice_label(row)) for row in rows
    ]


def _initial_equipment(responses: list[ChecklistResponse]) -> dict[ResponseKey, str]:
    initial: dict[ResponseKey, str] = {}
    for response in responses:
        if getattr(response, "equipment_id", None):
            initial[(response.checklist_item_id, response.sample_index)] = str(
                response.equipment_id
            )
    return initial


def _section_progress(sections: list[Any], completeness: dict[str, Any]) -> list[dict[str, Any]]:
    """Per-section answered/required counts for editor UX (top-level SIMPLE only)."""
    missing_ids = {
        str(getattr(item, "id", item))
        for item in (completeness.get("missing_required_items") or [])
    }
    progress: list[dict[str, Any]] = []
    for section in sections:
        required = 0
        missing = 0
        for item in section.items.all():
            if item.parent_item_id:
                continue
            if getattr(item, "item_kind", "") == "REPEATING_GROUP":
                continue
            if getattr(item, "item_kind", "") == "CALCULATED":
                continue
            if bool(getattr(item, "is_required", False)):
                required += 1
                if str(item.id) in missing_ids:
                    missing += 1
        answered = max(required - missing, 0)
        progress.append(
            {
                "section": section,
                "required": required,
                "answered": answered,
                "missing": missing,
                "complete": missing == 0,
            }
        )
    return progress


@login_required
@require_http_methods(["GET", "POST"])
def record_detail(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    # Online session recovery: remember resume URL for post-login return.
    request.session["recording_resume_url"] = request.path
    requested_counts: dict[uuid.UUID, int] | None = None
    if request.method == "POST":
        try:
            probe = load_record_editor_context(_actor(request), record_id)
        except PermissionDenied:
            raise
        if probe is not None:
            requested_counts = _parse_requested_sample_counts(
                request.POST, probe.get("groups") or []
            )

    try:
        draft_context = load_record_editor_context(
            _actor(request),
            record_id,
            requested_sample_counts=requested_counts,
        )
    except PermissionDenied:
        raise
    if draft_context is None:
        raise Http404("Checklist record not found.")

    record: ChecklistRecord = draft_context["record"]
    if record.status == ChecklistRecordStatus.SUBMITTED:
        history = load_record_history_context(_actor(request), record.id)
        if history and history["active_correction"] is not None:
            return redirect(
                "recording:correction_detail",
                correction_id=history["active_correction"].id,
            )
        return redirect("recording:record_submitted", record_id=record.id)

    task: ChecklistTask = draft_context["task"]
    sections = draft_context["sections"]
    responses = draft_context["responses"]
    completeness = draft_context["completeness"]
    sample_indexes_by_group = draft_context["sample_indexes_by_group"]
    children_by_parent = draft_context["children_by_parent"]
    items = [item for section in sections for item in section.items.all()]
    initial = _initial_from_responses(responses, items)
    equipment_choices = _equipment_choices_for_org(record.organization_id)
    initial_equipment = _initial_equipment(responses)
    conflict = False
    section_progress = _section_progress(sections, completeness)

    def _form(data: Any = None) -> ChecklistDraftForm:
        return ChecklistDraftForm(
            data,
            items=items,
            initial_responses=initial,
            sample_indexes_by_group=sample_indexes_by_group,
            draft_version=record.draft_version,
            equipment_choices=equipment_choices,
            initial_equipment=initial_equipment,
            form_code=task.checklist_template.code,
        )

    if request.method == "POST" and request.POST.get("sample_action"):
        form = _form(request.POST)
        if not form.is_valid():
            form = _form()
    elif request.method == "POST":
        form = _form(request.POST)
        if form.is_valid():
            try:
                save_checklist_draft_responses(
                    actor=_actor(request),
                    record_id=record.id,
                    answers=form.answers_by_item_id(),
                    expected_draft_version=int(form.cleaned_data["expected_draft_version"]),
                    save_mode=SAVE_MODE_MANUAL,
                    equipment_refs=form.equipment_refs_by_key(),
                )
                messages.success(request, "Draft saved.")
                return redirect("recording:record_detail", record_id=record.id)
            except DraftConcurrencyConflict as exc:
                conflict = True
                _apply_validation_error(form, exc)
                messages.error(
                    request,
                    "Draft conflict: another tab or user saved first. "
                    "Reload and re-apply your changes. No silent last-write-wins.",
                )
            except ValidationError as exc:
                _apply_validation_error(form, exc)
    else:
        form = _form()

    return render(
        request,
        "recording/records/editor.html",
        {
            "record": record,
            "task": task,
            "sections": sections,
            "form": form,
            "completeness": completeness,
            "condition_flags": completeness.get("condition_flags") or {},
            "sample_indexes_by_group": sample_indexes_by_group,
            "children_by_parent": children_by_parent,
            "responses": responses,
            "response_field_name": response_field_name,
            "equipment_field_name": equipment_field_name,
            "ChecklistResponseType": ChecklistResponseType,
            "draft_conflict": conflict,
            "section_progress": section_progress,
            "autosave_url": reverse("recording:record_autosave", kwargs={"record_id": record.id}),
            "controlled_spec": get_controlled_form(task.checklist_template.code),
        },
    )


@login_required
@require_POST
def record_autosave(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    """
    Safe autosave — server authoritative; optimistic concurrency required.

    JSON response. Conflict → HTTP 409. No offline IndexedDB (Phase 14).
    """
    _require_recording_module(request)
    try:
        draft_context = load_record_editor_context(_actor(request), record_id)
    except PermissionDenied:
        raise
    if draft_context is None:
        return JsonResponse({"ok": False, "error": "not_found"}, status=404)

    record: ChecklistRecord = draft_context["record"]
    if record.status != ChecklistRecordStatus.DRAFT:
        return JsonResponse({"ok": False, "error": "not_draft"}, status=409)

    sections = draft_context["sections"]
    responses = draft_context["responses"]
    sample_indexes_by_group = draft_context["sample_indexes_by_group"]
    items = [item for section in sections for item in section.items.all()]
    initial = _initial_from_responses(responses, items)
    form = ChecklistDraftForm(
        request.POST,
        items=items,
        initial_responses=initial,
        sample_indexes_by_group=sample_indexes_by_group,
        draft_version=record.draft_version,
        equipment_choices=_equipment_choices_for_org(record.organization_id),
        initial_equipment=_initial_equipment(responses),
        form_code=record.checklist_task.checklist_template.code,
    )
    if not form.is_valid():
        return JsonResponse(
            {"ok": False, "error": "validation", "errors": form.errors.get_json_data()},
            status=400,
        )
    try:
        saved = save_checklist_draft_responses(
            actor=_actor(request),
            record_id=record.id,
            answers=form.answers_by_item_id(),
            expected_draft_version=int(form.cleaned_data["expected_draft_version"]),
            save_mode=SAVE_MODE_AUTOSAVE,
            equipment_refs=form.equipment_refs_by_key(),
        )
    except DraftConcurrencyConflict as exc:
        return JsonResponse(
            {
                "ok": False,
                "error": "conflict",
                "code": "draft_concurrency_conflict",
                "current_version": exc.current_version,
                "expected_version": exc.expected_version,
                "message": "Draft was updated elsewhere. Reload before saving.",
            },
            status=409,
        )
    except ValidationError as exc:
        payload = getattr(exc, "message_dict", None) or {"__all__": list(exc.messages)}
        return JsonResponse({"ok": False, "error": "validation", "errors": payload}, status=400)

    return JsonResponse(
        {
            "ok": True,
            "draft_version": saved.draft_version,
            "save_mode": SAVE_MODE_AUTOSAVE,
            "server_authoritative": True,
        }
    )


@login_required
@require_http_methods(["GET", "POST"])
def submit_confirm(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    try:
        context = load_record_editor_context(_actor(request), record_id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist record not found.")

    record: ChecklistRecord = context["record"]
    if record.status == ChecklistRecordStatus.SUBMITTED:
        return redirect("recording:record_submitted", record_id=record.id)

    task = context["task"]
    completeness = context["completeness"]
    missing = completeness["missing_required_items"]

    if request.method == "POST":
        if missing:
            messages.error(
                request,
                f"{len(missing)} required item(s) remain unanswered. "
                "Complete them before submitting.",
            )
            return redirect("recording:record_detail", record_id=record.id)
        try:
            submission = submit_checklist_record(actor=_actor(request), record_id=record.id)
        except ValidationError as exc:
            messages.error(request, "; ".join(exc.messages))
            return redirect("recording:record_detail", record_id=record.id)
        messages.success(
            request,
            f"Checklist submitted (Submission #{submission.submission_number}).",
        )
        return redirect("recording:record_submitted", record_id=record.id)

    return render(
        request,
        "recording/records/submit_confirm.html",
        {
            "record": record,
            "task": task,
            "completeness": completeness,
            "can_submit": not missing,
        },
    )


@login_required
@require_GET
def record_submitted(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    try:
        context = load_submitted_record_context(_actor(request), record_id)
    except PermissionDenied:
        raise
    if context is None:
        # May still be a draft — send to editor.
        try:
            draft = load_record_editor_context(_actor(request), record_id)
        except PermissionDenied:
            raise
        if draft is None:
            raise Http404("Checklist record not found.")
        return redirect("recording:record_detail", record_id=record_id)

    sections = context["sections"]
    snapshots = context["snapshot_responses"]
    rendered_sections = context.get("rendered_sections") or render_snapshot_sections(
        sections, snapshots
    )

    history = load_record_history_context(_actor(request), record_id)
    latest_submission = context["submission"]
    latest_review = None
    active_correction = None
    if history is not None:
        active_correction = history["active_correction"]
        for row in history["history_rows"]:
            if row["submission"].id == latest_submission.id:
                latest_review = row["review"]
                break

    return render(
        request,
        "recording/records/submitted.html",
        {
            "record": context["record"],
            "task": context["task"],
            "submission": latest_submission,
            "rendered_sections": rendered_sections,
            "latest_review": latest_review,
            "active_correction": active_correction,
            "history_rows": history["history_rows"] if history else [],
            "SupervisorReviewDecision": SupervisorReviewDecision,
            "ChecklistCorrectionStatus": ChecklistCorrectionStatus,
        },
    )


@login_required
@require_GET
def record_history(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    try:
        context = load_record_history_context(_actor(request), record_id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist record not found.")
    return render(
        request,
        "recording/records/history.html",
        context,
    )


@login_required
@require_GET
def returned_submission_detail(request: HttpRequest, submission_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    try:
        context = load_returned_submission_context(_actor(request), submission_id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist submission not found.")
    rendered_sections = context.get("rendered_sections") or render_snapshot_sections(
        context["sections"], context["snapshot_responses"]
    )
    return render(
        request,
        "recording/records/returned.html",
        {
            **context,
            "rendered_sections": rendered_sections,
        },
    )


@login_required
@require_POST
def start_correction(request: HttpRequest, submission_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    try:
        correction = start_checklist_correction(
            actor=_actor(request), source_submission_id=submission_id
        )
    except PermissionDenied:
        raise
    except ValidationError as exc:
        messages.error(request, _validation_message(exc))
        return redirect("recording:returned_submission", submission_id=submission_id)
    messages.success(
        request,
        (
            f"Correction draft ready for Submission "
            f"#{correction.source_submission.submission_number}."
        ),
    )
    return redirect("recording:correction_detail", correction_id=correction.id)


@login_required
@require_http_methods(["GET", "POST"])
def correction_detail(request: HttpRequest, correction_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    requested_counts: dict[uuid.UUID, int] | None = None
    if request.method == "POST":
        try:
            probe = load_correction_editor_context(_actor(request), correction_id)
        except PermissionDenied:
            raise
        if probe is not None:
            requested_counts = _parse_requested_sample_counts(
                request.POST, probe.get("groups") or []
            )

    try:
        context = load_correction_editor_context(
            _actor(request),
            correction_id,
            requested_sample_counts=requested_counts,
        )
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist correction not found.")

    correction = context["correction"]
    if correction.status == ChecklistCorrectionStatus.RESUBMITTED:
        return redirect("recording:correction_result", correction_id=correction.id)

    record = context["record"]
    sections = context["sections"]
    responses = context["responses"]
    completeness = context["completeness"]
    sample_indexes_by_group = context["sample_indexes_by_group"]
    items = [item for section in sections for item in section.items.all()]
    initial = _initial_from_responses(responses, items)

    if request.method == "POST" and request.POST.get("sample_action"):
        form = ChecklistDraftForm(
            request.POST,
            items=items,
            initial_responses=initial,
            sample_indexes_by_group=sample_indexes_by_group,
            draft_version=record.draft_version,
            equipment_choices=_equipment_choices_for_org(record.organization_id),
            initial_equipment=_initial_equipment(responses),
        )
        if not form.is_valid():
            form = ChecklistDraftForm(
                items=items,
                initial_responses=initial,
                sample_indexes_by_group=sample_indexes_by_group,
                draft_version=record.draft_version,
                equipment_choices=_equipment_choices_for_org(record.organization_id),
                initial_equipment=_initial_equipment(responses),
            )
    elif request.method == "POST":
        form = ChecklistDraftForm(
            request.POST,
            items=items,
            initial_responses=initial,
            sample_indexes_by_group=sample_indexes_by_group,
            draft_version=record.draft_version,
            equipment_choices=_equipment_choices_for_org(record.organization_id),
            initial_equipment=_initial_equipment(responses),
        )
        if form.is_valid():
            try:
                save_checklist_draft_responses(
                    actor=_actor(request),
                    record_id=record.id,
                    answers=form.answers_by_item_id(),
                    expected_draft_version=int(
                        form.cleaned_data.get("expected_draft_version") or record.draft_version
                    ),
                    save_mode=SAVE_MODE_MANUAL,
                    equipment_refs=form.equipment_refs_by_key(),
                )
                messages.success(request, "Correction draft saved.")
                return redirect("recording:correction_detail", correction_id=correction.id)
            except DraftConcurrencyConflict as exc:
                _apply_validation_error(form, exc)
                messages.error(request, "Draft conflict — reload and retry.")
            except ValidationError as exc:
                _apply_validation_error(form, exc)
    else:
        form = ChecklistDraftForm(
            items=items,
            initial_responses=initial,
            sample_indexes_by_group=sample_indexes_by_group,
            draft_version=record.draft_version,
            equipment_choices=_equipment_choices_for_org(record.organization_id),
            initial_equipment=_initial_equipment(responses),
        )

    return render(
        request,
        "recording/corrections/editor.html",
        {
            **context,
            "form": form,
            "condition_flags": completeness.get("condition_flags") or {},
            "response_field_name": response_field_name,
            "ChecklistResponseType": ChecklistResponseType,
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def correction_resubmit_confirm(request: HttpRequest, correction_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    try:
        context = load_correction_editor_context(_actor(request), correction_id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist correction not found.")

    correction = context["correction"]
    if correction.status == ChecklistCorrectionStatus.RESUBMITTED:
        return redirect("recording:correction_result", correction_id=correction.id)

    completeness = context["completeness"]
    missing = completeness["missing_required_items"]

    if request.method == "POST":
        if missing:
            messages.error(
                request,
                f"{len(missing)} required item(s) remain unanswered. "
                "Complete them before resubmitting.",
            )
            return redirect("recording:correction_detail", correction_id=correction.id)
        try:
            submission = resubmit_checklist_correction(
                actor=_actor(request), correction_id=correction.id
            )
        except ValidationError as exc:
            messages.error(request, _validation_message(exc))
            return redirect("recording:correction_detail", correction_id=correction.id)
        messages.success(
            request,
            f"Checklist resubmitted (Submission #{submission.submission_number}). "
            f"Source Submission #{correction.source_submission.submission_number} "
            "remains unchanged.",
        )
        return redirect("recording:record_submitted", record_id=submission.checklist_record_id)

    return render(
        request,
        "recording/corrections/resubmit_confirm.html",
        {
            **context,
            "can_resubmit": not missing,
        },
    )


@login_required
@require_GET
def correction_result(request: HttpRequest, correction_id: uuid.UUID) -> HttpResponse:
    _require_recording_module(request)
    try:
        correction = get_checklist_correction(_actor(request), correction_id)
    except PermissionDenied:
        raise
    if correction is None:
        raise Http404("Checklist correction not found.")
    if correction.status != ChecklistCorrectionStatus.RESUBMITTED:
        return redirect("recording:correction_detail", correction_id=correction.id)
    if correction.resulting_submission_id is None:
        raise Http404("Resulting submission not found.")
    return redirect(
        "recording:record_submitted",
        record_id=correction.checklist_record_id,
    )
