"""Quality quarantine operator workspace — application quality state only."""

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
from apps.quality_quarantine.models import (
    QualityQuarantineRecord,
    QuarantineSource,
    QuarantineStatus,
)
from apps.quality_quarantine.selectors import (
    actor_can_access_quarantine_module,
    events_for_quarantine,
    list_quarantines_for_actor,
    organizations_for_quarantine_view,
)
from apps.quality_quarantine.services import open_quarantine_record

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _require_quarantine(request: HttpRequest) -> None:
    if not actor_can_access_quarantine_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _load(quarantine_id: uuid.UUID) -> QualityQuarantineRecord:
    record = (
        QualityQuarantineRecord.objects.select_related("organization", "opened_by", "owner")
        .filter(pk=quarantine_id)
        .first()
    )
    if record is None:
        raise Http404("Quarantine record not found.")
    return record


@login_required
@require_GET
def quarantine_list(request: HttpRequest) -> HttpResponse:
    _require_quarantine(request)
    rows = list_quarantines_for_actor(actor=_actor(request))
    status = (request.GET.get("status") or "").strip()
    if status:
        rows = rows.filter(status=status)
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "quarantine/list.html",
        {
            "page_title": "Quality quarantine",
            "page": page,
            "status": status,
            "status_choices": QuarantineStatus.choices,
            "can_create": organizations_for_quarantine_view(_actor(request)).exists(),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def quarantine_create(request: HttpRequest) -> HttpResponse:
    _require_quarantine(request)
    org = organizations_for_quarantine_view(_actor(request)).first()
    if org is None:
        raise PermissionDenied("Permission denied.")
    if request.method == "POST":
        try:
            record = open_quarantine_record(
                actor=_actor(request),
                organization=org,
                code=request.POST.get("code") or "",
                batch_reference=request.POST.get("batch_reference") or "",
                source=request.POST.get("source") or QuarantineSource.MANUAL,
                source_reference=request.POST.get("source_reference") or "MANUAL",
                reason_reference=request.POST.get("reason_reference") or "",
            )
            messages.success(
                request,
                "Quality quarantine opened. This is not an ERP inventory hold.",
            )
            return redirect("quarantine:detail", quarantine_id=record.id)
        except (ValidationError, PermissionDenied) as exc:
            messages.error(request, str(exc))
    return render(
        request,
        "quarantine/create.html",
        {
            "page_title": "Open quality quarantine",
            "organization": org,
            "source_choices": QuarantineSource.choices,
        },
    )


@login_required
@require_GET
def quarantine_detail(request: HttpRequest, quarantine_id: uuid.UUID) -> HttpResponse:
    _require_quarantine(request)
    record = _load(quarantine_id)
    if record.organization_id not in organizations_for_quarantine_view(_actor(request)).values_list(
        "id", flat=True
    ):
        raise PermissionDenied("Permission denied.")
    return render(
        request,
        "quarantine/detail.html",
        {
            "page_title": record.code,
            "record": record,
            "events": events_for_quarantine(
                organization_id=record.organization_id, quarantine_id=record.id
            ),
        },
    )
