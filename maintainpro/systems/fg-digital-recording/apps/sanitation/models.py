"""Sanitation / SSOP program shells — Phase 27.

Reuses the configurable checklist engine and scheduler. Does not invent
cleaning chemicals, concentrations, frequencies, ATP/swab limits, or
approval procedures. Production-stop on FAIL remains OFF until approved.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Department, Organization, Site


class SanitationProgramVersionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    RETIRED = "RETIRED", "Retired"


class SanitationScheduleKind(models.TextChoices):
    """Configurable schedule intent labels — frequencies remain EVIDENCE REQUIRED."""

    PRE_OP = "PRE_OP", "Pre-operational"
    POST_OP = "POST_OP", "Post-operational"
    SHIFT = "SHIFT", "Shift-based"
    DAILY = "DAILY", "Daily"
    PERIODIC = "PERIODIC", "Periodic"


class SanitationVerificationMode(models.TextChoices):
    """
    Which *existing* recording/review workflows apply — not a new approval procedure.

    Company must approve which mode is used (APR-053). Modes only reference
    already-delivered operator submit / Supervisor review / QA review chains.
    """

    SELF_CHECK = "SELF_CHECK", "Operator self-check (submit only)"
    SUPERVISOR = "SUPERVISOR", "Self-check + Supervisor verification"
    QA = "QA", "Self-check + Supervisor + QA verification"


class SanitationProgram(models.Model):
    """Stable identity for a sanitation / SSOP program linked to one checklist template."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sanitation_programs",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        related_name="sanitation_programs",
        help_text="Reusable checklist engine template — not a separate sanitation form engine.",
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sanitation_programs_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Sanitation program"
        verbose_name_plural = "Sanitation programs"
        permissions = [
            ("manage_sanitationprogram", "Can draft/edit sanitation programs"),
            ("publish_sanitationprogram", "Can approve/retire sanitation program versions"),
            ("view_sanitation", "Can view sanitation programs (read-only)"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="sanitation_program_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        if (
            self.checklist_template_id
            and self.organization_id
            and self.checklist_template.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"checklist_template": "Checklist template must belong to the same organization."}
            )


class SanitationProgramVersion(models.Model):
    """Immutable after APPROVED/RETIRED — historical bindings PROTECT this row."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        SanitationProgram,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=SanitationProgramVersionStatus.choices,
        default=SanitationProgramVersionStatus.DRAFT,
    )
    verification_mode = models.CharField(
        max_length=16,
        choices=SanitationVerificationMode.choices,
        default=SanitationVerificationMode.SELF_CHECK,
        help_text="Selects existing workflow layers only — not invented SSOP approval steps.",
    )
    change_summary = models.TextField(blank=True, default="")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sanitation_versions_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sanitation_versions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("program__code", "-version_number")
        verbose_name = "Sanitation program version"
        verbose_name_plural = "Sanitation program versions"
        constraints = [
            models.UniqueConstraint(
                fields=["program", "version_number"],
                name="sanitation_program_version_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.program.code} v{self.version_number} ({self.status})"

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            SanitationProgramVersionStatus.APPROVED,
            SanitationProgramVersionStatus.RETIRED,
        }


class SanitationScope(models.Model):
    """
    Configurable association: site / department / line / work area / equipment.

    Line and work area are opaque codes until company masters are evidenced.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program_version = models.ForeignKey(
        SanitationProgramVersion,
        on_delete=models.CASCADE,
        related_name="scopes",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255, blank=True, default="")
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sanitation_scopes",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sanitation_scopes",
    )
    line_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque line label — Line master EVIDENCE REQUIRED.",
    )
    work_area_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque work-area label — Area master EVIDENCE REQUIRED.",
    )
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sanitation_scopes",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("code",)
        verbose_name = "Sanitation scope"
        verbose_name_plural = "Sanitation scopes"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "program_version",
                name="sanitation_scope_version_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code}"

    def clean(self) -> None:
        super().clean()
        org_id = self.program_version.program.organization_id if self.program_version_id else None
        if org_id is None:
            return
        site = self.site

        if self.site_id and site is not None and site.organization_id != org_id:
            raise ValidationError({"site": "Site must belong to the same organization."})
        department = self.department

        if self.department_id and department is not None and department.organization_id != org_id:
            raise ValidationError(
                {"department": "Department must belong to the same organization."}
            )
        equipment = self.equipment

        if self.equipment_id and equipment is not None and equipment.organization_id != org_id:
            raise ValidationError({"equipment": "Equipment must belong to the same organization."})


