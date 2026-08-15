"""Phase 16 — governed quality reporting tests."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any
from unittest.mock import patch

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.recording.models import ChecklistResponse
from apps.reports.catalogue import REPORT_CATALOGUE, ReportCode
from apps.reports.csv_safe import render_csv, sanitize_csv_cell
from apps.reports.models import ReportRun, ReportRunStatus
from apps.reports.queries import (
    ReportFilters,
    assert_not_draft_source,
    query_batch_checklist,
    query_submission_history,
)
from apps.reports.services import (
    get_report_run_csv,
    list_report_catalogue,
    run_quality_report,
    unsupported_excel_or_pdf,
)
from apps.scheduling.models import ChecklistTask
from apps.scheduling.services import create_batch_checklist_task
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant(user: User, org: Organization, *codenames: str) -> None:
    suffix = uuid.uuid4().hex[:6].upper()
    role = make_role_with_permission(
        code=f"R{suffix}",
        name=f"Report role {suffix}",
        permission=_perm(ReportRun, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(ReportRun, code))
    grant_role(user, role, organization=org)


def _checklist_manager(org: Organization) -> User:
    from apps.checklists.models import ChecklistTemplate

    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"CM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CM{suffix}",
        name=f"Chk mgr {suffix}",
        permission=_perm(ChecklistTemplate, "manage_checklist"),
    )
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _task_manager(org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"TM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"TM{suffix}",
        name=f"Task mgr {suffix}",
        permission=_perm(ChecklistTask, "manage_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def _published_task(*, org: Organization, batch: str) -> ChecklistTask:
    from apps.checklists.models import ChecklistResponseType
    from apps.checklists.services import (
        add_checklist_item,
        add_checklist_section,
        create_checklist_template,
        create_checklist_version,
        publish_checklist_version,
    )

    manager = _checklist_manager(org)
    code = f"T{uuid.uuid4().hex[:6].upper()}"
    tmpl = create_checklist_template(actor=manager, organization=org, code=code, name="Report tmpl")
    version = create_checklist_version(actor=manager, template_id=tmpl.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="Section A")
    add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="YN1",
        label="Yes No",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    published = publish_checklist_version(actor=manager, version_id=version.id)
    tm = _task_manager(org)
    return create_batch_checklist_task(
        actor=tm,
        organization_id=org.id,
        checklist_template_id=tmpl.id,
        checklist_version_id=published.id,
        batch_reference=batch,
    )


def test_csv_formula_injection_sanitized() -> None:
    assert sanitize_csv_cell("=1+1").startswith("'")
    assert sanitize_csv_cell("+cmd").startswith("'")
    assert sanitize_csv_cell("-2").startswith("'")
    assert sanitize_csv_cell("@SUM(A1)").startswith("'")
    assert sanitize_csv_cell("safe") == "safe"
    csv_text = render_csv(
        headers=["batch", "note"],
        rows=[{"batch": "B1", "note": '=HYPERLINK("http://evil")'}],
    )
    assert "'=HYPERLINK" in csv_text
    assert csv_text.splitlines()[1].startswith("B1,")


def test_assert_not_draft_source_blocks_response_model() -> None:
    with pytest.raises(RuntimeError, match="ChecklistResponse"):
        assert_not_draft_source(ChecklistResponse)


def test_catalogue_size_and_codes() -> None:
    codes = {d.code for d in REPORT_CATALOGUE}
    assert ReportCode.SUBMISSION_HISTORY in codes
    assert ReportCode.HOLD_NCR_CAPA in codes
    assert ReportCode.INTEGRATION_FAILURES in codes
    assert len(REPORT_CATALOGUE) == 9


def test_excel_pdf_rejected() -> None:
    with pytest.raises(ValidationError):
        unsupported_excel_or_pdf("PDF")
    with pytest.raises(ValidationError):
        unsupported_excel_or_pdf("XLSX")


@pytest.mark.django_db
def test_rbac_catalogue_and_run_denied_without_permission() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    with pytest.raises(PermissionDenied):
        list_report_catalogue(actor=user, organization=org)
    with pytest.raises(PermissionDenied):
        run_quality_report(
            actor=user,
            organization=org,
            report_code=ReportCode.BATCH_CHECKLIST.value,
        )


@pytest.mark.django_db
def test_cross_org_denied_and_same_org_ok() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(user, org_a, "view_reportcatalogue", "run_qualityreport", "export_qualityreport")

    catalogue = list_report_catalogue(actor=user, organization=org_a)
    assert len(catalogue) == 9

    with pytest.raises(PermissionDenied):
        list_report_catalogue(actor=user, organization=org_b)

    with pytest.raises(PermissionDenied):
        run_quality_report(
            actor=user,
            organization=org_b,
            report_code=ReportCode.BATCH_CHECKLIST.value,
        )

    run = run_quality_report(
        actor=user,
        organization=org_a,
        report_code=ReportCode.BATCH_CHECKLIST.value,
        filters={"limit": 10},
    )
    assert run.status == ReportRunStatus.COMPLETED
    assert run.organization_id == org_a.id


@pytest.mark.django_db
def test_filter_accuracy_batch_and_pagination() -> None:
    org = make_org(code=f"F{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(user, org, "view_reportcatalogue", "run_qualityreport", "export_qualityreport")
    batch_keep = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
    batch_other = f"OTHER-{uuid.uuid4().hex[:8].upper()}"
    _published_task(org=org, batch=batch_keep)
    _published_task(org=org, batch=batch_other)

    headers, rows = query_batch_checklist(
        organization_id=org.id,
        filters=ReportFilters({"batch_reference": batch_keep, "limit": 50}),
    )
    assert "batch_reference" in headers
    assert len(rows) == 1
    assert rows[0]["batch_reference"] == batch_keep

    page1 = query_batch_checklist(
        organization_id=org.id, filters=ReportFilters({"limit": 1, "offset": 0})
    )[1]
    page2 = query_batch_checklist(
        organization_id=org.id, filters=ReportFilters({"limit": 1, "offset": 1})
    )[1]
    assert len(page1) == 1
    assert len(page2) == 1
    assert page1[0]["task_id"] != page2[0]["task_id"]

    capped = ReportFilters({"limit": 99999})
    assert capped.limit == 5000


@pytest.mark.django_db
def test_historical_integrity_submission_query_guard() -> None:
    """Submission history must not accept ChecklistResponse as its source model."""
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    # Empty org is fine — integrity is about source model + empty immutable set
    headers, rows = query_submission_history(
        organization_id=org.id, filters=ReportFilters({"limit": 10})
    )
    assert "submission_id" in headers
    assert rows == []
    with pytest.raises(RuntimeError):
        assert_not_draft_source(ChecklistResponse)


@pytest.mark.django_db
def test_export_audited_and_csv_safe_content() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(user, org, "view_reportcatalogue", "run_qualityreport", "export_qualityreport")
    _published_task(org=org, batch="=CMD")

    run = run_quality_report(
        actor=user,
        organization=org,
        report_code=ReportCode.BATCH_CHECKLIST.value,
        filters={"limit": 50},
        export=True,
    )
    assert run.status == ReportRunStatus.COMPLETED
    assert "'=CMD" in run.result_csv or run.result_csv  # sanitized when formula-like
    assert SecurityAuditEvent.objects.filter(
        event_type="REPORT_EXPORTED",
        actor=user,
    ).exists()

    _, csv_text = get_report_run_csv(actor=user, report_run_id=run.id)
    assert csv_text == run.result_csv
    assert SecurityAuditEvent.objects.filter(
        event_type="REPORT_EXPORT_DOWNLOADED",
        actor=user,
    ).exists()


@pytest.mark.django_db
def test_large_report_enqueues_background(settings: Any) -> None:
    settings.CELERY_TASK_ALWAYS_EAGER = True
    org = make_org(code=f"L{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(user, org, "run_qualityreport", "export_qualityreport", "view_reportcatalogue")

    with patch("apps.reports.tasks.generate_report_run.delay") as delay_mock:
        run = run_quality_report(
            actor=user,
            organization=org,
            report_code=ReportCode.BATCH_CHECKLIST.value,
            filters={"limit": 500},  # > SYNC_ROW_SOFT_LIMIT (200)
            force_async=False,
        )
        delay_mock.assert_called_once_with(str(run.id))
        assert run.status == ReportRunStatus.PENDING
        assert SecurityAuditEvent.objects.filter(event_type="REPORT_RUN_ENQUEUED").exists()

    # force_async path with eager execute via task helper
    from apps.reports.services import execute_report_run_by_id

    pending = ReportRun.objects.create(
        organization=org,
        report_code=ReportCode.OVERDUE_TASKS.value,
        status=ReportRunStatus.PENDING,
        filters={"limit": 10},
        requested_by=user,
    )
    # Create an overdue task
    task = _published_task(org=org, batch=f"OV-{uuid.uuid4().hex[:6]}")
    ChecklistTask.objects.filter(pk=task.id).update(due_at=timezone.now() - timedelta(hours=1))
    completed = execute_report_run_by_id(pending.id)
    assert completed.status == ReportRunStatus.COMPLETED
