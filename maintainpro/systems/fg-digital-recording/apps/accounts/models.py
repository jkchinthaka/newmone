"""Custom user model with employee-code authentication and lockout fields."""

from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.accounts.managers import UserManager
from apps.accounts.validators import normalize_employee_code


class User(AbstractUser):
    """
    Named individual account. Shared accounts are prohibited.

    employee_code is nullable to allow safe migration from the foundation user
    via direct ORM construction. UserManager.create_user / create_superuser and
    Django admin creation require a non-empty employee_code. Authentication via
    EmployeeCodeBackend rejects accounts without a code.

    Codes are stored normalized (strip + uppercase). Uniqueness is therefore a
    plain unique constraint — Mongo-compatible (no expression index / Lower()).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_code = models.CharField(max_length=64, null=True, blank=True)  # noqa: DJ001
    must_change_password = models.BooleanField(default=False)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    failed_login_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_failed_login_at = models.DateTimeField(null=True, blank=True)
    last_successful_login_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()  # type: ignore[misc]

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        constraints = [
            models.UniqueConstraint(
                fields=["employee_code"],
                condition=models.Q(employee_code__isnull=False),
                name="acct_user_emp_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["employee_code"], name="acct_user_emp_code_idx"),
            models.Index(fields=["locked_until"], name="acct_user_locked_until_idx"),
        ]

    def save(self, *args: object, **kwargs: object) -> None:
        if self.employee_code is not None:
            normalized = normalize_employee_code(str(self.employee_code))
            self.employee_code = normalized or None
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        if self.employee_code:
            return self.employee_code
        return self.username

    @property
    def is_locked(self) -> bool:
        from django.utils import timezone

        return self.locked_until is not None and self.locked_until > timezone.now()
