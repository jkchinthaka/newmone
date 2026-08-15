"""Scoped RBAC models — deny by default; no invented Nelna business roles."""

from __future__ import annotations

import uuid
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class Role(models.Model):
    """Named role with Django permissions. Codes are technical until owners confirm."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    permissions = models.ManyToManyField(Permission, blank=True, related_name="access_roles")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                name="ac_role_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["is_active"], name="ac_role_active_idx"),
            models.Index(Lower("code"), name="ac_role_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class RoleTemplate(models.Model):
    """
    Technical permission bundle for optional copy onto a Role.

    Not a business-approved role. Does not assign users. Optional
    ``business_category_hint`` is documentation only — never approval evidence.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="access_role_templates",
    )
    business_category_hint = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Documentation hint only. Not business approval.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                name="ac_role_template_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["is_active"], name="ac_role_tmpl_active_idx"),
            models.Index(Lower("code"), name="ac_role_tmpl_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class ScopedRoleAssignment(models.Model):
    """
    Assign a role to a user within an optional organization/site/department scope.

    valid_from / valid_until are temporary/effective windows for the assignment
    (documented in Phase 03C; field names preserved). Inactive or outside-window
    assignments grant nothing.

    Hierarchy rules (fail closed):
    - site requires organization; site must belong to organization
    - department requires organization; if site set, department must belong to site
    - department.organization must match assignment organization
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="scoped_role_assignments",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="assignments",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="role_assignments",
    )
    site = models.ForeignKey(
        "organizations.Site",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="role_assignments",
    )
    department = models.ForeignKey(
        "organizations.Department",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="role_assignments",
    )
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="roles_assigned",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["user", "role", "organization", "site", "department"],
                condition=models.Q(is_active=True),
                nulls_distinct=False,
                name="ac_active_assignment_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "is_active"], name="ac_assign_user_idx"),
            models.Index(fields=["organization", "is_active"], name="ac_assign_org_idx"),
            models.Index(fields=["valid_until"], name="ac_assign_until_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.role.code}"

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}

        if self.site_id and not self.organization_id:
            errors["organization"] = "Organization is required when site is set."
        if self.department_id and not self.organization_id:
            errors["organization"] = "Organization is required when department is set."

        site = self.site
        department = self.department

        if site is not None and self.organization_id:
            if site.organization_id != self.organization_id:
                errors["site"] = "Site must belong to the selected organization."

        if department is not None and self.organization_id:
            if department.organization_id != self.organization_id:
                errors["department"] = "Department must belong to the selected organization."

        if department is not None and self.site_id:
            if department.site_id and department.site_id != self.site_id:
                errors["department"] = "Department must belong to the selected site."
            if department.site_id is None:
                # Org-level department assigned with a site is ambiguous — reject.
                errors["department"] = (
                    "Cannot scope an organization-level department to a specific site."
                )

        if self.valid_from and self.valid_until and self.valid_from >= self.valid_until:
            errors["valid_until"] = "valid_until must be after valid_from."

        if errors:
            raise ValidationError(errors)

    def is_currently_valid(self, at: datetime | None = None) -> bool:
        moment = at or timezone.now()
        if not self.is_active:
            return False
        if self.valid_from and moment < self.valid_from:
            return False
        if self.valid_until and moment >= self.valid_until:
            return False
        return True
