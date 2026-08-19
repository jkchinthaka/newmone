"""Customer complaint operator workspace — Phase 39 services only."""

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
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.customer_complaints.models import ComplaintCaseStatus, CustomerComplaintCase
from apps.customer_complaints.selectors import (
    actor_can_access_complaints_module,
    list_complaints_for_actor,
    organizations_for_complaints_view,
    timeline_for_case,
)
from apps.customer_complaints.services import can_view_customer_sensitive, create_complaint_case

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _require_complaints(request: HttpRequest) -> None:
    assert_fg_permission(request, "fg.complaints.view")
    if not actor_can_access_complaints_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _load(case_id: uuid.UUID) -> CustomerComplaintCase:
    case = (
        CustomerComplaintCase.objects.select_related("organization", "owner", "created_by")
        .filter(pk=case_id)
        .first()
    )
    if case is None:
        raise Http404("Complaint not found.")
    return case


@login_required
@require_GET
def complaint_list(request: HttpRequest) -> HttpResponse:
    _require_complaints(request)
    rows = list_complaints_for_actor(actor=_actor(request))
    status = (request.GET.get("status") or "").strip()
    if status:
        rows = rows.filter(status=status)
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "complaints/list.html",
        {
            "page_title": "Customer complaints",
            "page": page,
            "status": status,
            "status_choices": ComplaintCaseStatus.choices,
            "can_create": organizations_for_complaints_view(_actor(request)).exists(),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
@require_fg_permission("fg.complaints.manage")
def complaint_create(request: HttpRequest) -> HttpResponse:
    _require_complaints(request)
    org = organizations_for_complaints_view(_actor(request)).first()
    if org is None:
        raise PermissionDenied("Permission denied.")
    if request.method == "POST":
        try:
            case = create_complaint_case(
                actor=_actor(request),
                organization=org,
                code=request.POST.get("code") or "",
                description=request.POST.get("description") or "",
                product_reference=request.POST.get("product_reference") or "",
                batch_reference=request.POST.get("batch_reference") or "",
                channel_reference=request.POST.get("channel_reference") or "",
                erp_customer_reference=request.POST.get("erp_customer_reference") or "",
                customer_display_label=request.POST.get("customer_display_label") or "",
            )
            messages.success(request, "Complaint case opened. Communication is never auto-sent.")
            return redirect("complaints:detail", case_id=case.id)
        except (ValidationError, PermissionDenied) as exc:
            messages.error(request, str(exc))
    return render(
        request,
        "complaints/create.html",
        {"page_title": "Open complaint", "organization": org},
    )


@login_required
@require_GET
def complaint_detail(request: HttpRequest, case_id: uuid.UUID) -> HttpResponse:
    _require_complaints(request)
    case = _load(case_id)
    if case.organization_id not in organizations_for_complaints_view(_actor(request)).values_list(
        "id", flat=True
    ):
        raise PermissionDenied("Permission denied.")
    show_sensitive = can_view_customer_sensitive(
        _actor(request), organization_id=case.organization_id
    )
    return render(
        request,
        "complaints/detail.html",
        {
            "page_title": case.code,
            "case": case,
            "timeline": timeline_for_case(case_id=case.id),
            "show_sensitive": show_sensitive,
        },
    )
