"""HACCP plan operator views — read-only over Phase 23 foundation."""

from __future__ import annotations

import uuid
from typing import cast

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from apps.accounts.models import User
from apps.haccp.models import HaccpPlan
from apps.haccp.policy import evaluate_control_point_failure_policy
from apps.haccp.selectors import (
    actor_can_access_haccp_module,
    control_points_for_version,
    organizations_for_haccp_view,
    plans_for_actor,
    versions_for_plan,
)

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


@login_required
@require_GET
def haccp_plan_list(request: HttpRequest) -> HttpResponse:
    if not actor_can_access_haccp_module(_actor(request)):
        raise PermissionDenied("Permission denied.")
    page = Paginator(plans_for_actor(actor=_actor(request)), PAGE_SIZE).get_page(
        request.GET.get("page") or 1
    )
    return render(request, "haccp/list.html", {"page_title": "HACCP plans", "page": page})


@login_required
@require_GET
def haccp_plan_detail(request: HttpRequest, plan_id: uuid.UUID) -> HttpResponse:
    if not actor_can_access_haccp_module(_actor(request)):
        raise PermissionDenied("Permission denied.")
    plan = HaccpPlan.objects.select_related("organization").filter(pk=plan_id).first()
    if plan is None:
        raise Http404("Plan not found.")
    if plan.organization_id not in organizations_for_haccp_view(_actor(request)).values_list(
        "id", flat=True
    ):
        raise PermissionDenied("Permission denied.")
    versions = list(versions_for_plan(plan.id))
    version_id = request.GET.get("version")
    selected = None
    if version_id:
        selected = next((row for row in versions if str(row.id) == version_id), None)
    if selected is None and versions:
        selected = versions[0]
    points = []
    if selected is not None:
        for point in control_points_for_version(selected.id):
            points.append(
                {
                    "point": point,
                    "policy": evaluate_control_point_failure_policy(control_point=point),
                }
            )
    return render(
        request,
        "haccp/detail.html",
        {
            "page_title": plan.code,
            "plan": plan,
            "versions": versions,
            "selected": selected,
            "points": points,
        },
    )
