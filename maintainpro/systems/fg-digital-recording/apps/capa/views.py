"""CAPA operator views including effectiveness review."""

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
from apps.capa.models import CapaActionItem, CorrectiveAction, CorrectiveActionStatus
from apps.capa.selectors import (
    actor_can_access_capa_module,
    list_capa_history,
    list_corrective_actions_for_actor,
    organizations_for_capa_view,
)
from apps.capa.services import (
    add_capa_action_item,
    close_corrective_action,
    create_corrective_action,
    record_capa_effectiveness_review,
    record_capa_verification,
    transition_capa_status,
)

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _require_capa(request: HttpRequest) -> None:
    assert_fg_permission(request, "fg.capa.view")
    if not actor_can_access_capa_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _load(capa_id: uuid.UUID) -> CorrectiveAction:
    action = (
        CorrectiveAction.objects.select_related(
            "organization",
            "owner",
            "created_by",
            "nonconformance",
            "verified_by",
            "effectiveness_reviewed_by",
        )
        .filter(pk=capa_id)
        .first()
    )
    if action is None:
        raise Http404("CAPA not found.")
    return action


@login_required
@require_GET
def capa_list(request: HttpRequest) -> HttpResponse:
    _require_capa(request)
    rows = list_corrective_actions_for_actor(actor=_actor(request))
    status = (request.GET.get("status") or "").strip()
    if status:
        rows = rows.filter(status=status)
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "capa/list.html",
        {
            "page_title": "CAPA",
            "page": page,
            "status": status,
            "status_choices": CorrectiveActionStatus.choices,
            "can_create": organizations_for_capa_view(_actor(request)).exists(),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
@require_fg_permission("fg.capa.manage")
def capa_create(request: HttpRequest) -> HttpResponse:
    _require_capa(request)
    org = organizations_for_capa_view(_actor(request)).first()
    if org is None:
        raise PermissionDenied("Permission denied.")
    if request.method == "POST":
        try:
            action = create_corrective_action(
                actor=_actor(request),
                organization=org,
                code=request.POST.get("code") or "",
                title=request.POST.get("title") or "",
                summary=request.POST.get("summary") or "",
            )
            messages.success(request, "CAPA opened.")
            return redirect("capa:detail", capa_id=action.id)
        except (ValidationError, PermissionDenied) as exc:
            messages.error(request, str(exc))
    return render(request, "capa/create.html", {"page_title": "Open CAPA", "organization": org})


@login_required
@require_GET
def capa_detail(request: HttpRequest, capa_id: uuid.UUID) -> HttpResponse:
    _require_capa(request)
    action = _load(capa_id)
    if action.organization_id not in organizations_for_capa_view(_actor(request)).values_list(
        "id", flat=True
    ):
        raise PermissionDenied("Permission denied.")
    return render(
        request,
        "capa/detail.html",
        {
            "page_title": action.code,
            "capa": action,
            "items": CapaActionItem.objects.filter(capa=action).select_related("owner"),
            "history": list_capa_history(capa_id=action.id),
            "status_choices": CorrectiveActionStatus.choices,
        },
    )


@login_required
@require_POST
@require_fg_permission("fg.capa.manage")
def capa_transition(request: HttpRequest, capa_id: uuid.UUID) -> HttpResponse:
    _require_capa(request)
    try:
        transition_capa_status(
            actor=_actor(request),
            capa_id=capa_id,
            to_status=request.POST.get("to_status") or "",
            note=request.POST.get("note") or "",
        )
        messages.success(request, "Status updated.")
    except (ValidationError, PermissionDenied) as exc:
        messages.error(request, str(exc))
    return redirect("capa:detail", capa_id=capa_id)


@login_required
@require_POST
@require_fg_permission("fg.capa.manage")
def capa_add_item(request: HttpRequest, capa_id: uuid.UUID) -> HttpResponse:
    _require_capa(request)
    try:
        add_capa_action_item(
            actor=_actor(request),
            capa_id=capa_id,
            description=request.POST.get("description") or "",
        )
        messages.success(request, "Action item added.")
    except (ValidationError, PermissionDenied) as exc:
        messages.error(request, str(exc))
    return redirect("capa:detail", capa_id=capa_id)


@login_required
@require_POST
@require_fg_permission("fg.capa.manage")
def capa_verify(request: HttpRequest, capa_id: uuid.UUID) -> HttpResponse:
    _require_capa(request)
    try:
        record_capa_verification(
            actor=_actor(request),
            capa_id=capa_id,
            notes=request.POST.get("notes") or "",
        )
        messages.success(request, "Verification recorded.")
    except (ValidationError, PermissionDenied) as exc:
        messages.error(request, str(exc))
    return redirect("capa:detail", capa_id=capa_id)


@login_required
@require_POST
@require_fg_permission("fg.capa.manage")
def capa_effectiveness(request: HttpRequest, capa_id: uuid.UUID) -> HttpResponse:
    _require_capa(request)
    try:
        record_capa_effectiveness_review(
            actor=_actor(request),
            capa_id=capa_id,
            notes=request.POST.get("notes") or "",
        )
        messages.success(request, "Effectiveness review recorded.")
    except (ValidationError, PermissionDenied) as exc:
        messages.error(request, str(exc))
    return redirect("capa:detail", capa_id=capa_id)


@login_required
@require_POST
@require_fg_permission("fg.capa.manage")
def capa_close(request: HttpRequest, capa_id: uuid.UUID) -> HttpResponse:
    _require_capa(request)
    try:
        close_corrective_action(
            actor=_actor(request),
            capa_id=capa_id,
            closure_notes=request.POST.get("closure_notes") or "",
        )
        messages.success(request, "CAPA closed.")
    except (ValidationError, PermissionDenied) as exc:
        messages.error(request, str(exc))
    return redirect("capa:detail", capa_id=capa_id)
