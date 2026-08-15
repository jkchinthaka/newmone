"""Dispatch quality operator workspace — Phase 13 services only."""

from __future__ import annotations

import uuid
from typing import cast

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.dispatch.models import DispatchQualityRecord, DispatchRecordStatus
from apps.dispatch.selectors import (
    actor_can_access_dispatch_module,
    list_dispatch_history,
    list_dispatch_records_for_actor,
    organizations_for_dispatch_view,
)
from apps.dispatch.services import create_dispatch_quality_record, evaluate_release_gate

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _require_dispatch(request: HttpRequest) -> None:
    if not actor_can_access_dispatch_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _load(record_id: uuid.UUID) -> DispatchQualityRecord:
    record = (
        DispatchQualityRecord.objects.select_related(
            "organization", "owner", "created_by", "qa_review"
        )
        .filter(pk=record_id)
        .first()
    )
    if record is None:
        raise Http404("Dispatch record not found.")
    return record


@login_required
@require_GET
def dispatch_list(request: HttpRequest) -> HttpResponse:
    _require_dispatch(request)
    rows = list_dispatch_records_for_actor(actor=_actor(request))
    status = (request.GET.get("status") or "").strip()
    if status:
        rows = rows.filter(status=status)
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "dispatch/list.html",
        {
            "page_title": "Dispatch quality",
            "page": page,
            "status": status,
            "status_choices": DispatchRecordStatus.choices,
            "can_create": organizations_for_dispatch_view(_actor(request)).exists(),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def dispatch_create(request: HttpRequest) -> HttpResponse:
    _require_dispatch(request)
    org = organizations_for_dispatch_view(_actor(request)).first()
    if org is None:
        raise PermissionDenied("Permission denied.")
    if request.method == "POST":
        try:
            record = create_dispatch_quality_record(
                actor=_actor(request),
                organization=org,
                code=request.POST.get("code") or "",
                maintainpro_vehicle_id=request.POST.get("maintainpro_vehicle_id") or "",
                vehicle_reference=request.POST.get("vehicle_query")
                or request.POST.get("vehicle_reference")
                or "",
                delivery_loading_reference=request.POST.get("delivery_loading_reference") or "",
                batch_reference=request.POST.get("batch_reference") or "",
                notes=request.POST.get("notes") or "",
                idempotency_key=request.POST.get("idempotency_key")
                or request.headers.get("Idempotency-Key")
                or "",
            )
            messages.success(request, "Dispatch quality record opened.")
            return redirect("dispatch:detail", record_id=record.id)
        except (ValidationError, PermissionDenied) as exc:
            messages.error(request, str(exc))
    from django.urls import reverse

    return render(
        request,
        "dispatch/create.html",
        {
            "page_title": "Open dispatch quality record",
            "organization": org,
            "vehicle_search_url": reverse("maintainpro_refs:vehicle-search"),
            "form_values": {
                "code": request.POST.get("code", ""),
                "maintainpro_vehicle_id": request.POST.get("maintainpro_vehicle_id", ""),
                "vehicle_query": request.POST.get("vehicle_query", ""),
                "delivery_loading_reference": request.POST.get(
                    "delivery_loading_reference", ""
                ),
                "batch_reference": request.POST.get("batch_reference", ""),
                "notes": request.POST.get("notes", ""),
            },
        },
    )


@login_required
@require_GET
def dispatch_detail(request: HttpRequest, record_id: uuid.UUID) -> HttpResponse:
    _require_dispatch(request)
    record = _load(record_id)
    if record.organization_id not in organizations_for_dispatch_view(_actor(request)).values_list(
        "id", flat=True
    ):
        raise PermissionDenied("Permission denied.")
    return render(
        request,
        "dispatch/detail.html",
        {
            "page_title": record.code,
            "record": record,
            "history": list_dispatch_history(record_id=record.id),
            "release_gate": evaluate_release_gate(record=record),
        },
    )
