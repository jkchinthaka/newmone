"""Shift domain foundation tests — synthetic codes only, no Nelna operational values."""

from __future__ import annotations

import datetime
import uuid

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.http import QueryDict
from tests.factories import (
    grant_role,
    make_department,
    make_org,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.accounts.models import User
from apps.organizations.admin import ShiftAdmin
from apps.organizations.models import Department, Organization, Shift, Site
from apps.organizations.selectors import (
    get_shift_by_id,
    list_active_shifts_for_actor,
    list_shifts_for_actor,
)
from apps.organizations.services import (
    activate_shift,
    create_shift,
    deactivate_shift,
    normalize_code,
    normalize_name,
    update_shift,
)
from apps.security_audit.models import SecurityAuditEvent


def _shift_permission(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(Shift)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _user_with_shift_manage(
    *,
    org: Organization | None = None,
    site: Site | None = None,
    department: Department | None = None,
) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"SHFM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"SHIFTMGR{suffix}",
        name=f"Shift Manager Test {suffix}",
        permission=_shift_permission("manage_shift"),
    )
    role.permissions.add(_shift_permission("view_shift"))
    grant_role(user, role, organization=org, site=site, department=department)
    return user


def _user_with_shift_view(
    *,
    org: Organization | None = None,
    site: Site | None = None,
    department: Department | None = None,
) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"SHFV{suffix}")
    role = make_role_with_permission(
        code=f"SHIFTVIEW{suffix}",
        name=f"Shift Viewer Test {suffix}",
        permission=_shift_permission("view_shift"),
    )
    grant_role(user, role, organization=org, site=site, department=department)
    return user


@pytest.mark.django_db
def test_normalize_helpers() -> None:
    assert normalize_code("  shift-test  ") == "SHIFT-TEST"
    assert normalize_name("  Morning Line  ") == "Morning Line"


