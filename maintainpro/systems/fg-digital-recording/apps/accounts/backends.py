"""Authentication backend: employee_code + password."""

from __future__ import annotations

from typing import Any

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AnonymousUser
from django.db.models import Q
from django.http import HttpRequest
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.validators import normalize_employee_code


class EmployeeCodeBackend(ModelBackend):
    """
    Authenticate by employee_code and password.

    Failures are generic at the service/view layer; this backend returns None
    for unknown, inactive, locked, or bad-password cases.
    Password-hash work runs for unknown, inactive, and locked paths to reduce
    timing-based employee-code enumeration risk (not a hard timing guarantee).
    Retains ModelBackend permission compatibility via inheritance.
    """

    def authenticate(
        self,
        request: HttpRequest | None = None,
        username: str | None = None,
        password: str | None = None,
        **kwargs: Any,
    ) -> User | None:
        employee_code = kwargs.get("employee_code", username)
        if employee_code is None or password is None:
            return None

        normalized = normalize_employee_code(str(employee_code))
        if not normalized:
            User().set_password(password)
            return None

        try:
            user = User.objects.get(Q(employee_code__iexact=normalized))
        except User.DoesNotExist:
            # Run default password hasher to mitigate timing differences.
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            User().set_password(password)
            return None

        # Always verify the password hash before branch decisions so locked and
        # inactive accounts perform comparable work to the bad-password path.
        password_ok = user.check_password(password)

        if not self.user_can_authenticate(user):
            return None

        if user.locked_until is not None and user.locked_until > timezone.now():
            return None

        if not password_ok:
            return None

        if not isinstance(user, User):
            return None
        return user

    def user_can_authenticate(self, user: User | AnonymousUser | None) -> bool:
        return bool(getattr(user, "is_active", True))
