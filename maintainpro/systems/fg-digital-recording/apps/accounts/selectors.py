"""Read-side selectors for accounts."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.accounts.models import User
from apps.accounts.validators import normalize_employee_code


def get_user_by_id(user_id: uuid.UUID) -> User | None:
    return User.objects.filter(pk=user_id).first()


def get_user_by_employee_code(employee_code: str) -> User | None:
    normalized = normalize_employee_code(employee_code)
    if not normalized:
        return None
    return User.objects.filter(employee_code__iexact=normalized).first()


def list_active_users() -> QuerySet[User]:
    return User.objects.filter(is_active=True)


def list_locked_users() -> QuerySet[User]:
    from django.utils import timezone

    return User.objects.filter(locked_until__gt=timezone.now())
