"""Thin JSON API for the MaintainPro Next.js FG UI.

Wraps existing selectors/services. Does not duplicate uniqueness, workflow, SoD,
or audit rules. CSRF remains enabled — no csrf_exempt.
"""

from __future__ import annotations

import json
import uuid
from functools import wraps
from typing import Any, Callable, cast

from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import HttpRequest, HttpResponse, QueryDict
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods

from apps.access_control.maintainpro_bridge import assert_fg_permission
from apps.accounts.models import User
from apps.accounts.sso import (
    FG_SSO_ASSERTION_COOKIE,
    establish_fg_session,
    reject_forged_identity_headers,
    verify_fg_sso_assertion,
)
from apps.checklists.controlled_forms import (
    COLD_ROOM_KEYS,
    CONTROLLED_FORMS,
    controlled_form_multiplicity,
    get_controlled_form,
)
from apps.checklists.models import ChecklistItemKind
from apps.integrations.maintainpro.exceptions import MaintainProReferenceError
from apps.integrations.maintainpro.reference_service import (
    MaintainProReferenceService,
    resolve_maintainpro_tenant_id,
)
from apps.quality.models import QAReviewDecision
from apps.quality.selectors import (
    actor_can_access_qa_module,
    list_qa_reviewable_submissions,
    load_qa_submission_context,
)
from apps.quality.services import create_qa_review
from apps.recording.daily_selectors import (
    PAGE_SIZE,
    daily_queue_counts,
    history_queryset,
    list_today_records,
)
from apps.recording.daily_views import _optional_date, _parse_date, _require_recording
from apps.recording.forms import ChecklistDraftForm, equipment_field_name, response_field_name
from apps.recording.json_api import json_error, json_ok, validation_field_errors
from apps.recording.concurrency import DraftConcurrencyConflict, SAVE_MODE_AUTOSAVE
from apps.recording.models import ChecklistRecordStatus
from apps.recording.selectors import (
    load_record_editor_context,
    load_submitted_record_context,
)
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.recording.views import (
    _equipment_choices_for_org,
    _initial_equipment,
    _initial_from_responses,
)
from apps.reviews.models import SupervisorReviewDecision
from apps.reviews.selectors import (
    actor_can_access_review_module,
    list_supervisor_reviewable_submissions,
    load_submission_review_context,
)
from apps.reviews.services import create_supervisor_review
from apps.scheduling.selectors import organizations_for_task_record
from apps.scheduling.services import ensure_controlled_daily_task

