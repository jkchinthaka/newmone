"""HTMX autocomplete endpoints for MaintainPro entity selectors."""

from __future__ import annotations

import json
from typing import Any, cast

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from apps.accounts.models import User
from apps.integrations.maintainpro.exceptions import MaintainProReferenceError
from apps.integrations.maintainpro.reference_service import (
    MaintainProReferenceService,
    resolve_maintainpro_tenant_id,
)
from apps.organizations.models import Organization


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _organization_for_request(request: HttpRequest) -> Organization | None:
    org_id = (request.GET.get("organization_id") or "").strip()
    if not org_id:
        return Organization.objects.filter(is_active=True).order_by("code").first()
    return Organization.objects.filter(pk=org_id, is_active=True).first()


def _tenant_id(request: HttpRequest, organization: Organization | None) -> str:
    # Browser-supplied tenantId is ignored — server mapping only.
    return resolve_maintainpro_tenant_id(organization=organization)


@login_required
@require_GET
def vehicle_search(request: HttpRequest) -> HttpResponse:
    if not _actor(request).is_authenticated:
        raise PermissionDenied("Authentication required.")
    org = _organization_for_request(request)
    q = (request.GET.get("q") or "").strip()
    request_id = (request.GET.get("request_id") or "").strip()
    wants_json = (request.GET.get("format") or "").lower() == "json" or "application/json" in (
        request.headers.get("Accept") or ""
    )
    try:
        tenant_id = _tenant_id(request, org)
        results = MaintainProReferenceService().search_vehicles(
            tenant_id=tenant_id,
            query=q,
            limit=15,
        )
        payload: list[dict[str, Any]] = [
            {
                "id": v.id,
                "registrationNo": v.registration_no,
                "make": v.make,
                "vehicleModel": v.vehicle_model,
                "status": v.status,
                "assetTag": v.asset_tag,
                "label": v.label,
            }
            for v in results
        ]
    except MaintainProReferenceError as exc:
        if wants_json:
            return JsonResponse(
                {
                    "success": False,
                    "error_code": getattr(exc, "code", "REFERENCE_ERROR"),
                    "message": str(exc),
                    "request_id": request_id,
                    "results": [],
                },
                status=503,
            )
        return render(
            request,
            "integrations/maintainpro/selector_results.html",
            {
                "entity": "vehicle",
                "error": str(exc),
                "results": [],
                "query": q,
                "request_id": request_id,
            },
            status=503,
        )

    if wants_json:
        return JsonResponse(
            {
                "success": True,
                "request_id": request_id,
                "results": payload,
            }
        )
    return render(
        request,
        "integrations/maintainpro/selector_results.html",
        {
            "entity": "vehicle",
            "results": payload,
            "query": q,
            "request_id": request_id,
            "error": "",
        },
    )


@login_required
@require_GET
def asset_search(request: HttpRequest) -> HttpResponse:
    org = _organization_for_request(request)
    q = (request.GET.get("q") or "").strip()
    try:
        tenant_id = _tenant_id(request, org)
        results = MaintainProReferenceService().search_assets(
            tenant_id=tenant_id, query=q, limit=15
        )
        payload = [
            {
                "id": a.id,
                "label": f"{a.asset_tag} — {a.name}",
                "status": a.status,
                "assetTag": a.asset_tag,
                "name": a.name,
            }
            for a in results
        ]
    except MaintainProReferenceError as exc:
        return JsonResponse(
            {"success": False, "message": str(exc), "results": []},
            status=503,
        )
    return JsonResponse({"success": True, "results": payload})


@login_required
@require_GET
def department_search(request: HttpRequest) -> HttpResponse:
    org = _organization_for_request(request)
    q = (request.GET.get("q") or "").strip()
    try:
        tenant_id = _tenant_id(request, org)
        results = MaintainProReferenceService().search_departments(
            tenant_id=tenant_id, query=q, limit=15
        )
        payload = [
            {"id": d.id, "label": f"{d.code} — {d.name}", "code": d.code, "name": d.name}
            for d in results
        ]
    except MaintainProReferenceError as exc:
        return JsonResponse(
            {"success": False, "message": str(exc), "results": []},
            status=503,
        )
    return JsonResponse({"success": True, "results": payload})


@login_required
@require_GET
def facility_search(request: HttpRequest) -> HttpResponse:
    org = _organization_for_request(request)
    q = (request.GET.get("q") or "").strip()
    try:
        tenant_id = _tenant_id(request, org)
        results = MaintainProReferenceService().search_facilities(
            tenant_id=tenant_id, query=q, limit=15
        )
        payload = [{"id": f.id, "label": f.name, "name": f.name} for f in results]
    except MaintainProReferenceError as exc:
        return JsonResponse(
            {"success": False, "message": str(exc), "results": []},
            status=503,
        )
    return JsonResponse({"success": True, "results": payload})
