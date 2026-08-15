"""Governed quality report views — Phase 16."""

from __future__ import annotations

import uuid
from typing import cast

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse
from django.views.decorators.http import require_http_methods, require_POST

from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.reports.selectors import get_report_run, list_recent_report_runs
from apps.reports.services import (
    get_report_run_csv,
    list_report_catalogue,
    run_quality_report,
    unsupported_excel_or_pdf,
)


def _resolve_organization(request: HttpRequest) -> Organization:
    org_id = request.GET.get("organization_id") or request.POST.get("organization_id")
    if not org_id:
        raise ValidationError({"organization_id": "organization_id is required."})
    org = Organization.objects.filter(pk=org_id, is_active=True).first()
    if org is None:
        raise ValidationError({"organization_id": "Organization not found."})
    return org


@login_required
@require_http_methods(["GET"])
def report_catalogue(request: HttpRequest) -> HttpResponse:
    from apps.reports.selectors import organizations_for_reporting

    actor = cast(User, request.user)
    reporting_orgs = organizations_for_reporting(actor)
    org_id = request.GET.get("organization_id") or request.POST.get("organization_id")
    if not org_id:
        return render(
            request,
            "reports/catalogue.html",
            {
                "organization": None,
                "catalogue": [],
                "recent_runs": [],
                "reporting_organizations": reporting_orgs,
                "page_title": "Reports",
            },
        )
    try:
        organization = _resolve_organization(request)
        catalogue = list_report_catalogue(actor=actor, organization=organization)
    except (PermissionDenied, ValidationError) as exc:
        raise PermissionDenied(str(exc)) from exc
    recent = list_recent_report_runs(organization_id=organization.id, limit=15)
    return render(
        request,
        "reports/catalogue.html",
        {
            "organization": organization,
            "catalogue": catalogue,
            "recent_runs": recent,
            "reporting_organizations": reporting_orgs,
            "page_title": "Reports",
        },
    )


@login_required
@require_POST
def report_run_create(request: HttpRequest) -> HttpResponse:
    try:
        organization = _resolve_organization(request)
        export_format = (request.POST.get("export_format") or "CSV").upper()
        if export_format in {"XLSX", "XLS", "EXCEL", "PDF"}:
            unsupported_excel_or_pdf(export_format)
        filters = {
            "date_from": request.POST.get("date_from") or "",
            "date_to": request.POST.get("date_to") or "",
            "batch_reference": request.POST.get("batch_reference") or "",
            "product_id": request.POST.get("product_id") or None,
            "site_id": request.POST.get("site_id") or None,
            "department_id": request.POST.get("department_id") or None,
            "shift_id": request.POST.get("shift_id") or None,
            "status": request.POST.get("status") or "",
            "user_id": request.POST.get("user_id") or None,
            "reviewer_id": request.POST.get("reviewer_id") or None,
            "disposition": request.POST.get("disposition") or "",
            "limit": request.POST.get("limit") or 500,
            "offset": request.POST.get("offset") or 0,
        }
        # Drop empty optional ids
        for key in (
            "product_id",
            "site_id",
            "department_id",
            "shift_id",
            "user_id",
            "reviewer_id",
        ):
            if not filters[key]:
                filters[key] = None
        export = request.POST.get("export") == "1"
        force_async = request.POST.get("background") == "1"
        run = run_quality_report(
            actor=cast(User, request.user),
            organization=organization,
            report_code=request.POST.get("report_code") or "",
            filters=filters,
            export=export,
            force_async=force_async,
        )
    except (PermissionDenied, ValidationError) as exc:
        raise PermissionDenied(str(exc)) from exc
    return HttpResponseRedirect(
        reverse("reports:run_detail", kwargs={"report_run_id": run.id})
        + f"?organization_id={organization.id}"
    )


@login_required
@require_http_methods(["GET"])
def report_run_detail(request: HttpRequest, report_run_id: uuid.UUID) -> HttpResponse:
    try:
        organization = _resolve_organization(request)
        run = get_report_run(report_run_id=report_run_id, organization_id=organization.id)
        if run is None:
            raise PermissionDenied("Report run not found in this organization.")
        # Catalogue permission gate for viewing run metadata
        list_report_catalogue(actor=cast(User, request.user), organization=organization)
    except (PermissionDenied, ValidationError) as exc:
        raise PermissionDenied(str(exc)) from exc
    return render(
        request,
        "reports/run_detail.html",
        {"organization": organization, "run": run},
    )


@login_required
@require_http_methods(["GET"])
def report_run_export_csv(request: HttpRequest, report_run_id: uuid.UUID) -> HttpResponse:
    try:
        run, csv_text = get_report_run_csv(
            actor=cast(User, request.user), report_run_id=report_run_id
        )
        org_id = request.GET.get("organization_id")
        if org_id and str(run.organization_id) != str(org_id):
            raise PermissionDenied("Cross-organization export denied.")
    except (PermissionDenied, ValidationError) as exc:
        raise PermissionDenied(str(exc)) from exc
    response = HttpResponse(csv_text, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = (
        f'attachment; filename="report-{run.report_code}-{run.id}.csv"'
    )
    return response


@login_required
@require_http_methods(["GET"])
def quality_trends(request: HttpRequest) -> HttpResponse:
    from datetime import date

    from apps.reports.trends import measurement_series_stats, quality_trend_counts

    actor = cast(User, request.user)
    date_from = request.GET.get("date_from") or ""
    date_to = request.GET.get("date_to") or ""
    parsed_from = date.fromisoformat(date_from) if date_from else None
    parsed_to = date.fromisoformat(date_to) if date_to else None
    counts = quality_trend_counts(actor=actor, date_from=parsed_from, date_to=parsed_to)
    return render(
        request,
        "reports/trends.html",
        {
            "page_title": "Quality trends",
            "counts": counts,
            "date_from": date_from,
            "date_to": date_to,
            "series_stats": [
                measurement_series_stats(actor=actor, form_code="NMS/PPU/CL/39"),
                measurement_series_stats(actor=actor, form_code="NMS/PPU/CL/18"),
            ],
        },
    )
