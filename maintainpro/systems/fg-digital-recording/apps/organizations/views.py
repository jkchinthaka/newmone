"""Shift management views — thin HTTP adapters over services/selectors."""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import Any

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.organizations.forms import ShiftForm
from apps.organizations.models import Organization, Shift
from apps.organizations.selectors import (
    StatusFilter,
    actor_can_manage_shift,
    actor_can_manage_shifts,
    actor_can_view_shifts,
    departments_for_shift_actor,
    get_shift_by_id,
    list_shifts_for_actor,
    organizations_for_shift_actor,
    sites_for_shift_actor,
)
from apps.organizations.services import (
    MANAGE_SHIFT,
    activate_shift,
    create_shift,
    deactivate_shift,
    update_shift,
)

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return request.user  # type: ignore[return-value]


def _parse_uuid(raw: str | None) -> uuid.UUID | None:
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError, AttributeError):
        return None


def _require_view_module(request: HttpRequest) -> None:
    if not actor_can_view_shifts(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _require_manage_module(request: HttpRequest) -> None:
    if not actor_can_manage_shifts(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _get_shift_or_404(request: HttpRequest, shift_id: uuid.UUID) -> Shift:
    try:
        shift = get_shift_by_id(_actor(request), shift_id)
    except PermissionDenied:
        raise
    if shift is None:
        raise Http404("Shift not found.")
    return shift


def _apply_validation_error(form: ShiftForm, exc: ValidationError) -> None:
    if hasattr(exc, "message_dict"):
        for field, errors in exc.message_dict.items():
            target = field if field in form.fields else None
            for error in errors:
                form.add_error(target, error)
        return
    if hasattr(exc, "error_list"):
        for err in exc.error_list:
            form.add_error(None, err)
        return
    form.add_error(None, "; ".join(str(m) for m in exc.messages))


def _shift_form_for_actor(
    request: HttpRequest,
    data: Mapping[str, Any] | None = None,
    *,
    instance: Shift | None = None,
) -> ShiftForm:
    org_id = None
    site_id = None
    if data is not None:
        org_raw = data.get("organization")
        site_raw = data.get("site")
        org_id = _parse_uuid(str(org_raw) if org_raw is not None else None)
        site_id = _parse_uuid(str(site_raw) if site_raw is not None else None)
    if org_id is None and instance is not None:
        org_id = instance.organization_id
    if site_id is None and instance is not None and data is None:
        site_id = instance.site_id

    user = _actor(request)
    return ShiftForm(
        data,
        organizations=organizations_for_shift_actor(user),
        sites=sites_for_shift_actor(user, organization_id=org_id),
        departments=departments_for_shift_actor(
            user,
            organization_id=org_id,
            site_id=site_id,
        ),
        instance=instance,
    )


@login_required
@require_GET
def shift_list(request: HttpRequest) -> HttpResponse:
    _require_view_module(request)
    search = (request.GET.get("q") or "").strip()
    status_raw = (request.GET.get("status") or "all").strip().lower()
    status: StatusFilter = (
        status_raw if status_raw in {"all", "active", "inactive"} else "all"  # type: ignore[assignment]
    )

    org_id = _parse_uuid(request.GET.get("organization"))
    site_id = _parse_uuid(request.GET.get("site"))
    dept_id = _parse_uuid(request.GET.get("department"))

    organizations = organizations_for_shift_actor(_actor(request))
    organization = organizations.filter(pk=org_id).first() if org_id else None
    sites = sites_for_shift_actor(_actor(request), organization_id=org_id)
    site = sites.filter(pk=site_id).first() if site_id else None
    departments = departments_for_shift_actor(
        _actor(request),
        organization_id=org_id,
        site_id=site_id,
    )
    department = departments.filter(pk=dept_id).first() if dept_id else None

    shifts = list_shifts_for_actor(
        _actor(request),
        organization=organization,
        site=site,
        department=department,
        status=status,
        search=search or None,
    )
    paginator = Paginator(shifts, PAGE_SIZE)
    page_obj = paginator.get_page(request.GET.get("page"))

    filters_active = bool(search or org_id or site_id or dept_id or status != "all")
    can_manage = actor_can_manage_shifts(_actor(request))

    context = {
        "page_obj": page_obj,
        "shifts": page_obj.object_list,
        "search": search,
        "status": status,
        "organizations": organizations,
        "sites": sites,
        "departments": departments,
        "selected_organization": organization,
        "selected_site": site,
        "selected_department": department,
        "filters_active": filters_active,
        "can_manage": can_manage,
        "total_count": paginator.count,
    }
    if request.headers.get("HX-Request") == "true":
        return render(request, "organizations/shifts/_list_results.html", context)
    return render(request, "organizations/shifts/list.html", context)


@login_required
@require_http_methods(["GET", "POST"])
def shift_create(request: HttpRequest) -> HttpResponse:
    _require_manage_module(request)
    form = _shift_form_for_actor(request, request.POST or None)
    if request.method == "POST" and form.is_valid():
        organization: Organization = form.cleaned_data["organization"]
        site = form.cleaned_data.get("site")
        department = form.cleaned_data.get("department")
        if not user_has_permission(
            _actor(request),
            MANAGE_SHIFT,
            scope=Scope(
                organization_id=organization.id,
                site_id=site.id if site is not None else None,
                department_id=department.id if department is not None else None,
            ),
        ):
            raise PermissionDenied("Permission denied.")
        try:
            shift = create_shift(
                actor=_actor(request),
                organization=organization,
                site=site,
                department=department,
                code=form.cleaned_data["code"],
                name=form.cleaned_data["name"],
                start_time=form.cleaned_data["start_time"],
                end_time=form.cleaned_data["end_time"],
                effective_from=form.cleaned_data["effective_from"],
                effective_to=form.cleaned_data.get("effective_to"),
                is_active=bool(form.cleaned_data.get("is_active")),
            )
        except ValidationError as exc:
            _apply_validation_error(form, exc)
        else:
            messages.success(request, f"Shift {shift.code} created.")
            return redirect("organizations:shift_detail", shift_id=shift.id)

    return render(
        request,
        "organizations/shifts/form.html",
        {
            "form": form,
            "page_title": "Create Shift",
            "submit_label": "Create Shift",
            "is_create": True,
        },
    )


@login_required
@require_GET
def shift_detail(request: HttpRequest, shift_id: uuid.UUID) -> HttpResponse:
    _require_view_module(request)
    shift = _get_shift_or_404(request, shift_id)
    return render(
        request,
        "organizations/shifts/detail.html",
        {
            "shift": shift,
            "can_manage": actor_can_manage_shift(_actor(request), shift),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def shift_edit(request: HttpRequest, shift_id: uuid.UUID) -> HttpResponse:
    _require_view_module(request)
    shift = _get_shift_or_404(request, shift_id)
    if not actor_can_manage_shift(_actor(request), shift):
        raise PermissionDenied("Permission denied.")

    form = _shift_form_for_actor(request, request.POST or None, instance=shift)
    if request.method == "POST" and form.is_valid():
        try:
            updated = update_shift(
                actor=_actor(request),
                shift_id=shift.id,
                code=form.cleaned_data["code"],
                name=form.cleaned_data["name"],
                start_time=form.cleaned_data["start_time"],
                end_time=form.cleaned_data["end_time"],
                effective_from=form.cleaned_data["effective_from"],
                effective_to=form.cleaned_data.get("effective_to"),
                site=form.cleaned_data.get("site"),
                department=form.cleaned_data.get("department"),
            )
            # Active flag via activate/deactivate services for audit clarity
            if form.cleaned_data.get("is_active") and not updated.is_active:
                updated = activate_shift(actor=_actor(request), shift_id=updated.id)
            elif not form.cleaned_data.get("is_active") and updated.is_active:
                updated = deactivate_shift(actor=_actor(request), shift_id=updated.id)
        except ValidationError as exc:
            _apply_validation_error(form, exc)
        else:
            messages.success(request, f"Shift {updated.code} updated.")
            return redirect("organizations:shift_detail", shift_id=updated.id)

    return render(
        request,
        "organizations/shifts/form.html",
        {
            "form": form,
            "shift": shift,
            "page_title": f"Edit Shift {shift.code}",
            "submit_label": "Save changes",
            "is_create": False,
        },
    )


@login_required
@require_POST
def shift_activate(request: HttpRequest, shift_id: uuid.UUID) -> HttpResponse:
    shift = _get_shift_or_404(request, shift_id)
    if not actor_can_manage_shift(_actor(request), shift):
        raise PermissionDenied("Permission denied.")
    try:
        activate_shift(actor=_actor(request), shift_id=shift.id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    else:
        messages.success(request, f"Shift {shift.code} activated.")
    return redirect("organizations:shift_detail", shift_id=shift.id)


@login_required
@require_POST
def shift_deactivate(request: HttpRequest, shift_id: uuid.UUID) -> HttpResponse:
    shift = _get_shift_or_404(request, shift_id)
    if not actor_can_manage_shift(_actor(request), shift):
        raise PermissionDenied("Permission denied.")
    try:
        deactivate_shift(actor=_actor(request), shift_id=shift.id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    else:
        messages.success(request, f"Shift {shift.code} deactivated.")
    return redirect("organizations:shift_detail", shift_id=shift.id)


@login_required
@require_GET
def shift_sites_options(request: HttpRequest) -> HttpResponse:
    _require_manage_module(request)
    org_id = _parse_uuid(request.GET.get("organization"))
    sites = sites_for_shift_actor(_actor(request), organization_id=org_id)
    return render(
        request,
        "organizations/shifts/_site_options.html",
        {"sites": sites, "selected": _parse_uuid(request.GET.get("selected"))},
    )


@login_required
@require_GET
def shift_departments_options(request: HttpRequest) -> HttpResponse:
    _require_manage_module(request)
    org_id = _parse_uuid(request.GET.get("organization"))
    site_id = _parse_uuid(request.GET.get("site"))
    departments = departments_for_shift_actor(
        _actor(request),
        organization_id=org_id,
        site_id=site_id,
    )
    return render(
        request,
        "organizations/shifts/_department_options.html",
        {"departments": departments, "selected": _parse_uuid(request.GET.get("selected"))},
    )
