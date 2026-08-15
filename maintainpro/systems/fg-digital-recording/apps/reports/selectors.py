"""Selectors for governed reports — thin read helpers."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.access_control.services import organization_ids_with_permission
from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.reports.catalogue import catalogue_as_dicts
from apps.reports.models import ReportRun
from apps.reports.services import RUN_REPORT, VIEW_CATALOGUE


def list_catalogue_entries() -> list[dict[str, object]]:
    return catalogue_as_dicts()


def organizations_for_reporting(actor: User | None) -> QuerySet[Organization]:
    view_ids = organization_ids_with_permission(actor, VIEW_CATALOGUE)
    run_ids = organization_ids_with_permission(actor, RUN_REPORT)
    org_ids = view_ids | run_ids
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def get_report_run(*, report_run_id: uuid.UUID, organization_id: uuid.UUID) -> ReportRun | None:
    return ReportRun.objects.filter(pk=report_run_id, organization_id=organization_id).first()


def list_recent_report_runs(*, organization_id: uuid.UUID, limit: int = 20) -> list[ReportRun]:
    return list(
        ReportRun.objects.filter(organization_id=organization_id).order_by("-created_at")[:limit]
    )
