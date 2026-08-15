"""Daily Records workspace for SOURCE RECEIVED company forms."""

from __future__ import annotations

import uuid
from datetime import date
from typing import cast

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.checklists.controlled_forms import (
    COLD_ROOM_KEYS,
    CONTROLLED_FORMS,
    get_controlled_form,
)
from apps.recording.daily_selectors import (
    PAGE_SIZE,
    daily_queue_counts,
    history_queryset,
    list_today_records,
    monthly_pack_context,
    print_record_context,
)
from apps.recording.selectors import actor_can_access_recording_module
from apps.recording.services import start_checklist_recording
from apps.reports.csv_safe import render_csv
from apps.scheduling.selectors import organizations_for_task_record
from apps.scheduling.services import ensure_controlled_daily_task

CSV_EXPORT_ROW_LIMIT = 2000


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _require_recording(request: HttpRequest) -> None:
    if not actor_can_access_recording_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _validation_message(exc: ValidationError) -> str:
    if hasattr(exc, "message_dict"):
        parts: list[str] = []
        for messages_list in exc.message_dict.values():
            parts.extend(str(item) for item in messages_list)
        return "; ".join(parts)
    if hasattr(exc, "messages"):
        return "; ".join(str(item) for item in exc.messages)
    return str(exc)


def _parse_date(raw: str | None) -> date:
    if not raw:
        return timezone.localdate()
    try:
        return date.fromisoformat(raw.strip())
    except ValueError as exc:
        raise ValidationError({"date": "Enter a valid date (YYYY-MM-DD)."}) from exc


def _optional_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw.strip())
    except ValueError as exc:
        raise ValidationError({"date": "Enter a valid date (YYYY-MM-DD)."}) from exc


def _parse_year_month(raw: str) -> tuple[int, int]:
    try:
        year_text, month_text = raw.split("-", 1)
        year = int(year_text)
        month = int(month_text)
        # Reject invalid calendar months (e.g. 2026-99) via date construction.
        date(year, month, 1)
        return year, month
    except (TypeError, ValueError) as exc:
        raise ValidationError({"month": "Enter a valid month (YYYY-MM)."}) from exc