class SanitationScheduleLink(models.Model):
    """
    Links a schedule intent (pre-op/post-op/…) to an existing ChecklistSchedule.

    Frequencies and window timings remain on the schedule configuration —
    this model does not invent cleaning intervals.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program_version = models.ForeignKey(
        SanitationProgramVersion,
        on_delete=models.CASCADE,
        related_name="schedule_links",
    )
    schedule_kind = models.CharField(max_length=16, choices=SanitationScheduleKind.choices)
    checklist_schedule = models.ForeignKey(
        "scheduling.ChecklistSchedule",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sanitation_links",
        help_text="Optional pointer to a configured recurring ChecklistSchedule (Phase 07E).",
    )
    label = models.CharField(max_length=128, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("schedule_kind", "label")
        verbose_name = "Sanitation schedule link"
        verbose_name_plural = "Sanitation schedule links"

    def __str__(self) -> str:
        return f"{self.schedule_kind}:{self.label or self.id}"

    def clean(self) -> None:
        super().clean()
        if not self.checklist_schedule_id or not self.program_version_id:
            return
        prog_org = self.program_version.program.organization_id
        checklist_schedule = self.checklist_schedule
        if checklist_schedule is None:
            return
        if checklist_schedule.organization_id != prog_org:
            raise ValidationError(
                {"checklist_schedule": "Schedule must belong to the same organization."}
            )
        tmpl = self.program_version.program.checklist_template_id
        if checklist_schedule.checklist_template_id != tmpl:
            raise ValidationError(
                {
                    "checklist_schedule": (
                        "Schedule must target the same checklist template as the program."
                    )
                }
            )


class ChemicalReference(models.Model):
    """Generic chemical master shell — no seeded products or concentrations."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="chemical_references",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    manufacturer_label = models.CharField(max_length=255, blank=True, default="")
    # Intentionally blank shell — company may store an opaque approved text later.
    concentration_label = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque company-approved label only — never invent ppm/% values.",
    )
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="chemical_references_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Chemical reference"
        verbose_name_plural = "Chemical references"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="chemical_reference_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class SanitationChemicalReference(models.Model):
    """Optional association of a chemical shell to a program version (no usage rules)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program_version = models.ForeignKey(
        SanitationProgramVersion,
        on_delete=models.CASCADE,
        related_name="chemical_links",
    )
    chemical = models.ForeignKey(
        ChemicalReference,
        on_delete=models.PROTECT,
        related_name="program_links",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Sanitation chemical link"
        verbose_name_plural = "Sanitation chemical links"
        constraints = [
            models.UniqueConstraint(
                fields=["program_version", "chemical"],
                name="sanitation_chem_link_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.program_version_id}:{self.chemical_id}"

    def clean(self) -> None:
        super().clean()
        if not self.chemical_id or not self.program_version_id:
            return
        if self.chemical.organization_id != self.program_version.program.organization_id:
            raise ValidationError({"chemical": "Chemical must belong to the same organization."})


class SanitationFailPolicy(models.Model):
    """
    Organization-level sanitation FAIL → production-stop policy stub.

    Default: do not stop production. Runtime enablement also requires
    SANITATION_FAIL_STOP_PRODUCTION_APPROVED (settings) — APR-053.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name="sanitation_fail_policy",
    )
    policy_enabled = models.BooleanField(
        default=False,
        help_text="Company opt-in stub only — still gated by settings approval flag.",
    )
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sanitation_fail_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Sanitation fail policy"
        verbose_name_plural = "Sanitation fail policies"

    def __str__(self) -> str:
        return f"sanitation-fail/{self.organization.code}"


class ChecklistTemplateSanitationBinding(models.Model):
    """Binds a checklist template to an exact approved sanitation program version."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist_template = models.OneToOneField(
        "checklists.ChecklistTemplate",
        on_delete=models.CASCADE,
        related_name="sanitation_binding",
    )
    program_version = models.ForeignKey(
        SanitationProgramVersion,
        on_delete=models.PROTECT,
        related_name="checklist_bindings",
    )
    frozen_sanitation_context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Checklist template sanitation binding"
        verbose_name_plural = "Checklist template sanitation bindings"

    def __str__(self) -> str:
        return f"tmpl={self.checklist_template_id}/san_v={self.program_version_id}"


class SanitationHistoryEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sanitation_history_entries",
    )
    program = models.ForeignKey(
        SanitationProgram,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    program_version = models.ForeignKey(
        SanitationProgramVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    event_type = models.CharField(max_length=64)
    note = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sanitation_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Sanitation history entry"
        verbose_name_plural = "Sanitation history entries"

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at}"