@pytest.mark.django_db
def test_create_organization_wide_shift() -> None:
    org = make_org(code="ORG-TEST")
    actor = _user_with_shift_manage(org=org)
    shift = create_shift(
        actor=actor,
        organization=org,
        code="shift-test",
        name=" Synthetic Shift ",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    assert shift.code == "SHIFT-TEST"
    assert shift.name == "Synthetic Shift"
    assert shift.site_id is None
    assert shift.department_id is None
    assert shift.is_overnight is False
    assert SecurityAuditEvent.objects.filter(event_type="SHIFT_CREATED").exists()


@pytest.mark.django_db
def test_site_and_department_scoped_shifts() -> None:
    org = make_org(code="ORG-TEST")
    site = make_site(org, code="SITE-TEST")
    dept = make_department(org, code="DEPT-TEST", site=site)
    actor = _user_with_shift_manage(org=org)
    site_shift = create_shift(
        actor=actor,
        organization=org,
        site=site,
        code="SHIFT-TEST",
        name="Site Shift",
        start_time=datetime.time(6, 0),
        end_time=datetime.time(14, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    dept_shift = create_shift(
        actor=actor,
        organization=org,
        site=site,
        department=dept,
        code="SHIFT-TEST",
        name="Dept Shift",
        start_time=datetime.time(14, 0),
        end_time=datetime.time(22, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    assert site_shift.site_id == site.id
    assert dept_shift.department_id == dept.id


@pytest.mark.django_db
def test_department_without_site_rejected() -> None:
    org = make_org(code="ORG-TEST")
    site = make_site(org, code="SITE-TEST")
    dept = make_department(org, code="DEPT-TEST", site=site)
    actor = _user_with_shift_manage(org=org)
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            department=dept,
            code="SHIFT-TEST",
            name="Bad Scope",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_cross_organization_references_rejected() -> None:
    org_a = make_org(code="ORG-TEST-A")
    org_b = make_org(code="ORG-TEST-B")
    site_b = make_site(org_b, code="SITE-TEST")
    dept_b = make_department(org_b, code="DEPT-TEST", site=site_b)
    actor = _user_with_shift_manage(org=org_a)
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org_a,
            site=site_b,
            code="SHIFT-TEST",
            name="Bad Site",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org_a,
            site=make_site(org_a, code="SITE-A"),
            department=dept_b,
            code="SHIFT-TEST-2",
            name="Bad Dept",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_department_must_belong_to_selected_site() -> None:
    org = make_org(code="ORG-TEST")
    site_a = make_site(org, code="SITE-A")
    site_b = make_site(org, code="SITE-B")
    dept_b = make_department(org, code="DEPT-TEST", site=site_b)
    actor = _user_with_shift_manage(org=org)
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            site=site_a,
            department=dept_b,
            code="SHIFT-TEST",
            name="Mismatch",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_effective_to_before_from_rejected() -> None:
    org = make_org(code="ORG-TEST")
    actor = _user_with_shift_manage(org=org)
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            code="SHIFT-TEST",
            name="Window",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 2, 1),
            effective_to=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_blank_code_and_name_rejected() -> None:
    org = make_org(code="ORG-TEST")
    actor = _user_with_shift_manage(org=org)
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            code="   ",
            name="Named",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            code="SHIFT-TEST",
            name="   ",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_duplicate_codes_within_same_scope_rejected() -> None:
    org = make_org(code="ORG-TEST")
    site = make_site(org, code="SITE-TEST")
    dept = make_department(org, code="DEPT-TEST", site=site)
    actor = _user_with_shift_manage(org=org)
    create_shift(
        actor=actor,
        organization=org,
        code="SHIFT-TEST",
        name="One",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            code="SHIFT-TEST",
            name="One",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )

    create_shift(
        actor=actor,
        organization=org,
        code="SHIFT-TEST",
        name="Site One",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
        site=site,
    )
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            code="SHIFT-TEST",
            name="Site Dup",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
            site=site,
        )

    create_shift(
        actor=actor,
        organization=org,
        code="SHIFT-TEST",
        name="Dept One",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
        site=site,
        department=dept,
    )
    with pytest.raises(ValidationError):
        create_shift(
            actor=actor,
            organization=org,
            code="SHIFT-TEST",
            name="Dept Dup",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
            site=site,
            department=dept,
        )


@pytest.mark.django_db
def test_nulls_distinct_duplicate_org_wide_via_orm() -> None:
    org = make_org(code="ORG-TEST")
    Shift.objects.create(
        organization=org,
        code="SHIFT-TEST",
        name="One",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
        site=None,
        department=None,
    )
    with pytest.raises(IntegrityError):
        Shift.objects.create(
            organization=org,
            code="shift-test",
            name="Two",
            start_time=datetime.time(9, 0),
            end_time=datetime.time(17, 0),
            effective_from=datetime.date(2026, 1, 1),
            site=None,
            department=None,
        )


@pytest.mark.django_db
def test_overnight_calculation() -> None:
    org = make_org(code="ORG-TEST")
    actor = _user_with_shift_manage(org=org)
    day = create_shift(
        actor=actor,
        organization=org,
        code="DAY-TEST",
        name="Day",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    night = create_shift(
        actor=actor,
        organization=org,
        code="NIGHT-TEST",
        name="Night",
        start_time=datetime.time(22, 0),
        end_time=datetime.time(6, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    equal = create_shift(
        actor=actor,
        organization=org,
        code="EQUAL-TEST",
        name="Equal",
        start_time=datetime.time(12, 0),
        end_time=datetime.time(12, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    assert day.is_overnight is False
    assert night.is_overnight is True
    assert equal.is_overnight is True


@pytest.mark.django_db
def test_unauthorized_create_denied() -> None:
    org = make_org(code="ORG-TEST")
    outsider = make_user(employee_code="SHFOUT1")
    with pytest.raises(PermissionDenied):
        create_shift(
            actor=outsider,
            organization=org,
            code="SHIFT-TEST",
            name="Denied",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_scoped_create_outside_assignment_denied() -> None:
    org_a = make_org(code="ORG-A")
    org_b = make_org(code="ORG-B")
    actor = _user_with_shift_manage(org=org_a)
    with pytest.raises(PermissionDenied):
        create_shift(
            actor=actor,
            organization=org_b,
            code="SHIFT-TEST",
            name="Wrong Org",
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            effective_from=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_update_activate_deactivate_and_audit() -> None:
    org = make_org(code="ORG-TEST")
    actor = _user_with_shift_manage(org=org)
    shift = create_shift(
        actor=actor,
        organization=org,
        code="SHIFT-TEST",
        name="Original",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    updated = update_shift(actor=actor, shift_id=shift.id, name="Updated Name")
    assert updated.name == "Updated Name"
    assert SecurityAuditEvent.objects.filter(event_type="SHIFT_UPDATED").exists()

    deactivated = deactivate_shift(actor=actor, shift_id=shift.id)
    assert deactivated.is_active is False
    assert SecurityAuditEvent.objects.filter(event_type="SHIFT_DEACTIVATED").exists()

    activated = activate_shift(actor=actor, shift_id=shift.id)
    assert activated.is_active is True
    assert SecurityAuditEvent.objects.filter(event_type="SHIFT_ACTIVATED").exists()


@pytest.mark.django_db
def test_no_hard_delete_service_and_admin_restriction() -> None:
    assert not hasattr(
        __import__("apps.organizations.services", fromlist=["delete_shift"]),
        "delete_shift",
    )
    model_admin = ShiftAdmin(Shift, admin.site)
    request = type(
        "Req",
        (),
        {
            "user": make_user(employee_code="SHFADM2", is_staff=True),
            "GET": QueryDict(),
        },
    )()
    assert model_admin.has_delete_permission(request) is False
    assert "delete_selected" not in model_admin.get_actions(request)


@pytest.mark.django_db
def test_selectors_scoped_visibility() -> None:
    org_a = make_org(code="ORG-A")
    org_b = make_org(code="ORG-B")
    actor_a = _user_with_shift_manage(org=org_a)
    actor_b = _user_with_shift_manage(org=org_b)
    viewer_a = _user_with_shift_view(org=org_a)

    shift_a = create_shift(
        actor=actor_a,
        organization=org_a,
        code="SHIFT-A",
        name="A",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    create_shift(
        actor=actor_b,
        organization=org_b,
        code="SHIFT-B",
        name="B",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    deactivate_shift(actor=actor_a, shift_id=shift_a.id)

    visible = list(list_shifts_for_actor(viewer_a))
    assert len(visible) == 1
    assert visible[0].organization_id == org_a.id

    active = list(list_active_shifts_for_actor(viewer_a))
    assert active == []

    fetched = get_shift_by_id(viewer_a, shift_a.id)
    assert fetched is not None

    shift_b2 = create_shift(
        actor=actor_b,
        organization=org_b,
        code="SHIFT-B2",
        name="B2",
        start_time=datetime.time(9, 0),
        end_time=datetime.time(17, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    with pytest.raises(PermissionDenied):
        get_shift_by_id(viewer_a, shift_b2.id)


@pytest.mark.django_db
def test_admin_registration() -> None:
    assert admin.site.is_registered(Shift)
    model_admin = ShiftAdmin(Shift, admin.site)
    assert "code" in model_admin.list_display
    assert "organization" in model_admin.list_filter
    assert "code" in model_admin.search_fields
