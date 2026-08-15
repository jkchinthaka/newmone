"""Authorization policy helpers — thin wrappers over services for call sites."""

from __future__ import annotations

from uuid import UUID

from apps.access_control.services import (
    Scope,
    get_accessible_departments,
    get_accessible_organizations,
    get_accessible_sites,
    get_effective_permissions,
    require_permission,
    user_has_permission,
)
from apps.accounts.models import User


def can_access(
    user: User | None,
    permission: str,
    *,
    organization_id: UUID | None = None,
    site_id: UUID | None = None,
    department_id: UUID | None = None,
) -> bool:
    scope = Scope(
        organization_id=organization_id,
        site_id=site_id,
        department_id=department_id,
    )
    return user_has_permission(user, permission, scope=scope)


def assert_can_access(
    user: User | None,
    permission: str,
    *,
    organization_id: UUID | None = None,
    site_id: UUID | None = None,
    department_id: UUID | None = None,
) -> None:
    scope = Scope(
        organization_id=organization_id,
        site_id=site_id,
        department_id=department_id,
    )
    require_permission(user, permission, scope=scope)


__all__ = [
    "Scope",
    "assert_can_access",
    "can_access",
    "get_accessible_departments",
    "get_accessible_organizations",
    "get_accessible_sites",
    "get_effective_permissions",
    "require_permission",
    "user_has_permission",
]
