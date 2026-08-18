"""Laboratory operator queue — read-first over Phase 22 services."""

from __future__ import annotations

import uuid
from typing import cast

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from apps.access_control.maintainpro_bridge import assert_fg_permission, require_fg_permission
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from apps.accounts.models import User
from apps.laboratory.models import LabSample
from apps.laboratory.selectors import (
    actor_can_access_lab_module,
    latest_results_for_sample,
    organizations_for_lab_view,
    samples_for_actor,
)

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


@login_required
@require_GET
def lab_sample_list(request: HttpRequest) -> HttpResponse:
    assert_fg_permission(request, "fg.laboratory.view")
    if not actor_can_access_lab_module(_actor(request)):
        raise PermissionDenied("Permission denied.")
    page = Paginator(samples_for_actor(actor=_actor(request)), PAGE_SIZE).get_page(
        request.GET.get("page") or 1
    )
    return render(
        request,
        "laboratory/list.html",
        {"page_title": "Laboratory samples", "page": page},
    )


@login_required
@require_GET
def lab_sample_detail(request: HttpRequest, sample_id: uuid.UUID) -> HttpResponse:
    assert_fg_permission(request, "fg.laboratory.view")
    if not actor_can_access_lab_module(_actor(request)):
        raise PermissionDenied("Permission denied.")
    sample = (
        LabSample.objects.select_related("organization", "product", "site", "registered_by")
        .filter(pk=sample_id)
        .first()
    )
    if sample is None:
        raise Http404("Sample not found.")
    if sample.organization_id not in organizations_for_lab_view(_actor(request)).values_list(
        "id", flat=True
    ):
        raise PermissionDenied("Permission denied.")
    return render(
        request,
        "laboratory/detail.html",
        {
            "page_title": sample.code,
            "sample": sample,
            "results": latest_results_for_sample(sample.id),
        },
    )