@login_required
@require_GET
def daily_records_home(request: HttpRequest) -> HttpResponse:
    _require_recording(request)
    try:
        record_date = _parse_date(request.GET.get("date"))
    except ValidationError as exc:
        messages.error(request, _validation_message(exc))
        return redirect("recording:daily_home")
    counts = daily_queue_counts(actor=_actor(request), record_date=record_date)
    return render(
        request,
        "recording/daily/home.html",
        {
            "page_title": "Daily Records",
            "record_date": record_date,
            "forms": CONTROLLED_FORMS,
            "cold_rooms": COLD_ROOM_KEYS,
            "counts": counts,
            "today_rows": list_today_records(actor=_actor(request), record_date=record_date),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def daily_record_open(request: HttpRequest, form_code: str) -> HttpResponse:
    _require_recording(request)
    spec = get_controlled_form(form_code) or get_controlled_form(form_code.replace("-", "/"))
    if spec is None:
        raise PermissionDenied("Unknown controlled form.")
    try:
        record_date = _parse_date(request.GET.get("date") or request.POST.get("date"))
    except ValidationError as exc:
        messages.error(request, _validation_message(exc))
        return redirect("recording:daily_home")
    room_key = (request.GET.get("room") or request.POST.get("room") or "").strip()
    if spec.code == "NMS/PPU/CL/39" and room_key not in COLD_ROOM_KEYS:
        room_key = "CR1"
    orgs = organizations_for_task_record(_actor(request))
    org = orgs.first()
    if org is None:
        raise PermissionDenied("Permission denied.")
    try:
        task = ensure_controlled_daily_task(
            actor=_actor(request),
            organization_id=org.id,
            form_code=spec.code,
            record_date=record_date,
            room_key=room_key if spec.code == "NMS/PPU/CL/39" else "",
        )
        record = start_checklist_recording(actor=_actor(request), task_id=task.id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
        return redirect("recording:daily_home")
    return redirect("recording:record_detail", record_id=record.id)


@login_required
@require_GET
def daily_record_print(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    _require_recording(request)
    context = print_record_context(actor=_actor(request), record_id=record_id)
    if context is None:
        raise PermissionDenied("Record not found.")
    return render(
        request,
        "recording/daily/print_record.html",
        {
            **context,
            "page_title": "Print record",
            "generated_at": timezone.now(),
        },
    )


@login_required
@require_GET
def daily_monthly_print(request: HttpRequest) -> HttpResponse:
    _require_recording(request)
    form_code = (request.GET.get("form") or "").strip()
    spec = get_controlled_form(form_code)
    month_raw = (request.GET.get("month") or timezone.localdate().strftime("%Y-%m")).strip()
    try:
        year, month = _parse_year_month(month_raw)
    except ValidationError as exc:
        messages.error(request, _validation_message(exc))
        return redirect("recording:daily_home")
    pack = monthly_pack_context(actor=_actor(request), form_code=form_code, year=year, month=month)
    return render(
        request,
        "recording/daily/print_monthly.html",
        {
            **pack,
            "spec": spec or pack.get("spec"),
            "page_title": "Monthly print pack",
            "generated_at": timezone.now(),
        },
    )


@login_required
@require_GET
def daily_record_history(request: HttpRequest) -> HttpResponse:
    _require_recording(request)
    try:
        date_from = _optional_date(request.GET.get("date_from"))
        date_to = _optional_date(request.GET.get("date_to"))
    except ValidationError as exc:
        messages.error(request, _validation_message(exc))
        return redirect("recording:daily_history")
    form_code = (request.GET.get("form") or "").strip()
    qs = history_queryset(
        actor=_actor(request),
        date_from=date_from,
        date_to=date_to,
        form_code=form_code,
        batch=(request.GET.get("batch") or "").strip(),
        vehicle=(request.GET.get("vehicle") or "").strip(),
        gin=(request.GET.get("gin") or "").strip(),
        cold_room=(request.GET.get("cold_room") or "").strip(),
        status=(request.GET.get("status") or "").strip(),
        recorder=(request.GET.get("recorder") or "").strip(),
    )
    page = Paginator(qs, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "recording/daily/history.html",
        {
            "page_title": "Record history",
            "page": page,
            "forms": CONTROLLED_FORMS,
            "csv_export_row_limit": CSV_EXPORT_ROW_LIMIT,
            "filters": {
                "date_from": request.GET.get("date_from") or "",
                "date_to": request.GET.get("date_to") or "",
                "form": form_code,
                "batch": request.GET.get("batch") or "",
                "vehicle": request.GET.get("vehicle") or "",
                "gin": request.GET.get("gin") or "",
                "cold_room": request.GET.get("cold_room") or "",
                "status": request.GET.get("status") or "",
                "recorder": request.GET.get("recorder") or "",
            },
        },
    )


@login_required
@require_GET
def daily_record_export_csv(request: HttpRequest) -> HttpResponse:
    _require_recording(request)
    try:
        date_from = _optional_date(request.GET.get("date_from"))
        date_to = _optional_date(request.GET.get("date_to"))
    except ValidationError as exc:
        messages.error(request, _validation_message(exc))
        return redirect("recording:daily_history")
    qs = history_queryset(
        actor=_actor(request),
        date_from=date_from,
        date_to=date_to,
        form_code=(request.GET.get("form") or "").strip(),
        batch=(request.GET.get("batch") or "").strip(),
        vehicle=(request.GET.get("vehicle") or "").strip(),
        gin=(request.GET.get("gin") or "").strip(),
        cold_room=(request.GET.get("cold_room") or "").strip(),
        status=(request.GET.get("status") or "").strip(),
        recorder=(request.GET.get("recorder") or "").strip(),
    )
    fetched = list(qs[: CSV_EXPORT_ROW_LIMIT + 1])
    truncated = len(fetched) > CSV_EXPORT_ROW_LIMIT
    records = fetched[:CSV_EXPORT_ROW_LIMIT]
    headers = (
        "record_id",
        "form_code",
        "batch_reference",
        "organization",
        "status",
        "recorder",
        "updated_at",
    )
    rows = [
        {
            "record_id": str(record.id),
            "form_code": record.checklist_task.checklist_template.code,
            "batch_reference": record.checklist_task.batch_reference,
            "organization": record.organization.code,
            "status": record.status,
            "recorder": record.started_by.employee_code,
            "updated_at": record.updated_at.isoformat(),
        }
        for record in records
    ]
    if truncated:
        rows.append(
            {
                "record_id": f"EXPORT TRUNCATED AT {CSV_EXPORT_ROW_LIMIT} ROWS",
                "form_code": "",
                "batch_reference": "",
                "organization": "",
                "status": "",
                "recorder": "",
                "updated_at": "",
            }
        )
    payload = render_csv(headers=headers, rows=rows)
    response = HttpResponse(payload, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="daily-record-history.csv"'
    response["X-Export-Max-Rows"] = str(CSV_EXPORT_ROW_LIMIT)
    if truncated:
        response["X-Export-Truncated"] = "true"
    return response
