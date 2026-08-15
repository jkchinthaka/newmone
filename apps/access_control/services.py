"""Authorization scope and permission evaluation — fail closed."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from django.contrib.auth.models import Permission
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.access_control.models import Role, ScopedRoleAssignment
from apps.accounts.models import User
from apps.core.persistence import prefetch_related_compat
from apps.organizations.models import Department, Organization, Site


@dataclass(frozen=True, slots=True)
class Scope:
    organization_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None


def normalize_role_code(value: str) -> str:
    return value.strip().upper()


def _active_assignments_qs(user: User) -> QuerySet[ScopedRoleAssignment]:
    now = timezone.now()
    return prefetch_related_compat(
        ScopedRoleAssignment.objects.filter(user=user, is_active=True, role__is_active=True)
        .filter(Q(valid_from__isnull=True) | Q(valid_from__lte=now))
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
        .select_related("role", "organization", "site", "department"),
        "role__permissions",
    )


def _assignment_covers_scope(assignment: ScopedRoleAssignment, scope: Scope | None) -> bool:
    """
    Broader assignments cover narrower scopes.

    System-wide (no org/site/dept) covers everything.
    Org covers all sites/depts in that org.
    Site covers all depts in that site.
    Dept covers only that dept.
    """
    if scope is None:
        # No scope requested: only system-wide assignments grant.
        return (
            assignment.organization_id is None
            and assignment.site_id is None
            and assignment.department_id is None
        )

    # Assignment department must match when set.
    if assignment.department_id is not None:
        return scope.department_id == assignment.department_id

    # Assignment site: covers that site and its departments.
    if assignment.site_id is not None:
        if scope.site_id is not None:
            return scope.site_id == assignment.site_id
        if scope.department_id is not None:
            dept = Department.objects.filter(pk=scope.department_id).first()
            return dept is not None and dept.site_id == assignment.site_id
        return False

    # Assignment organization: covers that org's sites/departments.
    if assignment.organization_id is not None:
        if scope.organization_id is not None:
            return scope.organization_id == assignment.organization_id
        if scope.site_id is not None:
            site = Site.objects.filter(pk=scope.site_id).first()
            return site is not None and site.organization_id == assignment.organization_id
        if scope.department_id is not None:
            dept = Department.objects.filter(pk=scope.department_id).first()
            return dept is not None and dept.organization_id == assignment.organization_id
        return False

    # System-wide assignment.
    return True


def _permission_codename_matches(permission: Permission, required: str) -> bool:
    """Accept 'app_label.codename' or bare 'codename'."""
    if "." in required:
        app_label, codename = required.split(".", 1)
        return permission.content_type.app_label == app_label and permission.codename == codename
    return permission.codename == required


def user_has_permission(
    user: User | None,
    permission: str,
    scope: Scope | None = None,
) -> bool:
    """Fail closed: anonymous / inactive users never have permissions."""
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if not user.is_active:
        return False
    if user.is_superuser:
        return True

    for assignment in _active_assignments_qs(user):
        if not _assignment_covers_scope(assignment, scope):
            continue
        for perm in assignment.role.permissions.all():
            if _permission_codename_matches(perm, permission):
                return True
    return False


def require_permission(
    user: User | None,
    permission: str,
    scope: Scope | None = None,
) -> None:
    if not user_has_permission(user, permission, scope=scope):
        raise PermissionDenied("Permission denied.")


def user_has_permission_any_scope(user: User | None, permission: str) -> bool:
    """
    True when the user holds the permission under any active assignment.

    Used for module entry points (for example list pages) where a specific
    organization/site/department scope is not yet selected.
    """
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    for assignment in _active_assignments_qs(user):
        for perm in assignment.role.permissions.all():
            if _permission_codename_matches(perm, permission):
                return True
    return False


def organization_ids_with_permission(user: User | None, permission: str) -> set[uuid.UUID]:
    """
    Organization IDs where the actor holds ``permission`` for org-level Scope.

    Site-only or department-only assignments do not grant org-level Scope
    (see ``_assignment_covers_scope``). Superusers and system-wide grants
    return all organization primary keys.
    """
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return set()
    if user.is_superuser:
        return set(Organization.objects.values_list("pk", flat=True))

    org_ids: set[uuid.UUID] = set()
    for assignment in _active_assignments_qs(user):
        has_perm = any(
            _permission_codename_matches(perm, permission)
            for perm in assignment.role.permissions.all()
        )
        if not has_perm:
            continue
        if assignment.department_id is not None or assignment.site_id is not None:
            continue
        if assignment.organization_id is None:
            return set(Organization.objects.values_list("pk", flat=True))
        org_ids.add(assignment.organization_id)
    return org_ids


def get_effective_permissions(
    user: User | None,
    scope: Scope | None = None,
) -> set[str]:
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return set()
    if user.is_superuser:
        return {
            f"{p.content_type.app_label}.{p.codename}"
            for p in Permission.objects.select_related("content_type").all()
        }

    result: set[str] = set()
    for assignment in _active_assignments_qs(user):
        if not _assignment_covers_scope(assignment, scope):
            continue
        for perm in assignment.role.permissions.all():
            result.add(f"{perm.content_type.app_label}.{perm.codename}")
    return result


def get_accessible_organizations(user: User | None) -> QuerySet[Organization]:
    if user is None or not user.is_authenticated or not user.is_active:
        return Organization.objects.none()
    if user.is_superuser:
        return Organization.objects.filter(is_active=True)

    org_ids: set[uuid.UUID] = set()
    system_wide = False
    for assignment in _active_assignments_qs(user):
        if assignment.organization_id is None:
            system_wide = True
            break
        org_ids.add(assignment.organization_id)

    if system_wide:
        return Organization.objects.filter(is_active=True)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True)


def get_accessible_sites(
    user: User | None,
    *,
    organization_id: uuid.UUID | None = None,
) -> QuerySet[Site]:
    if user is None or not user.is_authenticated or not user.is_active:
        return Site.objects.none()
    if user.is_superuser:
        qs = Site.objects.filter(is_active=True)
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        return qs

    site_ids: set[uuid.UUID] = set()
    org_wide: set[uuid.UUID] = set()
    system_wide = False

    for assignment in _active_assignments_qs(user):
        if assignment.organization_id is None and assignment.site_id is None:
            system_wide = True
            break
        if assignment.site_id is not None:
            site_ids.add(assignment.site_id)
        elif assignment.organization_id is not None:
            org_wide.add(assignment.organization_id)

    if system_wide:
        qs = Site.objects.filter(is_active=True)
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        return qs

    q = Q(pk__in=site_ids) | Q(organization_id__in=org_wide)
    qs = Site.objects.filter(q, is_active=True)
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return qs.distinct()


def get_accessible_departments(
    user: User | None,
    *,
    organization_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
) -> QuerySet[Department]:
    if user is None or not user.is_authenticated or not user.is_active:
        return Department.objects.none()
    if user.is_superuser:
        qs = Department.objects.filter(is_active=True)
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        if site_id:
            qs = qs.filter(site_id=site_id)
        return qs

    dept_ids: set[uuid.UUID] = set()
    site_wide: set[uuid.UUID] = set()
    org_wide: set[uuid.UUID] = set()
    system_wide = False

    for assignment in _active_assignments_qs(user):
        if (
            assignment.organization_id is None
            and assignment.site_id is None
            and assignment.department_id is None
        ):
            system_wide = True
            break
        if assignment.department_id is not None:
            dept_ids.add(assignment.department_id)
        elif assignment.site_id is not None:
            site_wide.add(assignment.site_id)
        elif assignment.organization_id is not None:
            org_wide.add(assignment.organization_id)

    if system_wide:
        qs = Department.objects.filter(is_active=True)
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        if site_id:
            qs = qs.filter(site_id=site_id)
        return qs

    q = Q(pk__in=dept_ids) | Q(site_id__in=site_wide) | Q(organization_id__in=org_wide)
    qs = Department.objects.filter(q, is_active=True)
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    if site_id:
        qs = qs.filter(site_id=site_id)
    return qs.distinct()


@transaction.atomic
def create_role(
    *,
    code: str,
    name: str,
    description: str = "",
    permissions: list[Permission] | None = None,
) -> Role:
    role = Role.objects.create(
        code=normalize_role_code(code),
        name=name.strip(),
        description=description,
    )
    if permissions:
        role.permissions.set(permissions)
    return role


@transaction.atomic
def assign_role(
    *,
    user: User,
    role: Role,
    organization: Organization | None = None,
    site: Site | None = None,
    department: Department | None = None,
    assigned_by: User | None = None,
    valid_from: datetime | None = None,
    valid_until: datetime | None = None,
    request: object | None = None,
) -> ScopedRoleAssignment:
    from apps.security_audit.services import record_event

    assignment = ScopedRoleAssignment(
        user=user,
        role=role,
        organization=organization,
        site=site,
        department=department,
        assigned_by=assigned_by,
        valid_from=valid_from,
        valid_until=valid_until,
        is_active=True,
    )

    duplicate = ScopedRoleAssignment.objects.filter(
        user=user,
        role=role,
        organization=organization,
        site=site,
        department=department,
        is_active=True,
    ).exists()
    if duplicate:
        raise ValidationError("An active assignment with this scope already exists.")

    try:
        assignment.full_clean()
    except ValidationError as exc:
        messages = exc.messages if hasattr(exc, "messages") else []
        joined = " ".join(str(m) for m in messages)
        if "ac_active_assignment_uniq" in joined or "unique" in joined.lower():
            raise ValidationError("An active assignment with this scope already exists.") from exc
        raise

    try:
        assignment.save()
    except IntegrityError as exc:
        # Authoritative guard under race: PostgreSQL NULLS NOT DISTINCT unique index.
        raise ValidationError("An active assignment with this scope already exists.") from exc

    request_id = getattr(request, "correlation_id", None) if request else None
    ip = None
    ua = ""
    if request is not None and hasattr(request, "META"):
        ip = request.META.get("REMOTE_ADDR")
        ua = (request.META.get("HTTP_USER_AGENT") or "")[:512]

    record_event(
        event_type="ROLE_ASSIGNED",
        actor=assigned_by,
        subject_user=user,
        request_id=request_id,
        ip_address=ip,
        user_agent_summary=ua,
        metadata={
            "role_code": role.code,
            "assignment_id": str(assignment.id),
            "organization_id": str(organization.id) if organization else None,
            "site_id": str(site.id) if site else None,
            "department_id": str(department.id) if department else None,
        },
    )
    return assignment


@transaction.atomic
def revoke_role_assignment(
    assignment: ScopedRoleAssignment,
    *,
    actor: User | None = None,
    request: object | None = None,
) -> ScopedRoleAssignment:
    from apps.security_audit.services import record_event

    assignment.is_active = False
    assignment.save(update_fields=["is_active", "updated_at"])

    request_id = getattr(request, "correlation_id", None) if request else None
    ip = None
    ua = ""
    if request is not None and hasattr(request, "META"):
        ip = request.META.get("REMOTE_ADDR")
        ua = (request.META.get("HTTP_USER_AGENT") or "")[:512]

    record_event(
        event_type="ROLE_REVOKED",
        actor=actor,
        subject_user=assignment.user,
        request_id=request_id,
        ip_address=ip,
        user_agent_summary=ua,
        metadata={
            "role_code": assignment.role.code,
            "assignment_id": str(assignment.id),
        },
    )
    return assignment
