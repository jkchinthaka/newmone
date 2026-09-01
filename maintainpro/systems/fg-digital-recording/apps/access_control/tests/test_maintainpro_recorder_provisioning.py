"""
FG SSO Recording Scope — MaintainPro-projected ScopedRoleAssignment provisioning.

Covers the production gap: a projected TECHNICIAN with MaintainPro fg.recording.*
permissions could authenticate into FG but never satisfied the org-level
ScopedRoleAssignment check (`organization_ids_with_permission`) that both the
recording sidebar entry and the Daily Records / Recordable tasks queries rely on.
"""

from __future__ import annotations

import time

import jwt
import pytest
from django.test import override_settings

from apps.access_control.maintainpro_provisioning import (
    RECORDER_ROLE_CODE,
    reconcile_recorder_scope,
)
from apps.access_control.models import Role, ScopedRoleAssignment
from apps.access_control.services import (
    Scope,
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.accounts.sso import establish_fg_session, verify_fg_sso_assertion
from apps.organizations.models import Organization
from apps.recording.selectors import actor_can_access_recording_module
from apps.scheduling.services import RECORD_CHECKLIST_TASK
from django.test import RequestFactory

SSO_SECRET = "test-only-fg-sso-signing-secret-min-32-chars!!"
SSO_SETTINGS = {
    "FG_SSO_SIGNING_SECRET": SSO_SECRET,
    "FG_SSO_ISSUER": "maintainpro",
    "FG_SSO_AUDIENCE": "fg-digital-recording",
}


def _mint(*, sub: str, permissions: list[str], tenant_id: str = "tenant-a") -> str:
    now = int(time.time())
    payload = {
        "iss": "maintainpro",
        "aud": "fg-digital-recording",
        "sub": sub,
        "email": f"{sub}@example.com",
        "firstName": "Test",
        "lastName": "Technician",
        "tenantId": tenant_id,
        "role": "TECHNICIAN",
        "permissions": permissions,
        "jti": f"jti-{sub}-{time.time_ns()}",
        "iat": now,
        "exp": now + 60,
    }
    return jwt.encode(payload, SSO_SECRET, algorithm="HS256")


def _make_projected_user(sub: str) -> User:
    user = User.objects.create(
        username=f"mp_{sub}",
        email=f"{sub}@example.com",
        maintainpro_user_id=sub,
    )
    user.set_unusable_password()
    user.save()
    return user


def _make_org(*, code: str, tenant_id: str) -> Organization:
    org = Organization.objects.create(code=code, name=f"Org {code}", is_active=True)
    org.maintainpro_tenant_id = tenant_id
    org.save(update_fields=["maintainpro_tenant_id"])
    return org


@pytest.mark.django_db
class TestReconcileRecorderScopeGrants:
    def test_technician_with_recording_permission_gets_org_scoped_recorder_role(self):
        org = _make_org(code="RECORG1", tenant_id="tenant-a")
        user = _make_projected_user("sub-recorder-1")

        reconcile_recorder_scope(
            user, tenant_id="tenant-a", permissions=["fg.access", "fg.recording.view"]
        )

        assignment = ScopedRoleAssignment.objects.get(
            user=user, role__code=RECORDER_ROLE_CODE, is_active=True
        )
        assert assignment.organization_id == org.id
        # Never a system-wide grant — org isolation is preserved.
        assert assignment.site_id is None
        assert assignment.department_id is None

    def test_recording_sidebar_becomes_visible(self):
        _make_org(code="RECORG2", tenant_id="tenant-b")
        user = _make_projected_user("sub-recorder-2")

        assert actor_can_access_recording_module(user) is False
        reconcile_recorder_scope(
            user, tenant_id="tenant-b", permissions=["fg.access", "fg.recording.create"]
        )
        assert actor_can_access_recording_module(user) is True

    def test_daily_records_org_scope_resolves_after_reconcile(self):
        """
        `list_recordable_checklist_tasks` filters on the same
        `organization_ids_with_permission` set used by the sidebar gate — proving
        that set now includes the tenant-mapped organization proves Daily Records /
        Recordable tasks / Open recording become queryable for this org.
        """
        org = _make_org(code="RECORG3", tenant_id="tenant-c")
        user = _make_projected_user("sub-recorder-3")

        assert organization_ids_with_permission(user, RECORD_CHECKLIST_TASK) == set()
        reconcile_recorder_scope(
            user, tenant_id="tenant-c", permissions=["fg.access", "fg.recording.submit"]
        )
        assert organization_ids_with_permission(user, RECORD_CHECKLIST_TASK) == {org.id}

    def test_idempotent_on_repeated_login(self):
        org = _make_org(code="RECORG4", tenant_id="tenant-d")
        user = _make_projected_user("sub-recorder-4")
        perms = ["fg.access", "fg.recording.view", "fg.recording.edit"]

        reconcile_recorder_scope(user, tenant_id="tenant-d", permissions=perms)
        reconcile_recorder_scope(user, tenant_id="tenant-d", permissions=perms)
        reconcile_recorder_scope(user, tenant_id="tenant-d", permissions=perms)

        assignments = ScopedRoleAssignment.objects.filter(
            user=user, role__code=RECORDER_ROLE_CODE, organization=org
        )
        assert assignments.count() == 1
        assert assignments.first().is_active is True


@pytest.mark.django_db
class TestReconcileRecorderScopeDenials:
    def test_unauthorized_technician_without_recording_permission_remains_denied(self):
        _make_org(code="RECORG5", tenant_id="tenant-e")
        user = _make_projected_user("sub-norecording-1")

        # fg.access alone (e.g. dashboard-only access) must not unlock recording.
        reconcile_recorder_scope(user, tenant_id="tenant-e", permissions=["fg.access"])

        assert not ScopedRoleAssignment.objects.filter(
            user=user, role__code=RECORDER_ROLE_CODE, is_active=True
        ).exists()
        assert actor_can_access_recording_module(user) is False

    def test_unmapped_tenant_denies_by_default(self):
        """No Organization maps to this tenant yet — fail closed, no grant at all."""
        user = _make_projected_user("sub-unmapped-tenant")

        reconcile_recorder_scope(
            user, tenant_id="tenant-does-not-exist", permissions=["fg.access", "fg.recording.view"]
        )

        assert not ScopedRoleAssignment.objects.filter(
            user=user, role__code=RECORDER_ROLE_CODE, is_active=True
        ).exists()

    def test_organization_and_tenant_isolation_preserved(self):
        org_a = _make_org(code="RECORG6A", tenant_id="tenant-f")
        _make_org(code="RECORG6B", tenant_id="tenant-g")
        user = _make_projected_user("sub-tenant-isolation")

        reconcile_recorder_scope(
            user, tenant_id="tenant-f", permissions=["fg.access", "fg.recording.view"]
        )

        org_ids = organization_ids_with_permission(user, RECORD_CHECKLIST_TASK)
        assert org_ids == {org_a.id}  # tenant-g's organization must never appear

    def test_permission_removal_on_relogin_revokes_stale_capability(self):
        org = _make_org(code="RECORG7", tenant_id="tenant-h")
        user = _make_projected_user("sub-revoke-1")

        reconcile_recorder_scope(
            user, tenant_id="tenant-h", permissions=["fg.access", "fg.recording.view"]
        )
        assert organization_ids_with_permission(user, RECORD_CHECKLIST_TASK) == {org.id}

        # MaintainPro revoked fg.recording.* — next login carries a narrower claim set.
        reconcile_recorder_scope(user, tenant_id="tenant-h", permissions=["fg.access"])

        stale = ScopedRoleAssignment.objects.get(
            user=user, role__code=RECORDER_ROLE_CODE, organization=org
        )
        assert stale.is_active is False
        assert organization_ids_with_permission(user, RECORD_CHECKLIST_TASK) == set()
        assert actor_can_access_recording_module(user) is False

    def test_pure_fg_admin_without_recording_key_gets_no_grant(self):
        _make_org(code="RECORG8", tenant_id="tenant-i")
        user = _make_projected_user("sub-admin-1")

        # A pure fg.admin with no fg.recording.* key present is unaffected by this
        # module: the grant trigger is fg.recording.* presence, not fg.admin absence.
        # fg.admin's own broader capability continues to come entirely from the
        # separate bypass in user_has_permission/user_has_permission_any_scope.
        reconcile_recorder_scope(
            user, tenant_id="tenant-i", permissions=["fg.access", "fg.admin"]
        )

        assert not ScopedRoleAssignment.objects.filter(
            user=user, role__code=RECORDER_ROLE_CODE
        ).exists()

    def test_fg_admin_with_recording_permission_still_gets_org_scoped_grant(self):
        """
        Reproduces the production incident: a principal holding fg.admin *and*
        fg.recording.* (e.g. a role over-granted the full fg.* catalog) must still
        receive the org-scoped Recorder assignment. organization_ids_with_permission
        (used by both the sidebar and Daily Records/Recordable-tasks queries) has no
        fg.admin bypass — only this module's grant closes that gap, and it must not
        skip a principal just because fg.admin also happens to be present.
        """
        org = _make_org(code="RECORG8B", tenant_id="tenant-i2")
        user = _make_projected_user("sub-admin-recording-1")

        reconcile_recorder_scope(
            user,
            tenant_id="tenant-i2",
            permissions=["fg.access", "fg.admin", "fg.recording.view", "fg.recording.edit"],
        )

        assignment = ScopedRoleAssignment.objects.get(
            user=user, role__code=RECORDER_ROLE_CODE, is_active=True
        )
        assert assignment.organization_id == org.id
        assert organization_ids_with_permission(user, RECORD_CHECKLIST_TASK) == {org.id}
        assert actor_can_access_recording_module(user) is True

        # The grant is still exactly the narrow recorder bundle — fg.admin gains
        # nothing beyond what fg.recording.* alone would have granted.
        role = Role.objects.get(code=RECORDER_ROLE_CODE)
        codenames = set(role.permissions.values_list("codename", flat=True))
        assert codenames == {"record_checklisttask", "view_checklisttask"}

    def test_no_privilege_escalation_to_unrelated_modules(self):
        org = _make_org(code="RECORG9", tenant_id="tenant-j")
        user = _make_projected_user("sub-scope-limited")

        reconcile_recorder_scope(
            user, tenant_id="tenant-j", permissions=["fg.access", "fg.recording.view"]
        )

        role = Role.objects.get(code=RECORDER_ROLE_CODE)
        codenames = set(role.permissions.values_list("codename", flat=True))
        assert codenames == {"record_checklisttask", "view_checklisttask"}

        # Recording capability must not leak into review/QA/admin scopes.
        scope = Scope(organization_id=org.id)
        assert user_has_permission(user, "reviews.review_checklistsubmission", scope=scope) is False
        assert user_has_permission(user, "quality.qa_review_checklistsubmission", scope=scope) is False
        assert user_has_permission(user, "access_control.manage_organization", scope=scope) is False


@pytest.mark.django_db
class TestSsoLoginGrantsRecorderScopeEndToEnd:
    @override_settings(**SSO_SETTINGS)
    def test_full_sso_login_grants_and_scopes_recorder_role(self):
        org = _make_org(code="RECORG10", tenant_id="tenant-k")
        token = _mint(
            sub="sub-e2e-1",
            permissions=["fg.access", "fg.recording.view", "fg.recording.edit"],
            tenant_id="tenant-k",
        )
        claims = verify_fg_sso_assertion(token, consume_jti=False)

        request = RequestFactory().get("/")
        # Django's session/auth middleware isn't in the RequestFactory chain by default;
        # attach a real session store so `login()`/`establish_fg_session` can operate.
        from django.contrib.sessions.backends.db import SessionStore

        request.session = SessionStore()

        user = establish_fg_session(request, claims)

        assert organization_ids_with_permission(user, RECORD_CHECKLIST_TASK) == {org.id}
        assert actor_can_access_recording_module(user) is True
