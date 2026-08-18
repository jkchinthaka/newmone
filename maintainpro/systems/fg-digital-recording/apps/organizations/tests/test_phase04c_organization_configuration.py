"""Phase 04C organization configuration — synthetic codes only; no Nelna seeds."""

from __future__ import annotations

import datetime
from io import StringIO
from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from tests.factories import grant_role, make_org, make_site, make_user

from apps.access_control.services import create_role
from apps.organizations.hierarchy_import import (
    empty_template_csv,
    format_error_report,
    import_organization_hierarchy,
)
from apps.organizations.historical_safety import refuse_hard_delete
from apps.organizations.models import Department, Organization, Shift, Site
from apps.organizations.services import (
    create_department,
    create_organization,
    create_shift,
    create_site,
    deactivate_department,
    deactivate_organization,
    deactivate_site,
    reactivate_site,
    update_department,
    update_organization,
)
from apps.security_audit.models import SecurityAuditEvent

_mgr_seq = 0


def _perm(app_label: str, codename: str) -> Permission:
    return Permission.objects.get(content_type__app_label=app_label, codename=codename)


def _manager_with(perms: list[tuple[str, str]], *, organization: Any = None) -> Any:
    global _mgr_seq
    _mgr_seq += 1
    user = make_user(employee_code=f"MGR04C{_mgr_seq:02d}", is_staff=True)
    permissions = [_perm(a, c) for a, c in perms]
    role = create_role(
        code=f"R04CMGR{_mgr_seq:02d}",
        name="Org config manager",
        permissions=permissions,
    )
    grant_role(user, role, organization=organization)
    return user


@pytest.mark.django_db
def test_empty_template_has_headers_only_no_company_rows() -> None:
    csv_text = empty_template_csv()
    lines = [ln for ln in csv_text.strip().splitlines() if ln.strip()]
    assert len(lines) == 1
    assert "entity_type" in lines[0]


@pytest.mark.django_db
def test_authorized_org_site_department_lifecycle_and_audit() -> None:
    actor = _manager_with(
        [
            ("organizations", "manage_organization"),
            ("organizations", "manage_site"),
            ("organizations", "manage_department"),
        ]
    )
    org = create_organization(actor=actor, code="syn04corg", name="Synthetic Org")
    assert org.code == "SYN04CORG"
    assert SecurityAuditEvent.objects.filter(event_type="ORGANIZATION_CREATED").exists()

    update_organization(actor=actor, organization_id=org.id, name="Synthetic Org Updated")
    assert SecurityAuditEvent.objects.filter(event_type="ORGANIZATION_UPDATED").exists()

    site = create_site(actor=actor, organization=org, code="syn04csite", name="Synthetic Site")
    assert site.code == "SYN04CSITE"
    dept = create_department(
        actor=actor,
        organization=org,
        site=site,
        code="syn04cdept",
        name="Synthetic Dept",
    )
    assert dept.code == "SYN04CDEPT"
    assert SecurityAuditEvent.objects.filter(event_type="DEPARTMENT_CREATED").exists()


@pytest.mark.django_db
def test_cross_org_site_management_denied() -> None:
    org_a = make_org(code="ORG04CA")
    org_b = make_org(code="ORG04CB")
    actor = _manager_with([("organizations", "manage_site")], organization=org_a)
    with pytest.raises(PermissionDenied):
        create_site(actor=actor, organization=org_b, code="SITE04CX", name="Denied")


@pytest.mark.django_db
def test_wrong_org_department_hierarchy_rejected() -> None:
    org_a = make_org(code="ORG04CA")
    org_b = make_org(code="ORG04CB")
    site_b = make_site(org_b, code="SITE04CB")
    with pytest.raises(ValidationError):
        create_department(
            organization=org_a,
            code="DEPT04CX",
            name="Mismatch",
            site=site_b,
        )


@pytest.mark.django_db
def test_inactive_and_reactivate_rules() -> None:
    org = make_org(code="ORG04CIN")
    site = make_site(org, code="SITE04CIN")
    deactivate_organization(org)
    org.refresh_from_db()
    assert org.is_active is False
    with pytest.raises(ValidationError):
        reactivate_site(site)


@pytest.mark.django_db
def test_hard_delete_refused_for_historical_safety() -> None:
    org = make_org(code="ORG04CDL")
    site = make_site(org, code="SITE04CDL")
    with pytest.raises(ValidationError):
        refuse_hard_delete(site)
    with pytest.raises(ValidationError):
        refuse_hard_delete(org)
    assert Site.objects.filter(pk=site.pk).exists()


