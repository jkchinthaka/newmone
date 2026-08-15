"""Read-side selectors for access control."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.access_control.models import Role, ScopedRoleAssignment
from apps.accounts.models import User


def get_role_by_code(code: str) -> Role | None:
    return Role.objects.filter(code__iexact=code.strip()).first()


def get_role_by_id(role_id: uuid.UUID) -> Role | None:
    return Role.objects.filter(pk=role_id).first()


def list_active_roles() -> QuerySet[Role]:
    return Role.objects.filter(is_active=True)


def list_active_assignments_for_user(user: User) -> QuerySet[ScopedRoleAssignment]:
    return (
        ScopedRoleAssignment.objects.filter(user=user, is_active=True)
        .select_related("role", "organization", "site", "department")
        .order_by("-created_at")
    )
