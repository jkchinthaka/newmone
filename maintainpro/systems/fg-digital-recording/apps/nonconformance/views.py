"""NCR / Hold operator views — thin adapters over Phase 12 services."""

from __future__ import annotations

import uuid
from typing import cast

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from apps.access_control.maintainpro_bridge import assert_fg_permission, require_fg_permission
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.nonconformance.models import NonConformanceRecord, NonConformanceStatus
from apps.nonconformance.selectors import (
    actor_can_access_ncr_module,
    list_case_history,
    list_hold_cases_for_org,
    list_nonconformances_for_actor,
    organizations_for_ncr_view,
)
from apps.nonconformance.services import (
    close_nonconformance,
    create_nonconformance,
    transition_nonconformance_status,
    update_nonconformance_case_fields,
)

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _require_ncr(request: HttpRequest) -> None:
    assert_fg_permission(request, "fg.nonconformance.view")
    if not actor_can_access_ncr_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _load(ncr_id: uuid.UUID) -> NonConformanceRecord:
    record = (
        NonConformanceRecord.objects.select_related("organization", "owner", "created_by")
        .filter(pk=ncr_id)
        .first()
    )
    if record is None:
        raise Http404("NCR not found.")
    return record


@login_required
@require_GET
def ncr_list(request: HttpRequest) -> HttpResponse:
    _require_ncr(request)
    rows = list_nonconformances_for_actor(actor=_actor(request))
    status = (request.GET.get("status") or "").strip()
    if status:
        rows = rows.filter(status=status)
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "nonconformance/list.html",
        {
            "page_title": "Nonconformances",
            "page": page,
            "status": status,
            "status_choices": NonConformanceStatus.choices,
            "can_create": organizations_for_ncr_view(_actor(request)).exists(),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
@require_fg_permission("fg.nonconformance.manage")
def ncr_create(request: HttpRequest) -> HttpResponse:
    _require_ncr(request)
    orgs = organizations_for_ncr_view(_actor(request))
    org = orgs.first()
    if org is None:
        raise PermissionDenied("Permission denied.")
    if request.method == "POST":
        try:
            record = create_nonconformance(
                actor=_actor(request),
                organization=org,
                code=request.POST.get("code") or "",
                title=request.POST.get("title") or "",
                description=request.POST.get("description") or "",
                batch_reference=request.POST.get("batch_reference") or "",
                containment=request.POST.get("containment") or "",
                idempotency_key=request.POST.get("idempotency_key") or "",
            )
            messages.success(request, "Nonconformance opened.")
            return redirect("nonconformance:detail", ncr_id=record.id)
        except (ValidationError, PermissionDenied) as exc:
            messages.error(request, str(exc))
    return render(
        request,
        "nonconformance/create.html",
        {"page_title": "Open nonconformance", "organization": org},
    )


@login_required
@require_GET
def ncr_detail(request: HttpRequest, ncr_id: uuid.UUID) -> HttpResponse:
    _require_ncr(request)
    record = _load(ncr_id)
    if record.organization_id not in organizations_for_ncr_view(_actor(request)).values_list(
        "id", flat=True
    ):
        raise PermissionDenied("Permission denied.")
    return render(
        request,
        "nonconformance/detail.html",
        {
            "page_title": record.code,
            "ncr": record,
            "history": list_case_history(
                organization_id=record.organization_id,
                case_kind="NONCONFORMANCE",
                case_id=record.id,
            ),
            "holds": list_hold_cases_for_org(
                actor=_actor(request), organization_id=record.organization_id
            ).filter(nonconformance=record),
            "capas": CorrectiveAction.objects.filter(nonconformance=record).select_related("owner"),
            "status_choices": NonConformanceStatus.choices,
        },
    )


@login_required
@require_POST
@require_fg_permission("fg.nonconformance.manage")
def ncr_update(request: HttpRequest, ncr_id: uuid.UUID) -> HttpResponse:
    _require_ncr(request)
    try:
        update_nonconformance_case_fields(
            actor=_actor(request),
            nonconformance_id=ncr_id,
            description=request.POST.get("description"),
            containment=request.POST.get("containment"),
            investigation=request.POST.get("investigation"),
        )
        messages.success(request, "Case fields updated.")
    except (ValidationError, PermissionDenied) as exc:
        messages.error(request, str(exc))
    return redirect("nonconformance:detail", ncr_id=ncr_id)


@login_required
@require_POST
@require_fg_permission("fg.nonconformance.manage")
def ncr_transition(request: HttpRequest, ncr_id: uuid.UUID) -> HttpResponse:
    _require_ncr(request)
    try:
        transition_nonconformance_status(
            actor=_actor(request),
            nonconformance_id=ncr_id,
            to_status=request.POST.get("to_status") or "",
            note=request.POST.get("note") or "",
        )
        messages.success(request, "Status updated.")
    except (ValidationError, PermissionDenied) as exc:
        messages.error(request, str(exc))
    return redirect("nonconformance:detail", ncr_id=ncr_id)


@login_required
@require_POST
@require_fg_permission("fg.nonconformance.manage")
def ncr_close(request: HttpRequest, ncr_id: uuid.UUID) -> HttpResponse:
    _require_ncr(request)
    try:
        close_nonconformance(
            actor=_actor(request),
            nonconformance_id=ncr_id,
            closure_notes=request.POST.get("closure_notes") or "",
        )
        messages.success(request, "Nonconformance closed.")
    except (ValidationError, PermissionDenied) as exc:
        messages.error(request, str(exc))
    return redirect("nonconformance:detail", ncr_id=ncr_id)