@pytest.mark.django_db
def test_overnight_shift_and_invalid_effective_window() -> None:
    org = make_org(code="ORG04CSH")
    actor = make_user(employee_code="SHF04C01", is_superuser=True)
    shift = create_shift(
        actor=actor,
        organization=org,
        code="SYN04CNGT",
        name="Synthetic Night",
        start_time=datetime.time(22, 0),
        end_time=datetime.time(6, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    assert shift.is_overnight is True
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            code="SYN04CBAD",
            name="Bad Window",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 2, 1),
            effective_to=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_import_dry_run_and_commit_and_failure() -> None:
    actor = make_user(employee_code="IMP04C01", is_superuser=True)
    csv_ok = (
        "entity_type,organization_code,site_code,department_code,code,name,"
        "is_active,start_time,end_time,effective_from,effective_to\n"
        "organization,,,,SYN04CIMP,Synthetic Import Org,true,,,,\n"
        "site,SYN04CIMP,,,SYN04CS1,Synthetic Import Site,true,,,,\n"
        "department,SYN04CIMP,SYN04CS1,,SYN04CD1,Synthetic Import Dept,true,,,,\n"
        "shift,SYN04CIMP,SYN04CS1,SYN04CD1,SYN04CSFT,Synthetic Import Shift,"
        "true,08:00,16:00,2026-01-01,\n"
    )
    preview = import_organization_hierarchy(actor=actor, source=StringIO(csv_ok), dry_run=True)
    assert preview.ok
    assert preview.organizations_to_create == 1
    assert Organization.objects.filter(code="SYN04CIMP").count() == 0
    assert SecurityAuditEvent.objects.filter(
        event_type="ORGANIZATION_HIERARCHY_IMPORT_PREVIEWED"
    ).exists()

    committed = import_organization_hierarchy(actor=actor, source=StringIO(csv_ok), dry_run=False)
    assert committed.ok
    assert Organization.objects.filter(code="SYN04CIMP").exists()
    assert Site.objects.filter(code="SYN04CS1").exists()
    assert Department.objects.filter(code="SYN04CD1").exists()
    assert Shift.objects.filter(code="SYN04CSFT").exists()
    assert SecurityAuditEvent.objects.filter(
        event_type="ORGANIZATION_HIERARCHY_IMPORT_COMPLETED"
    ).exists()

    failed = import_organization_hierarchy(actor=actor, source=StringIO(csv_ok), dry_run=False)
    assert not failed.ok
    assert failed.duplicate_codes
    report = format_error_report(failed)
    assert "row_number,field,message" in report
    assert SecurityAuditEvent.objects.filter(
        event_type="ORGANIZATION_HIERARCHY_IMPORT_FAILED"
    ).exists()


@pytest.mark.django_db
def test_import_rejects_unknown_org_and_unauthenticated() -> None:
    actor = make_user(employee_code="IMP04C02", is_superuser=True)
    bad = (
        "entity_type,organization_code,site_code,department_code,code,name,"
        "is_active,start_time,end_time,effective_from,effective_to\n"
        "site,MISSINGORG,,,SITE04CX,X,true,,,,\n"
    )
    preview = import_organization_hierarchy(actor=actor, source=StringIO(bad), dry_run=True)
    assert not preview.ok
    with pytest.raises(PermissionDenied):
        import_organization_hierarchy(actor=None, source=StringIO(bad), dry_run=True)


@pytest.mark.django_db
def test_admin_blocks_hard_delete() -> None:
    from django.contrib.admin.sites import site as admin_site
    from django.http import QueryDict

    from apps.organizations.admin import OrganizationAdmin, ShiftAdmin, SiteAdmin

    request = type(
        "R",
        (),
        {
            "user": make_user(employee_code="ADM04C01", is_superuser=True),
            "GET": QueryDict(),
        },
    )()
    org_admin = OrganizationAdmin(Organization, admin_site)
    assert org_admin.has_delete_permission(request) is False
    assert "delete_selected" not in org_admin.get_actions(request)
    assert SiteAdmin(Site, admin_site).has_delete_permission(request) is False
    assert ShiftAdmin(Shift, admin_site).has_delete_permission(request) is False


@pytest.mark.django_db
def test_update_department_and_deactivate_with_actor() -> None:
    actor = make_user(employee_code="UPD04C01", is_superuser=True)
    org = create_organization(actor=actor, code="ORG04CUP", name="Up Org")
    site = create_site(actor=actor, organization=org, code="SITE04CUP", name="Up Site")
    dept = create_department(
        actor=actor, organization=org, site=site, code="DEPT04CUP", name="Up Dept"
    )
    updated = update_department(actor=actor, department_id=dept.id, name="Up Dept 2")
    assert updated.name == "Up Dept 2"
    assert SecurityAuditEvent.objects.filter(event_type="DEPARTMENT_UPDATED").exists()
    deactivate_department(dept, actor=actor)
    dept.refresh_from_db()
    assert dept.is_active is False
    deactivate_site(site, actor=actor)
    site.refresh_from_db()
    assert site.is_active is False


@pytest.mark.django_db
def test_management_command_template_and_dry_run(tmp_path: Path) -> None:
    template = tmp_path / "tmpl.csv"
    call_command("import_organization_hierarchy", write_template=str(template), stdout=StringIO())
    assert template.exists()
    assert "entity_type" in template.read_text(encoding="utf-8")

    actor = make_user(employee_code="CMD04C01", is_superuser=True)
    csv_path = tmp_path / "rows.csv"
    csv_path.write_text(
        empty_template_csv() + "organization,,,,SYN04CCMD,Synthetic Cmd Org,true,,,,\n",
        encoding="utf-8",
    )
    err_path = tmp_path / "errors.csv"
    call_command(
        "import_organization_hierarchy",
        csv_path=str(csv_path),
        actor=str(actor.id),
        error_file=str(err_path),
        stdout=StringIO(),
    )
    assert Organization.objects.filter(code="SYN04CCMD").count() == 0

    with pytest.raises(CommandError):
        call_command(
            "import_organization_hierarchy",
            csv_path=str(csv_path),
            actor="not-a-uuid",
            stdout=StringIO(),
        )


@pytest.mark.django_db
def test_no_seeded_nelna_company_values() -> None:
    assert Organization.objects.filter(code__iexact="NELNA").count() == 0
    assert Shift.objects.filter(code__iexact="DAY").count() == 0
    assert Shift.objects.filter(code__iexact="NIGHT").count() == 0
