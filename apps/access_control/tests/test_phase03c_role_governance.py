"""Phase 03C operational role governance — synthetic roles only; no Nelna seeds."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from tests.factories import grant_role, make_org, make_user

from apps.access_control.governance_services import (
    apply_role_template_to_role,
    create_role_template,
    list_sod_open_questions,
    set_role_permissions,
    update_role_template_permissions,
)
from apps.access_control.models import Role, RoleTemplate, ScopedRoleAssignment
from apps.access_control.permission_catalogue import technical_permission_codenames
from apps.access_control.services import (
    Scope,
    assign_role,
    create_role,
    user_has_permission,
)
from apps.security_audit.models import SecurityAuditEvent


def _perm(app_label: str, codename: str) -> Permission:
    return Permission.objects.get(content_type__app_label=app_label, codename=codename)


def _real_perm_or_skip(app_label: str, codename: str) -> Permission:
    perm = Permission.objects.filter(content_type__app_label=app_label, codename=codename).first()
    if perm is None:
        pytest.skip(f"Permission {app_label}.{codename} not present in DB")
    return perm


@pytest.mark.django_db
def test_cross_org_denial() -> None:
    user = make_user(employee_code="TST03C01")
    org_a = make_org(code="ORG03CA")
    org_b = make_org(code="ORG03CB")
    manage = _real_perm_or_skip("scheduling", "manage_checklisttask")
    role = create_role(code="R03CMAN", name="Manage only", permissions=[manage])
    grant_role(user, role, organization=org_a)

    assert user_has_permission(
        user,
        "scheduling.manage_checklisttask",
        scope=Scope(organization_id=org_a.id),
    )
    assert not user_has_permission(
        user,
        "scheduling.manage_checklisttask",
        scope=Scope(organization_id=org_b.id),
    )


@pytest.mark.django_db
def test_inactive_role_and_assignment_grant_nothing() -> None:
    user = make_user(employee_code="TST03C02")
    record = _real_perm_or_skip("scheduling", "record_checklisttask")
    role = create_role(code="R03CREC", name="Recorder tech", permissions=[record])
    assignment = grant_role(user, role)

    role.is_active = False
    role.save(update_fields=["is_active"])
    assert user_has_permission(user, "scheduling.record_checklisttask") is False

    role.is_active = True
    role.save(update_fields=["is_active"])
    assignment.is_active = False  # type: ignore[attr-defined]
    assignment.save(update_fields=["is_active", "updated_at"])  # type: ignore[attr-defined]
    assert user_has_permission(user, "scheduling.record_checklisttask") is False


@pytest.mark.django_db
def test_expired_and_future_valid_from_grant_nothing() -> None:
    user = make_user(employee_code="TST03C03")
    record = _real_perm_or_skip("scheduling", "record_checklisttask")
    role = create_role(code="R03CVW", name="Validity window", permissions=[record])
    now = timezone.now()

    past = assign_role(
        user=user,
        role=role,
        valid_from=now - timedelta(days=5),
        valid_until=now - timedelta(hours=1),
    )
    assert user_has_permission(user, "scheduling.record_checklisttask") is False
    assert past.is_currently_valid() is False

    past.is_active = False
    past.save(update_fields=["is_active", "updated_at"])

    future = assign_role(
        user=user,
        role=role,
        valid_from=now + timedelta(days=1),
        valid_until=now + timedelta(days=10),
    )
    assert user_has_permission(user, "scheduling.record_checklisttask") is False
    assert future.is_currently_valid() is False


@pytest.mark.django_db
def test_manage_does_not_imply_record() -> None:
    user = make_user(employee_code="TST03C04")
    manage = _real_perm_or_skip("scheduling", "manage_checklisttask")
    role = create_role(code="R03CMNR", name="Manage not record", permissions=[manage])
    grant_role(user, role)

    assert user_has_permission(user, "scheduling.manage_checklisttask") is True
    assert user_has_permission(user, "scheduling.record_checklisttask") is False


@pytest.mark.django_db
def test_record_does_not_imply_review_or_qa() -> None:
    user = make_user(employee_code="TST03C05")
    record = _real_perm_or_skip("scheduling", "record_checklisttask")
    role = create_role(code="R03CRNR", name="Record not review", permissions=[record])
    grant_role(user, role)

    assert user_has_permission(user, "scheduling.record_checklisttask") is True
    assert user_has_permission(user, "reviews.review_checklistsubmission") is False
    assert user_has_permission(user, "quality.qa_review_checklistsubmission") is False


@pytest.mark.django_db
def test_review_does_not_imply_qa_review() -> None:
    user = make_user(employee_code="TST03C06")
    review = _real_perm_or_skip("reviews", "review_checklistsubmission")
    role = create_role(code="R03CREV", name="Review not QA", permissions=[review])
    grant_role(user, role)

    assert user_has_permission(user, "reviews.review_checklistsubmission") is True
    assert user_has_permission(user, "quality.qa_review_checklistsubmission") is False
    assert user_has_permission(user, "scheduling.record_checklisttask") is False


@pytest.mark.django_db
def test_apply_role_template_does_not_create_assignment() -> None:
    actor = make_user(employee_code="TST03C07")
    record = _real_perm_or_skip("scheduling", "record_checklisttask")
    template = create_role_template(
        actor,
        code="TMP03C1",
        name="Tech recorder bundle",
        permission_codenames=["scheduling.record_checklisttask"],
        business_category_hint="Operator / Production Employee",
    )
    assert template.business_category_hint == "Operator / Production Employee"
    role = create_role(code="R03CEMP", name="Empty role")
    assert role.permissions.count() == 0
    before = ScopedRoleAssignment.objects.count()

    apply_role_template_to_role(actor, template.id, role.id)

    role.refresh_from_db()
    assert list(role.permissions.values_list("codename", flat=True)) == ["record_checklisttask"]
    assert ScopedRoleAssignment.objects.count() == before
    assert not ScopedRoleAssignment.objects.filter(role=role).exists()

    event = SecurityAuditEvent.objects.filter(event_type="ROLE_TEMPLATE_APPLIED").latest(
        "created_at"
    )
    assert event.metadata.get("scoped_role_assignments_created") == 0
    assert event.metadata.get("business_approved") is False
    meta_blob = str(event.metadata).lower()
    assert "password" not in meta_blob
    assert "secret" not in meta_blob
    assert record.codename in meta_blob or "scheduling.record_checklisttask" in meta_blob


@pytest.mark.django_db
def test_set_role_permissions_audited_without_secrets() -> None:
    actor = make_user(employee_code="TST03C08")
    manage = _real_perm_or_skip("scheduling", "manage_checklisttask")
    _real_perm_or_skip("scheduling", "record_checklisttask")
    role = create_role(code="R03CSET", name="Set perms", permissions=[manage])

    set_role_permissions(
        actor,
        role.id,
        ["scheduling.record_checklisttask"],
    )
    role.refresh_from_db()
    assert list(role.permissions.values_list("codename", flat=True)) == ["record_checklisttask"]

    event = SecurityAuditEvent.objects.filter(event_type="ROLE_PERMISSIONS_UPDATED").latest(
        "created_at"
    )
    assert event.actor_id == actor.id
    assert "scheduling.record_checklisttask" in event.metadata.get("permissions_after", [])
    assert "scheduling.manage_checklisttask" in event.metadata.get("permissions_before", [])
    assert "password" not in event.metadata
    assert "secret" not in str(event.metadata).lower()
    # ensure we did not store raw credential-like fields
    for key in event.metadata:
        assert key.lower() not in {"password", "token", "authorization", "secret"}


@pytest.mark.django_db
def test_update_role_template_permissions_audited() -> None:
    actor = make_user(employee_code="TST03C09")
    _real_perm_or_skip("scheduling", "record_checklisttask")
    _real_perm_or_skip("reviews", "review_checklistsubmission")
    template = create_role_template(
        actor,
        code="TMP03C2",
        name="Empty then update",
        permission_codenames=["scheduling.record_checklisttask"],
    )
    update_role_template_permissions(
        actor,
        template.id,
        ["reviews.review_checklistsubmission"],
    )
    template.refresh_from_db()
    assert list(template.permissions.values_list("codename", flat=True)) == [
        "review_checklistsubmission"
    ]
    event = SecurityAuditEvent.objects.filter(event_type="ROLE_TEMPLATE_UPDATED").latest(
        "created_at"
    )
    assert event.metadata.get("business_approved") is False


@pytest.mark.django_db
def test_permission_catalogue_resolves_to_real_permissions() -> None:
    missing: list[str] = []
    for key in sorted(technical_permission_codenames()):
        if key == "__django_superuser__":
            continue
        app_label, _, codename = key.partition(".")
        exists = Permission.objects.filter(
            content_type__app_label=app_label, codename=codename
        ).exists()
        if not exists:
            # Prefer only real ones; skip with clear reason if ContentType not migrated yet
            ct_exists = ContentType.objects.filter(app_label=app_label).exists()
            if not ct_exists:
                pytest.skip(f"ContentType for app {app_label} not present; cannot resolve {key}")
            missing.append(key)
    assert missing == [], f"Catalogue entries missing Permission rows: {missing}"


@pytest.mark.django_db
def test_list_sod_open_questions_all_pending() -> None:
    items = list_sod_open_questions()
    assert len(items) == 6
    assert all(i["status"] == "PENDING" for i in items)
    assert all(i["response"] == "" for i in items)


@pytest.mark.django_db
def test_role_template_not_seeded_as_approved_business_role() -> None:
    assert RoleTemplate.objects.filter(code__iexact="SUPERVISOR").count() == 0
    assert RoleTemplate.objects.filter(code__iexact="QA_MANAGER").count() == 0
    assert Role.objects.filter(code__iexact="SUPERVISOR").count() == 0
    assert Role.objects.filter(code__iexact="QA_MANAGER").count() == 0
