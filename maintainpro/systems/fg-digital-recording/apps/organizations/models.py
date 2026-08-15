"""Organization hierarchy foundation models — no invented Nelna operational values."""

from __future__ import annotations

import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower


class Organization(models.Model):
    """Top-level organization container. Codes are synthetic until owners confirm values."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("code",)
        permissions = [
            ("manage_organization", "Can manage organization"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                name="org_organization_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["is_active"], name="org_org_active_idx"),
            models.Index(Lower("code"), name="org_org_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class Site(models.Model):
    """Site belonging to an organization. Code unique within organization (case-insensitive)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sites",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        permissions = [
            ("manage_site", "Can manage site"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="org_site_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"], name="org_site_org_act_idx"),
            models.Index(Lower("code"), name="org_site_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class Department(models.Model):
    """
    Department belonging to an organization, optionally bound to a site.

    When site is set, it must belong to the same organization.
    Code uniqueness is scoped: within organization when site is null;
    within site when site is set.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="departments",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="departments",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        permissions = [
            ("manage_department", "Can manage department"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                condition=models.Q(site__isnull=True),
                name="org_dept_org_code_ci_uniq",
            ),
            models.UniqueConstraint(
                Lower("code"),
                "site",
                condition=models.Q(site__isnull=False),
                name="org_dept_site_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"], name="org_dept_org_act_idx"),
            models.Index(fields=["site", "is_active"], name="org_dept_site_act_idx"),
            models.Index(Lower("code"), name="org_dept_code_lower_idx"),
        ]

    def __str__(self) -> str:
        site = self.site
        if site is not None:
            return f"{self.organization.code}/{site.code}/{self.code}"
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        site = self.site
        if site is not None and site.organization_id != self.organization_id:
            raise ValidationError(
                {"site": "Site must belong to the same organization as the department."}
            )


class Shift(models.Model):
    """
    Configurable operational Shift definition.

    Codes and names are administrator-configured. No business Shift rows are seeded.
    Official Nelna shift values remain gated by ASM-004/005/006 evidence.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="shifts",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="shifts",
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="shifts",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    start_time = models.TimeField()
    end_time = models.TimeField()
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code", "effective_from")
        permissions = [
            ("manage_shift", "Can manage shift"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                "site",
                "department",
                nulls_distinct=False,
                name="org_shift_scope_code_ci_uniq",
            ),
            models.CheckConstraint(
                condition=models.Q(department__isnull=True) | models.Q(site__isnull=False),
                name="org_shift_department_requires_site",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(effective_to__isnull=True)
                    | models.Q(effective_to__gte=models.F("effective_from"))
                ),
                name="org_shift_effective_window_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "is_active"],
                name="org_shift_org_act_idx",
            ),
            models.Index(fields=["site", "is_active"], name="org_shift_site_act_idx"),
            models.Index(
                fields=["department", "is_active"],
                name="org_shift_dept_act_idx",
            ),
            models.Index(Lower("code"), name="org_shift_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    @property
    def is_overnight(self) -> bool:
        """True when end_time is less than or equal to start_time (provisional overnight rule)."""
        return self.end_time <= self.start_time

    @property
    def scope_label(self) -> str:
        """Human-readable interface scope label (not a seeded business value)."""
        if self.department_id:
            return "Department-specific"
        if self.site_id:
            return "Site-wide"
        return "Organization-wide"

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}

        if self.department_id and not self.site_id:
            errors["department"] = "Department requires a site."

        site = self.site
        department = self.department

        if site is not None and site.organization_id != self.organization_id:
            errors["site"] = "Site must belong to the selected organization."

        if department is not None and department.organization_id != self.organization_id:
            errors["department"] = "Department must belong to the selected organization."

        if department is not None and self.site_id:
            if department.site_id != self.site_id:
                errors["department"] = "Department must belong to the selected site."

        if (
            self.effective_to is not None
            and self.effective_from is not None
            and self.effective_to < self.effective_from
        ):
            errors["effective_to"] = "effective_to cannot be earlier than effective_from."

        if errors:
            raise ValidationError(errors)
