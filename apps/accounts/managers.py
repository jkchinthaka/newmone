"""User managers — require employee_code for normal application accounts."""

from __future__ import annotations

from typing import Any

from django.contrib.auth.models import UserManager as DjangoUserManager


class UserManager(DjangoUserManager):  # type: ignore[type-arg]
    """
    Application account creation requires a non-empty employee_code.

    Nullable employee_code remains on the model for Phase 02 migration
    compatibility via direct ORM construction only (not create_user).
    """

    def create_user(
        self,
        username: str,
        email: str | None = None,
        password: str | None = None,
        **extra_fields: Any,
    ) -> Any:
        from apps.accounts.validators import normalize_employee_code

        raw_code = extra_fields.get("employee_code")
        if raw_code is None or not str(raw_code).strip():
            raise ValueError(
                "employee_code is required for normal application accounts. "
                "Nullable codes are reserved for migration-compatible ORM paths only."
            )
        extra_fields["employee_code"] = normalize_employee_code(str(raw_code))
        return super().create_user(username, email=email, password=password, **extra_fields)

    def create_superuser(
        self,
        username: str,
        email: str | None = None,
        password: str | None = None,
        **extra_fields: Any,
    ) -> Any:
        from apps.accounts.validators import normalize_employee_code

        raw_code = extra_fields.get("employee_code")
        if raw_code is None or not str(raw_code).strip():
            raise ValueError(
                "employee_code is required for normal application accounts. "
                "Nullable codes are reserved for migration-compatible ORM paths only."
            )
        extra_fields["employee_code"] = normalize_employee_code(str(raw_code))
        return super().create_superuser(
            username,
            email=email,
            password=password,
            **extra_fields,
        )
