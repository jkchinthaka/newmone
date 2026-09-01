"""
Deterministic FG ScopedRoleAssignment provisioning for MaintainPro-projected principals.

Problem this closes: MaintainPro ``fg.*`` permission claims (session-attached by the SSO
bridge) are only one authorization gate. FG's recording navigation and the recording
module's actual data queries are gated separately by ``ScopedRoleAssignment`` /
``organization_ids_with_permission`` (see ``apps.access_control.services``), which the
SSO flow never populated — so a projected TECHNICIAN with ``fg.recording.*`` permissions
could authenticate but never satisfy the org-level ScopedRoleAssignment check, leaving
Operations / Checklist Recording / Daily Records / Recordable tasks invisible.

This module grants (and revokes) exactly one narrow, technical role — the "recorder"
bundle (``scheduling.record_checklisttask`` + ``scheduling.view_checklisttask``) — scoped
to whichever FG ``Organization`` rows are mapped to the principal's MaintainPro tenant via
``Organization.maintainpro_tenant_id``. It never:

- bypasses ``ScopedRoleAssignment`` / ``organization_ids_with_permission`` — it feeds them;
- grants Django superuser or ``is_staff``;
- creates a system-wide (organization=None) assignment — every grant is tied to a real,
  tenant-mapped ``Organization``, preserving org/tenant isolation;
- touches anything for ``fg.admin`` principals, who already get full capability through the
  existing bypass in ``apps.access_control.services`` — this function only ever adds the
  narrow recorder bundle, never anything broader;
- removes or renames the role's permission set (additive-only), and never deletes a
  ``ScopedRoleAssignment`` row — a permission that's no longer granted is *deactivated*
  (``is_active=False``), consistent with ``revoke_role_assignment``'s existing convention.

Called from ``apps.accounts.sso.establish_fg_session`` on every SSO login (idempotent —
safe to run every time), best-effort (never raises — a failure here must not block login).
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Iterable

from django.contrib.auth.models import Permission
from django.db import IntegrityError

from apps.access_control.models import Role, ScopedRoleAssignment
from apps.access_control.services import assign_role, revoke_role_assignment
from apps.accounts.models import User
from apps.organizations.models import Organization

logger = logging.getLogger(__name__)

RECORDER_ROLE_CODE = "MAINTAINPRO_RECORDER"
RECORDER_ROLE_NAME = "MaintainPro Recorder (SSO-projected)"
RECORDER_ROLE_DESCRIPTION = (
    "Auto-provisioned, org-scoped recording capability for MaintainPro SSO principals "
    "holding fg.recording.* permissions. Managed by apps.access_control."
    "maintainpro_provisioning — do not assign manually; edits to this role's permission "
    "set are additive-only and reconciled on every SSO login."
)

# The Django permissions that unlock the recording module's navigation entry and its
# organization-scoped data queries (apps.recording.selectors, apps.scheduling.services).
RECORDER_DJANGO_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("scheduling", "record_checklisttask"),
    ("scheduling", "view_checklisttask"),
)

# Any one of these MaintainPro fg.* keys is sufficient to unlock the recorder bundle —
# from MaintainPro's point of view, recording is one capability with view/create/edit/
# submit granularity; FG's own view decorators still enforce the finer split per action.
RECORDER_FG_TRIGGER_KEYS: tuple[str, ...] = (
    "fg.recording.view",
    "fg.recording.create",
    "fg.recording.edit",
    "fg.recording.submit",
)


def _get_or_create_recorder_role() -> Role:
    role = Role.objects.filter(code__iexact=RECORDER_ROLE_CODE).first()
    if role is None:
        try:
            role = Role.objects.create(
                code=RECORDER_ROLE_CODE,
                name=RECORDER_ROLE_NAME,
                description=RECORDER_ROLE_DESCRIPTION,
                is_active=True,
            )
        except IntegrityError:
            # Concurrent first-provisioning from another request — the CI-unique
            # constraint on Role.code guarantees exactly one survivor.
            role = Role.objects.filter(code__iexact=RECORDER_ROLE_CODE).first()
            if role is None:
                raise

    wanted_ids: set[uuid.UUID] = set()
    for app_label, codename in RECORDER_DJANGO_PERMISSIONS:
        perm = Permission.objects.filter(
            content_type__app_label=app_label, codename=codename
        ).first()
        if perm is not None:
            wanted_ids.add(perm.pk)

    if wanted_ids:
        current_ids = set(role.permissions.values_list("pk", flat=True))
        missing = wanted_ids - current_ids
        if missing:
            role.permissions.add(*missing)

    return role


def _organizations_for_tenant(tenant_id: str) -> list[Organization]:
    tenant = (tenant_id or "").strip()
    if not tenant:
        return []
    return list(Organization.objects.filter(maintainpro_tenant_id=tenant))


def reconcile_recorder_scope(
    user: User,
    *,
    tenant_id: str,
    permissions: Iterable[str],
) -> None:
    """
    Idempotently grant or revoke the FG Recorder ``ScopedRoleAssignment`` for a
    MaintainPro-projected principal, based on their current ``fg.*`` claims and tenant.

    Safe to call on every login. Never raises: authorization provisioning must never be
    allowed to block an otherwise-valid SSO session — worst case, the user simply does
    not see the recording module this session and can retry.
    """
    try:
        permission_set = set(permissions)

        # fg.admin already receives full capability via the existing bypass in
        # apps.access_control.services.user_has_permission(_any_scope); leave it alone.
        if "fg.admin" in permission_set:
            return

        should_have_recorder = any(key in permission_set for key in RECORDER_FG_TRIGGER_KEYS)
        target_orgs = _organizations_for_tenant(tenant_id) if should_have_recorder else []
        target_org_ids = {org.id for org in target_orgs}

        existing_assignments = list(
            ScopedRoleAssignment.objects.filter(
                user=user, role__code__iexact=RECORDER_ROLE_CODE, is_active=True
            )
        )

        # Revoke anything no longer justified: permission removed, tenant changed, or the
        # mapped organization no longer resolves. This is what makes a MaintainPro-side
        # revocation (or tenant re-assignment) reconcile on the very next FG login.
        for assignment in existing_assignments:
            if not should_have_recorder or assignment.organization_id not in target_org_ids:
                revoke_role_assignment(assignment, actor=None, request=None)

        if not should_have_recorder or not target_orgs:
            return

        role = _get_or_create_recorder_role()
        if not role.is_active:
            # Administrative kill-switch: an operator disabled the auto-provisioned role
            # itself. Respect it — do not create new assignments against a disabled role.
            return

        already_covered_org_ids = {
            a.organization_id for a in existing_assignments if a.organization_id in target_org_ids
        }
        for org in target_orgs:
            if org.id in already_covered_org_ids:
                continue
            try:
                assign_role(user=user, role=role, organization=org, assigned_by=None)
            except Exception:  # noqa: BLE001 — duplicate-under-race is a no-op, not a failure
                logger.info(
                    "fg_recorder_scope_assign_skipped maintainpro_user_id=%s organization_id=%s",
                    getattr(user, "maintainpro_user_id", None),
                    org.id,
                )
    except Exception:  # noqa: BLE001 — provisioning must never block SSO login
        logger.exception(
            "fg_recorder_scope_reconcile_failed maintainpro_user_id=%s",
            getattr(user, "maintainpro_user_id", None),
        )