PRINT_PATH_TEMPLATE = "/daily-records/print/{record_id}/"


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _json_auth(view: Callable[..., HttpResponse]) -> Callable[..., HttpResponse]:
    @wraps(view)
    def wrapped(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        if not request.user.is_authenticated:
            return json_error("UNAUTHENTICATED", "Authentication required.", status=401)
        return view(request, *args, **kwargs)

    return wrapped


def _safe_message(exc: BaseException) -> str:
    text = str(exc).strip() or "Request failed."
    lowered = text.lower()
    if any(
        token in lowered
        for token in ("traceback", "operationalerror", "mongodb", "secret", "password")
    ):
        return "Request failed."
    return text[:500]


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _user_payload(user: Any) -> dict[str, Any] | None:
    if user is None:
        return None
    return {
        "id": str(user.id),
        "employeeCode": getattr(user, "employee_code", None) or "",
        "email": getattr(user, "email", "") or "",
    }


def _is_vehicle_field(code: str, label: str) -> bool:
    blob = f"{code} {label}".lower()
    return "vehicle" in blob or "truck no" in blob or "freezer truck" in blob


def _form_payload(spec: Any) -> dict[str, Any]:
    return {
        "code": spec.code,
        "title": spec.title,
        "issued": spec.issued,
        "revision": spec.revision,
        "multiplicity": controlled_form_multiplicity(spec.code),
        "requiresRoom": spec.code == "NMS/PPU/CL/39",
        "vehicleLookup": spec.code in {"NMS/PPU/CL/18", "NMS/PPU/CL/30"},
        "printOrientation": spec.print_orientation,
    }


def _bucket_status_label(bucket: str) -> str:
    return {
        "pending": "IN PROGRESS",
        "awaiting_check": "REVIEW",
        "needs_correction": "NEEDS ATTENTION",
        "awaiting_verification": "QA",
        "completed": "COMPLETED",
    }.get(bucket, bucket.replace("_", " ").upper())


def _record_summary(record: Any, *, bucket: str = "", submission: Any = None) -> dict[str, Any]:
    task = record.checklist_task
    spec = get_controlled_form(task.checklist_template.code)
    review = getattr(submission, "supervisor_review", None) if submission else None
    qa = getattr(submission, "qa_review", None) if submission else None
    return {
        "id": str(record.id),
        "status": record.status,
        "bucket": bucket or None,
        "statusLabel": _bucket_status_label(bucket) if bucket else record.status,
        "formCode": task.checklist_template.code,
        "formTitle": spec.title if spec else task.checklist_template.name,
        "batchReference": task.batch_reference,
        "organizationCode": record.organization.code,
        "recorder": _user_payload(record.started_by),
        "updatedAt": _iso(record.updated_at),
        "startedAt": _iso(getattr(record, "started_at", None) or getattr(record, "created_at", None)),
        "readOnly": record.status == ChecklistRecordStatus.SUBMITTED,
        "printPath": PRINT_PATH_TEMPLATE.format(record_id=record.id),
        "supervisor": {
            "decision": getattr(review, "decision", None),
            "reviewedBy": _user_payload(getattr(review, "reviewed_by", None)),
            "reviewedAt": _iso(getattr(review, "reviewed_at", None)),
        }
        if review
        else None,
        "qa": {
            "decision": getattr(qa, "decision", None),
            "reviewedBy": _user_payload(getattr(qa, "reviewed_by", None)),
            "reviewedAt": _iso(getattr(qa, "reviewed_at", None)),
        }
        if qa
        else None,
    }


def _choice_labels(form_code: str) -> tuple[str, str]:
    if form_code == "NMS/PPU/CL/24":
        return "Acceptable", "Unacceptable"
    if form_code in {"NMS/PPU/CL/30", "NMS/PPU/CL/18"}:
        return "PASS", "FAIL"
    return "Yes", "No"


def _serialize_item(
    item: Any,
    *,
    sample_index: int,
    form_code: str,
    initial: dict[Any, Any],
    equipment: dict[Any, Any],
) -> dict[str, Any]:
    field_name = response_field_name(item.id, sample_index)
    yes_label, no_label = _choice_labels(form_code)
    options: list[dict[str, str]] = []
    if item.response_type in {"YES_NO", "YES_NO_NA"}:
        options = [{"value": "YES", "label": yes_label}, {"value": "NO", "label": no_label}]
        if item.response_type == "YES_NO_NA":
            options.append({"value": "NA", "label": "N/A"})
    elif item.response_type == "SELECT":
        options = [
            {"value": str(opt.id), "label": opt.label} for opt in item.options.all()
        ]
    raw = initial.get((item.id, sample_index))
    value = "" if raw is None else str(raw)
    return {
        "id": str(item.id),
        "code": item.code,
        "label": item.label,
        "helpText": item.help_text or "",
        "kind": item.item_kind,
        "required": bool(item.is_required),
        "responseType": item.response_type,
        "sampleIndex": sample_index,
        "fieldName": field_name,
        "equipmentFieldName": equipment_field_name(item.id, sample_index)
        if getattr(item, "requires_equipment_reference", False)
        else None,
        "equipmentValue": equipment.get((item.id, sample_index)) or "",
        "value": value,
        "options": options,
        "isVehicleField": _is_vehicle_field(item.code, item.label),
    }


def _serialize_editor(ctx: dict[str, Any]) -> dict[str, Any]:
    record = ctx["record"]
    form_code = record.checklist_task.checklist_template.code
    items = [item for section in ctx["sections"] for item in section.items.all()]
    initial = _initial_from_responses(ctx["responses"], items)
    equipment = _initial_equipment(list(ctx["responses"].values()))
    completeness = ctx["completeness"]
    sections_out: list[dict[str, Any]] = []
    for section in ctx["sections"]:
        section_items = list(section.items.all())
        fields: list[dict[str, Any]] = []
        for item in section_items:
            if item.parent_item_id is not None:
                continue
            if item.item_kind == ChecklistItemKind.REPEATING_GROUP:
                indexes = ctx["sample_indexes_by_group"].get(item.id) or [1]
                children = ctx["children_by_parent"].get(item.id) or []
                fields.append(
                    {
                        "id": str(item.id),
                        "code": item.code,
                        "label": item.label,
                        "kind": item.item_kind,
                        "sampleIndexes": indexes,
                        "children": [
                            _serialize_item(
                                child,
                                sample_index=sample_index,
                                form_code=form_code,
                                initial=initial,
                                equipment=equipment,
                            )
                            for sample_index in indexes
                            for child in children
                            if child.item_kind != ChecklistItemKind.REPEATING_GROUP
                        ],
                    }
                )
                continue
            fields.append(
                _serialize_item(
                    item,
                    sample_index=1,
                    form_code=form_code,
                    initial=initial,
                    equipment=equipment,
                )
            )
        sections_out.append(
            {
                "id": str(section.id),
                "title": section.title,
                "fields": fields,
            }
        )
    missing = [
        {"id": str(item.id), "code": item.code, "label": item.label}
        for item in (completeness.get("missing_required_items") or [])
    ]
    return {
        "draftVersion": record.draft_version,
        "expectedDraftVersion": record.draft_version,
        "completeness": {
            "totalItems": completeness.get("total_items") or 0,
            "requiredItems": completeness.get("required_items") or 0,
            "answeredItems": completeness.get("answered_items") or 0,
            "answeredRequiredItems": completeness.get("answered_required_items") or 0,
            "missingRequired": missing,
        },
        "equipmentChoices": [
            {"value": value, "label": label}
            for value, label in _equipment_choices_for_org(record.organization_id)
        ],
        "sections": sections_out,
    }


def _item_code_label(item: Any) -> tuple[str, str]:
    if item is None:
        return "", ""
    return str(getattr(item, "code", "") or ""), str(getattr(item, "label", "") or "")


def _snapshot_cell(row: dict[str, Any]) -> dict[str, Any]:
    code, label = _item_code_label(row.get("item"))
    return {
        "code": code,
        "label": label,
        "value": row.get("display_value") or "",
        "sampleIndex": row.get("sample_index") or 1,
        "answered": bool(row.get("answered")),
    }


def _serialize_rendered_sections(rendered: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for section in rendered:
        items: list[dict[str, Any]] = []
        for item in section.get("items") or []:
            if item.get("kind") == "repeating_group":
                code, label = _item_code_label(item.get("item"))
                children: list[dict[str, Any]] = []
                for sample_row in item.get("sample_rows") or []:
                    for child in sample_row.get("children") or []:
                        children.append(_snapshot_cell(child))
                items.append(
                    {
                        "code": code,
                        "label": label,
                        "kind": "REPEATING_GROUP",
                        "children": children,
                    }
                )
            else:
                items.append(_snapshot_cell(item))
        section_obj = section.get("section")
        title = getattr(section_obj, "title", None) or section.get("title") or ""
        out.append({"title": title, "items": items})
    return out


def _read_json_body(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValidationError({"body": "Invalid JSON body."}) from exc
    if not isinstance(payload, dict):
        raise ValidationError({"body": "JSON object required."})
    return payload


def _require_review(request: HttpRequest) -> None:
    assert_fg_permission(request, "fg.review.view")
    if not actor_can_access_review_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _require_qa(request: HttpRequest) -> None:
    assert_fg_permission(request, "fg.qa.view")
    if not actor_can_access_qa_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


@ensure_csrf_cookie
@require_GET
def api_session(request: HttpRequest) -> HttpResponse:
    reject_forged_identity_headers(request)
    if request.user.is_authenticated:
        return json_ok(
            {
                "authenticated": True,
                "csrfToken": get_token(request),
                "actor": _user_payload(_actor(request)),
            }
        )
    assertion = request.COOKIES.get(FG_SSO_ASSERTION_COOKIE, "")
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        assertion = auth.split(" ", 1)[1].strip() or assertion
    if not assertion:
        return json_error("UNAUTHENTICATED", "FG SSO assertion required.", status=401)
    try:
        claims = verify_fg_sso_assertion(assertion)
        establish_fg_session(request, claims)
    except PermissionDenied:
        return json_error("FORBIDDEN", "FG access denied.", status=403)
    response = json_ok(
        {
            "authenticated": True,
            "csrfToken": get_token(request),
            "actor": _user_payload(_actor(request)),
        }
    )
    response.delete_cookie(FG_SSO_ASSERTION_COOKIE, path="/fg")
    response.delete_cookie(FG_SSO_ASSERTION_COOKIE, path="/")
    return response


@ensure_csrf_cookie
@_json_auth
@require_GET
def api_dashboard(request: HttpRequest) -> HttpResponse:
    try:
        _require_recording(request)
        record_date = _parse_date(request.GET.get("date"))
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    except ValidationError as exc:
        return json_error("VALIDATION", "Invalid date.", status=400, field_errors=validation_field_errors(exc))
    counts = daily_queue_counts(actor=_actor(request), record_date=record_date)
    today_rows = list_today_records(actor=_actor(request), record_date=record_date)
    by_code: dict[str, dict[str, Any]] = {}
    for row in today_rows:
        code = row["task"].checklist_template.code
        by_code[code] = _record_summary(row["record"], bucket=row["bucket"], submission=row["submission"])
    forms = []
    for spec in CONTROLLED_FORMS:
        today = by_code.get(spec.code)
        forms.append(
            {
                **_form_payload(spec),
                "todayRecord": today,
                "statusLabel": today["statusLabel"] if today else "NOT STARTED",
            }
        )
    return json_ok(
        {
            "date": record_date.isoformat(),
            "kpis": {
                "todayRecords": counts.today,
                "draftInProgress": counts.pending,
                "pendingSupervisor": counts.awaiting_check,
                "pendingQa": counts.awaiting_verification,
                "completed": counts.completed,
                "needsAttention": counts.needs_correction,
            },
            "forms": forms,
            "todayRecords": [
                _record_summary(row["record"], bucket=row["bucket"], submission=row["submission"])
                for row in today_rows
            ],
            "coldRooms": list(COLD_ROOM_KEYS),
            "workflow": [
                "RECORDING",
                "SUBMITTED",
                "SUPERVISOR_REVIEW",
                "QA_REVIEW",
                "COMPLETED",
            ],
        }
    )


@_json_auth
@require_http_methods(["POST"])
def api_record_open(request: HttpRequest) -> HttpResponse:
    try:
        _require_recording(request)
        payload = _read_json_body(request)
        form_code = str(payload.get("formCode") or payload.get("form_code") or "").strip()
        spec = get_controlled_form(form_code) or get_controlled_form(form_code.replace("-", "/"))
        if spec is None:
            return json_error("NOT_FOUND", "Unknown controlled form.", status=404)
        record_date = _parse_date(str(payload.get("date") or "") or None)
        room_key = str(payload.get("room") or "").strip()
        occurrence_token = str(payload.get("occurrenceToken") or payload.get("occurrence_token") or "").strip()
        if spec.code == "NMS/PPU/CL/39" and room_key not in COLD_ROOM_KEYS:
            room_key = "CR1"
        orgs = organizations_for_task_record(_actor(request))
        org = orgs.first()
        if org is None:
            raise PermissionDenied("Permission denied.")
        task = ensure_controlled_daily_task(
            actor=_actor(request),
            organization_id=org.id,
            form_code=spec.code,
            record_date=record_date,
            room_key=room_key if spec.code == "NMS/PPU/CL/39" else "",
            occurrence_token=occurrence_token,
        )
        record = start_checklist_recording(actor=_actor(request), task_id=task.id)
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    except ValidationError as exc:
        return json_error(
            "VALIDATION",
            _safe_message(exc),
            status=400,
            field_errors=validation_field_errors(exc),
        )
    return json_ok({"record": _record_summary(record), "idempotent": True})


def _load_record_payload(request: HttpRequest, record_id: uuid.UUID) -> dict[str, Any] | HttpResponse:
    submitted = load_submitted_record_context(_actor(request), record_id)
    if submitted is not None:
        record = submitted["record"]
        return {
            "record": _record_summary(record, submission=submitted.get("submission")),
            "readOnly": True,
            "editor": None,
            "snapshot": _serialize_rendered_sections(submitted.get("rendered_sections") or []),
            "actions": {
                "canEdit": False,
                "canSubmit": False,
                "canPrint": True,
            },
        }
    ctx = load_record_editor_context(_actor(request), record_id)
    if ctx is None:
        return json_error("NOT_FOUND", "Record not found.", status=404)
    record = ctx["record"]
    return {
        "record": _record_summary(record),
        "readOnly": record.status != ChecklistRecordStatus.DRAFT,
        "editor": _serialize_editor(ctx),
        "snapshot": None,
        "actions": {
            "canEdit": record.status == ChecklistRecordStatus.DRAFT,
            "canSubmit": record.status == ChecklistRecordStatus.DRAFT,
            "canPrint": True,
        },
    }


@ensure_csrf_cookie
@_json_auth
@require_GET
def api_record_detail(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    try:
        _require_recording(request)
        payload = _load_record_payload(request, record_id)
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    if isinstance(payload, HttpResponse):
        return payload
    return json_ok(payload)


@_json_auth
@require_http_methods(["POST"])
def api_record_save(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    try:
        assert_fg_permission(request, "fg.recording.edit")
        _require_recording(request)
        payload = _read_json_body(request)
        ctx = load_record_editor_context(_actor(request), record_id)
        if ctx is None:
            return json_error("NOT_FOUND", "Record not found.", status=404)
        record = ctx["record"]
        if record.status != ChecklistRecordStatus.DRAFT:
            return json_error("IMMUTABLE", "Completed records cannot be edited.", status=409)
        sections = ctx["sections"]
        items = [item for section in sections for item in section.items.all()]
        initial = _initial_from_responses(ctx["responses"], items)
        fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else {}
        post = QueryDict(mutable=True)
        expected = payload.get("expectedDraftVersion") or payload.get("expected_draft_version")
        post["expected_draft_version"] = str(expected if expected is not None else record.draft_version)
        for key, value in fields.items():
            post[str(key)] = "" if value is None else str(value)
        form = ChecklistDraftForm(
            post,
            items=items,
            initial_responses=initial,
            sample_indexes_by_group=ctx["sample_indexes_by_group"],
            draft_version=record.draft_version,
            equipment_choices=_equipment_choices_for_org(record.organization_id),
            initial_equipment=_initial_equipment(list(ctx["responses"].values())),
            form_code=record.checklist_task.checklist_template.code,
        )
        if not form.is_valid():
            return json_error(
                "VALIDATION",
                "Please correct the highlighted fields.",
                status=400,
                field_errors={key: [str(err) for err in errs] for key, errs in form.errors.items()},
            )
        saved = save_checklist_draft_responses(
            actor=_actor(request),
            record_id=record.id,
            answers=form.answers_by_item_id(),
            expected_draft_version=int(form.cleaned_data["expected_draft_version"]),
            save_mode=SAVE_MODE_AUTOSAVE,
            equipment_refs=form.equipment_refs_by_key(),
        )
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    except DraftConcurrencyConflict as exc:
        return json_error(
            "CONFLICT",
            "Draft was updated elsewhere. Reload before saving.",
            status=409,
            field_errors={
                "expectedDraftVersion": [str(exc.current_version)],
            },
        )
    except ValidationError as exc:
        return json_error(
            "VALIDATION",
            _safe_message(exc),
            status=400,
            field_errors=validation_field_errors(exc),
        )
    return json_ok({"draftVersion": saved.draft_version, "serverAuthoritative": True})


@_json_auth
@require_http_methods(["POST"])
def api_record_submit(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    try:
        assert_fg_permission(request, "fg.recording.submit")
        _require_recording(request)
        payload = _read_json_body(request)
        key = str(payload.get("idempotencyKey") or payload.get("idempotency_key") or "").strip()
        submission = submit_checklist_record(
            actor=_actor(request),
            record_id=record_id,
            idempotency_key=key,
        )
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    except ValidationError as exc:
        return json_error(
            "VALIDATION",
            _safe_message(exc),
            status=400,
            field_errors=validation_field_errors(exc),
        )
    record = submission.checklist_record
    return json_ok(
        {
            "submissionId": str(submission.id),
            "submissionNumber": submission.submission_number,
            "record": _record_summary(record, submission=submission),
        }
    )


@ensure_csrf_cookie
@_json_auth
@require_GET
def api_history(request: HttpRequest) -> HttpResponse:
    try:
        _require_recording(request)
        date_from = _optional_date(request.GET.get("dateFrom") or request.GET.get("date_from"))
        date_to = _optional_date(request.GET.get("dateTo") or request.GET.get("date_to"))
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    except ValidationError as exc:
        return json_error("VALIDATION", "Invalid filters.", status=400, field_errors=validation_field_errors(exc))
    qs = history_queryset(
        actor=_actor(request),
        date_from=date_from,
        date_to=date_to,
        form_code=(request.GET.get("formCode") or request.GET.get("form") or "").strip(),
        batch=(request.GET.get("batch") or "").strip(),
        vehicle=(request.GET.get("vehicle") or "").strip(),
        gin=(request.GET.get("gin") or "").strip(),
        cold_room=(request.GET.get("coldRoom") or request.GET.get("cold_room") or "").strip(),
        status=(request.GET.get("status") or "").strip(),
        recorder=(request.GET.get("recorder") or "").strip(),
    )
    page = Paginator(qs, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return json_ok(
        {
            "records": [_record_summary(record) for record in page.object_list],
            "forms": [_form_payload(spec) for spec in CONTROLLED_FORMS],
        },
        meta={
            "page": page.number,
            "pageSize": PAGE_SIZE,
            "hasNext": page.has_next(),
            "hasPrevious": page.has_previous(),
            "count": page.paginator.count,
        },
    )


def _submission_row(submission: Any) -> dict[str, Any]:
    record = submission.checklist_record
    task = record.checklist_task
    spec = get_controlled_form(task.checklist_template.code)
    return {
        "id": str(submission.id),
        "recordId": str(record.id),
        "formCode": task.checklist_template.code,
        "formTitle": spec.title if spec else task.checklist_template.name,
        "batchReference": task.batch_reference,
        "status": record.status,
        "recorder": _user_payload(record.started_by),
        "submittedAt": _iso(submission.submitted_at),
        "submittedBy": _user_payload(submission.submitted_by),
        "printPath": PRINT_PATH_TEMPLATE.format(record_id=record.id),
    }


@ensure_csrf_cookie
@_json_auth
@require_GET
def api_review_queue(request: HttpRequest) -> HttpResponse:
    try:
        _require_review(request)
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    qs = list_supervisor_reviewable_submissions(_actor(request))
    page = Paginator(qs, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return json_ok(
        {"submissions": [_submission_row(row) for row in page.object_list]},
        meta={"page": page.number, "pageSize": PAGE_SIZE, "hasNext": page.has_next()},
    )


@ensure_csrf_cookie
@_json_auth
@require_GET
def api_review_detail(request: HttpRequest, submission_id: uuid.UUID) -> HttpResponse:
    try:
        _require_review(request)
        context = load_submission_review_context(_actor(request), submission_id)
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    if context is None:
        return json_error("NOT_FOUND", "Submission not found.", status=404)
    governance = context.get("governance") or {}
    self_review = governance.get("self_review")
    blocked = bool(getattr(self_review, "blocked", False))
    existing = context.get("review")
    return json_ok(
        {
            "submission": _submission_row(context["submission"]),
            "record": _record_summary(context["record"], submission=context["submission"]),
            "snapshot": _serialize_rendered_sections(context.get("rendered_sections") or []),
            "review": {
                "id": str(existing.id),
                "decision": existing.decision,
                "reviewedBy": _user_payload(existing.reviewed_by),
                "reviewedAt": _iso(existing.reviewed_at),
                "note": existing.review_note,
            }
            if existing
            else None,
            "selfReview": {
                "blocked": blocked,
                "isSelfReview": bool(getattr(self_review, "is_self_review", False)),
                "message": "Self-review is prohibited by owner-approved governance policy."
                if blocked
                else "",
            },
            "actions": {
                "canDecide": existing is None and not blocked,
                "decisions": [
                    SupervisorReviewDecision.APPROVED,
                    SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
                ],
            },
        }
    )


@_json_auth
@require_http_methods(["POST"])
def api_review_decision(request: HttpRequest, submission_id: uuid.UUID) -> HttpResponse:
    try:
        assert_fg_permission(request, "fg.review.perform")
        _require_review(request)
        payload = _read_json_body(request)
        decision = str(payload.get("decision") or "").strip()
        if decision not in {
            SupervisorReviewDecision.APPROVED,
            SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        }:
            return json_error("VALIDATION", "Unknown supervisor decision.", status=400)
        context = load_submission_review_context(_actor(request), submission_id)
        if context is None:
            return json_error("NOT_FOUND", "Submission not found.", status=404)
        if context.get("review") is not None:
            return json_error("CONFLICT", "This submission already has a Supervisor review.", status=409)
        governance = context.get("governance") or {}
        self_review = governance.get("self_review")
        if self_review is not None and getattr(self_review, "blocked", False):
            return json_error(
                "SELF_REVIEW_BLOCKED",
                "Self-review is prohibited by owner-approved governance policy.",
                status=403,
            )
        review = create_supervisor_review(
            actor=_actor(request),
            submission_id=submission_id,
            decision=decision,
            review_note=str(payload.get("reviewNote") or payload.get("review_note") or ""),
            idempotency_key=str(payload.get("idempotencyKey") or ""),
        )
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    except ValidationError as exc:
        return json_error(
            "VALIDATION",
            _safe_message(exc),
            status=400,
            field_errors=validation_field_errors(exc),
        )
    return json_ok(
        {
            "id": str(review.id),
            "decision": review.decision,
            "reviewedAt": _iso(review.reviewed_at),
        }
    )


@ensure_csrf_cookie
@_json_auth
@require_GET
def api_qa_queue(request: HttpRequest) -> HttpResponse:
    try:
        _require_qa(request)
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    qs = list_qa_reviewable_submissions(_actor(request))
    page = Paginator(qs, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return json_ok(
        {"submissions": [_submission_row(row) for row in page.object_list]},
        meta={"page": page.number, "pageSize": PAGE_SIZE, "hasNext": page.has_next()},
    )


@ensure_csrf_cookie
@_json_auth
@require_GET
def api_qa_detail(request: HttpRequest, submission_id: uuid.UUID) -> HttpResponse:
    try:
        _require_qa(request)
        context = load_qa_submission_context(_actor(request), submission_id)
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    if context is None:
        return json_error("NOT_FOUND", "Submission not found.", status=404)
    existing = context.get("qa_review")
    supervisor = context.get("supervisor_review") or context.get("supervisor")
    return json_ok(
        {
            "submission": _submission_row(context["submission"]),
            "record": _record_summary(context["record"], submission=context["submission"]),
            "snapshot": _serialize_rendered_sections(context.get("rendered_sections") or []),
            "supervisor": {
                "decision": getattr(supervisor, "decision", None),
                "reviewedBy": _user_payload(getattr(supervisor, "reviewed_by", None)),
            }
            if supervisor
            else None,
            "qaReview": {
                "id": str(existing.id),
                "decision": existing.decision,
                "reviewedBy": _user_payload(existing.reviewed_by),
                "reviewedAt": _iso(existing.reviewed_at),
                "note": existing.review_note,
            }
            if existing
            else None,
            "actions": {
                "canDecide": existing is None,
                "decisions": [
                    QAReviewDecision.RELEASE,
                    QAReviewDecision.HOLD,
                    QAReviewDecision.REJECT,
                ],
            },
        }
    )


@_json_auth
@require_http_methods(["POST"])
def api_qa_decision(request: HttpRequest, submission_id: uuid.UUID) -> HttpResponse:
    try:
        assert_fg_permission(request, "fg.qa.disposition")
        _require_qa(request)
        payload = _read_json_body(request)
        decision = str(payload.get("decision") or "").strip()
        if decision not in QAReviewDecision.values:
            return json_error("VALIDATION", "Unknown QA decision.", status=400)
        context = load_qa_submission_context(_actor(request), submission_id)
        if context is None:
            return json_error("NOT_FOUND", "Submission not found.", status=404)
        if context.get("qa_review") is not None:
            return json_error("CONFLICT", "This submission already has a QA review.", status=409)
        review = create_qa_review(
            actor=_actor(request),
            submission_id=submission_id,
            decision=decision,
            review_note=str(payload.get("reviewNote") or payload.get("review_note") or ""),
            idempotency_key=str(payload.get("idempotencyKey") or ""),
        )
    except PermissionDenied:
        return json_error("FORBIDDEN", "Permission denied.", status=403)
    except ValidationError as exc:
        return json_error(
            "VALIDATION",
            _safe_message(exc),
            status=400,
            field_errors=validation_field_errors(exc),
        )
    return json_ok(
        {
            "id": str(review.id),
            "decision": review.decision,
            "reviewedAt": _iso(review.reviewed_at),
        }
    )


@ensure_csrf_cookie
@_json_auth
@require_GET
def api_vehicles(request: HttpRequest) -> HttpResponse:
    if not _actor(request).is_authenticated:
        return json_error("UNAUTHENTICATED", "Authentication required.", status=401)
    org = organizations_for_task_record(_actor(request)).first()
    query = (request.GET.get("q") or "").strip()
    form_code = (request.GET.get("formCode") or request.GET.get("form_code") or "").strip()
    allowed_types: frozenset[str] | None = None
    if form_code.upper() == "NMS/PPU/CL/30":
        allowed_types = frozenset({"TRUCK"})
    type_param = (request.GET.get("type") or "").strip().upper()
    if type_param:
        allowed_types = frozenset({type_param})
    try:
        tenant_id = resolve_maintainpro_tenant_id(organization=org)
        results = MaintainProReferenceService().search_vehicles(
            tenant_id=tenant_id,
            query=query,
            limit=15,
            allowed_types=allowed_types,
        )
    except MaintainProReferenceError:
        return json_error("UPSTREAM_UNAVAILABLE", "Vehicle lookup is temporarily unavailable.", status=503)
    payload = []
    for row in results:
        selectable, reason = row.eligibility_for_new_record(allowed_types=allowed_types)
        payload.append(
            {
                "id": row.id,
                "registrationNo": row.registration_no,
                "make": row.make,
                "vehicleModel": row.vehicle_model,
                "status": row.status,
                "assetTag": row.asset_tag,
                "type": row.vehicle_type,
                "label": row.label,
                "selectable": selectable,
                "unavailable": not selectable,
                "unavailableReason": reason,
            }
        )
    return json_ok({"results": payload})
