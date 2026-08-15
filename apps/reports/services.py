"""Governed quality reporting services — Phase 16.

Org-scoped RBAC. Historical submission/review/QA reports use immutable snapshots.
CSV export with formula-injection protection. Large runs via Celery.
Excel/PDF not implemented without approved libraries / owner need.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from apps.core.persistence import atomic, locked_get
from django.utils import timezone

from apps.access_control.services import (
    Scope,
    get_accessible_sites,
    require_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.organizations.models import Organization, Site
from apps.reports.catalogue import (
    REPORT_CATALOGUE,
    ReportCode,
    catalogue_as_dicts,
    get_report_definition,
)
from apps.reports.csv_safe import render_csv
from apps.reports.models import ReportExportFormat, ReportRun, ReportRunStatus
from apps.reports.queries import (
    ReportFilters,
    query_audit_events,
    query_batch_checklist,
    query_corrections,
    query_hold_ncr_capa,
    query_integration_failures,
    query_overdue_tasks,
    query_qa_dispositions,
    query_submission_history,
    query_supervisor_reviews,
)
from apps.security_audit.services import record_event

VIEW_CATALOGUE = "reports.view_reportcatalogue"
RUN_REPORT = "reports.run_qualityreport"
EXPORT_REPORT = "reports.export_qualityreport"

# Sync path max rows; larger requests are enqueued.
SYNC_ROW_SOFT_LIMIT = 200


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _filters_with_site_rbac(
    *,
    user: User,
    organization: Organization,
    filters: dict[str, Any] | None,
) -> tuple[dict[str, Any], ReportFilters]:
    """Apply org/site permission: deny inaccessible sites; constrain site-scoped actors."""
    raw = dict(filters or {})
    accessible = list(
        get_accessible_sites(user, organization_id=organization.id).values_list("pk", flat=True)
    )
    accessible_set = set(accessible)
    site_raw = raw.get("site_id")
    if site_raw:
        try:
            site_uuid = uuid.UUID(str(site_raw))
        except (TypeError, ValueError) as exc:
            raise ValidationError({"site_id": "Invalid site_id."}) from exc
        if site_uuid not in accessible_set:
            raise PermissionDenied("Site is outside the caller's reporting scope.")
        scope = Scope(organization_id=organization.id, site_id=site_uuid)
    else:
        scope = Scope(organization_id=organization.id)

    require_permission(user, RUN_REPORT, scope=scope)

    org_site_count = Site.objects.filter(organization_id=organization.id, is_active=True).count()
    # Site-scoped roles see only accessible sites; org-wide see all.
    if len(accessible_set) < org_site_count:
        raw["allowed_site_ids"] = [str(x) for x in accessible]
    return raw, ReportFilters(raw)


def list_report_catalogue(
    *, actor: User | None, organization: Organization
) -> list[dict[str, object]]:
    user = _require_authenticated_actor(actor)
    scope = Scope(organization_id=organization.id)
    if not (
        user_has_permission(user, VIEW_CATALOGUE, scope=scope)
        or user_has_permission(user, RUN_REPORT, scope=scope)
    ):
        raise PermissionDenied("Permission denied.")
    return catalogue_as_dicts()


def _execute_query(
    *, report_code: str, organization_id: uuid.UUID, filters: ReportFilters
) -> tuple[list[str], list[dict[str, object]]]:
    code = ReportCode(report_code)
    if code == ReportCode.BATCH_CHECKLIST:
        return query_batch_checklist(organization_id=organization_id, filters=filters)
    if code == ReportCode.SUBMISSION_HISTORY:
        return query_submission_history(organization_id=organization_id, filters=filters)
    if code == ReportCode.SUPERVISOR_REVIEW:
        return query_supervisor_reviews(organization_id=organization_id, filters=filters)
    if code == ReportCode.QA_DISPOSITION:
        return query_qa_dispositions(organization_id=organization_id, filters=filters)
    if code == ReportCode.CORRECTIONS:
        return query_corrections(organization_id=organization_id, filters=filters)
    if code == ReportCode.HOLD_NCR_CAPA:
        return query_hold_ncr_capa(organization_id=organization_id, filters=filters)
    if code == ReportCode.OVERDUE_TASKS:
        return query_overdue_tasks(organization_id=organization_id, filters=filters)
    if code == ReportCode.AUDIT_EVENTS:
        return query_audit_events(organization_id=organization_id, filters=filters)
    if code == ReportCode.INTEGRATION_FAILURES:
        return query_integration_failures(organization_id=organization_id, filters=filters)
    raise ValidationError({"report_code": f"Unsupported report code: {report_code}"})


def _complete_run(
    run: ReportRun, *, headers: list[str], rows: list[dict[str, object]]
) -> ReportRun:
    csv_text = render_csv(headers=headers, rows=rows)
    run.result_csv = csv_text
    run.row_count = len(rows)
    run.status = ReportRunStatus.COMPLETED
    run.completed_at = timezone.now()
    run.error_summary = ""
    run.save(
        update_fields=[
            "result_csv",
            "row_count",
            "status",
            "completed_at",
            "error_summary",
        ]
    )
    return run


@transaction.atomic
def run_quality_report(
    *,
    actor: User | None,
    organization: Organization,
    report_code: str,
    filters: dict[str, Any] | None = None,
    export: bool = False,
    force_async: bool = False,
) -> ReportRun:
    """
    Run a catalogue report for one organization.

    Cross-org denied by organization argument + permission scope.
    """
    user = _require_authenticated_actor(actor)
    try:
        definition = get_report_definition(report_code)
    except KeyError as exc:
        raise ValidationError({"report_code": "Unknown report code."}) from exc
    if export:
        require_permission(user, EXPORT_REPORT, scope=Scope(organization_id=organization.id))
    if export and "CSV" not in definition.export_formats:
        raise ValidationError({"export_format": "CSV is the only supported export format."})

    stored_filters, filt = _filters_with_site_rbac(
        user=user, organization=organization, filters=filters
    )
    # Do not persist internal RBAC keys in the run filter snapshot.
    persist_filters = {k: v for k, v in stored_filters.items() if k != "allowed_site_ids"}
    run = ReportRun.objects.create(
        organization=organization,
        report_code=definition.code.value,
        export_format=ReportExportFormat.CSV,
        status=ReportRunStatus.PENDING,
        filters=persist_filters,
        requested_by=user,
    )
    # Decide sync vs async: large limit or force_async → Celery.
    use_async = force_async or filt.limit > SYNC_ROW_SOFT_LIMIT
    if use_async:
        from apps.reports.tasks import generate_report_run

        generate_report_run.delay(str(run.id))
        record_event(
            event_type="REPORT_RUN_ENQUEUED",
            actor=user,
            metadata={
                "report_run_id": str(run.id),
                "organization_id": str(organization.id),
                "report_code": run.report_code,
                "export": export,
            },
        )
        return run

    run.status = ReportRunStatus.RUNNING
    run.started_at = timezone.now()
    run.save(update_fields=["status", "started_at"])
    try:
        headers, rows = _execute_query(
            report_code=run.report_code,
            organization_id=organization.id,
            filters=filt,
        )
        _complete_run(run, headers=headers, rows=rows)
    except Exception as exc:  # noqa: BLE001
        run.status = ReportRunStatus.FAILED
        run.error_summary = str(exc)[:255]
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "error_summary", "completed_at"])
        raise

    sensitive = export or definition.code == ReportCode.AUDIT_EVENTS
    event_type = "REPORT_EXPORTED" if sensitive else "REPORT_RUN_COMPLETED"
    record_event(
        event_type=event_type,
        actor=user,
        metadata={
            "report_run_id": str(run.id),
            "organization_id": str(organization.id),
            "report_code": run.report_code,
            "row_count": run.row_count,
            "export": export,
            "uses_immutable_snapshots": definition.uses_immutable_snapshots,
        },
    )
    return run


def get_report_run_csv(*, actor: User | None, report_run_id: uuid.UUID) -> tuple[ReportRun, str]:
    """Return CSV for a completed run — export permission + same-org recipient."""
    user = _require_authenticated_actor(actor)
    run = ReportRun.objects.filter(pk=report_run_id).first()
    if run is None:
        raise ValidationError({"report_run": "Report run not found."})
    require_permission(user, EXPORT_REPORT, scope=Scope(organization_id=run.organization_id))
    if run.status != ReportRunStatus.COMPLETED:
        raise ValidationError({"status": f"Report run is {run.status}, not COMPLETED."})
    record_event(
        event_type="REPORT_EXPORT_DOWNLOADED",
        actor=user,
        metadata={
            "report_run_id": str(run.id),
            "organization_id": str(run.organization_id),
            "report_code": run.report_code,
            "row_count": run.row_count,
        },
    )
    return run, run.result_csv


def execute_report_run_by_id(report_run_id: uuid.UUID) -> ReportRun:
    """Worker entry: generate CSV for a PENDING/RUNNING run."""
    with transaction.atomic():
        run = locked_get(ReportRun, pk=report_run_id)
        if run is None:
            raise ValidationError({"report_run": "Report run not found."})
        if run.status == ReportRunStatus.COMPLETED:
            return run
        run.status = ReportRunStatus.RUNNING
        run.started_at = timezone.now()
        run.save(update_fields=["status", "started_at"])
        try:
            # Re-apply site RBAC for the original requester on background runs.
            _, filt = _filters_with_site_rbac(
                user=run.requested_by,
                organization=run.organization,
                filters=run.filters,
            )
            headers, rows = _execute_query(
                report_code=run.report_code,
                organization_id=run.organization_id,
                filters=filt,
            )
            return _complete_run(run, headers=headers, rows=rows)
        except Exception as exc:  # noqa: BLE001
            run.status = ReportRunStatus.FAILED
            run.error_summary = str(exc)[:255]
            run.completed_at = timezone.now()
            run.save(update_fields=["status", "error_summary", "completed_at"])
            raise


def unsupported_excel_or_pdf(format_code: str) -> None:
    raise ValidationError(
        {
            "export_format": (
                f"{format_code} export is not implemented in Phase 16 foundation. "
                "CSV is supported. Excel/PDF require owner-approved libraries and need."
            )
        }
    )


def catalogue_size() -> int:
    return len(REPORT_CATALOGUE)
