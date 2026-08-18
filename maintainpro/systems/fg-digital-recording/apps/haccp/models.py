"""HACCP / control-point foundation — Phase 23.

Versioned plan architecture for representing an approved company HACCP plan later.
No Nelna CCPs, critical limits, corrective actions, or process hazards are seeded.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class HaccpPlanVersionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    RETIRED = "RETIRED", "Retired"


class HazardCategory(models.TextChoices):
    """Generic industry hazard categories — not a Nelna process classification."""

    BIOLOGICAL = "BIOLOGICAL", "Biological"
    CHEMICAL = "CHEMICAL", "Chemical"
    PHYSICAL = "PHYSICAL", "Physical"
    ALLERGEN = "ALLERGEN", "Allergen"


class HaccpControlPointType(models.TextChoices):
    """
    HACCP control-point types (CCP / OPRP / PRP).

    Checklist GMP/QUALITY metadata remains on ChecklistItem (Phase 06L) and is
    separate from this HACCP plan taxonomy.
    """

    CCP = "CCP", "CCP (evidence-gated)"
    OPRP = "OPRP", "OPRP (evidence-gated)"
    PRP = "PRP", "PRP (evidence-gated)"


class BoundarySemantics(models.TextChoices):
    """How numeric bounds are interpreted — values themselves remain empty until approved."""

    INCLUSIVE = "INCLUSIVE", "Inclusive"
    EXCLUSIVE = "EXCLUSIVE", "Exclusive"
    LOWER_INCLUSIVE_UPPER_EXCLUSIVE = (
        "LOWER_INCLUSIVE_UPPER_EXCLUSIVE",
        "Lower inclusive / upper exclusive",
    )
    LOWER_EXCLUSIVE_UPPER_INCLUSIVE = (
        "LOWER_EXCLUSIVE_UPPER_INCLUSIVE",
        "Lower exclusive / upper inclusive",
    )
    QUALITATIVE = "QUALITATIVE", "Qualitative / non-numeric"


class HaccpPlan(models.Model):
    """Stable logical identity of a HACCP plan across versions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="haccp_plans",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="haccp_plans_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "HACCP plan"
        verbose_name_plural = "HACCP plans"
        permissions = [
            ("manage_haccpplan", "Can draft/edit HACCP plan versions"),
            ("approve_haccpplan", "Can approve/retire HACCP plan versions"),
            ("view_haccp", "Can view HACCP plans (read-only)"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="haccp_plan_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class HaccpPlanVersion(models.Model):
    """
    Immutable after APPROVED/RETIRED.

    Historical checklist bindings and submission snapshots must PROTECT this row.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        HaccpPlan,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=HaccpPlanVersionStatus.choices,
        default=HaccpPlanVersionStatus.DRAFT,
    )
    change_summary = models.TextField(blank=True, default="")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="haccp_versions_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="haccp_versions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("plan__code", "-version_number")
        verbose_name = "HACCP plan version"
        verbose_name_plural = "HACCP plan versions"
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "version_number"],
                name="haccp_plan_version_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.plan.code} v{self.version_number} ({self.status})"

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            HaccpPlanVersionStatus.APPROVED,
            HaccpPlanVersionStatus.RETIRED,
        }


class ProcessStep(models.Model):
    """Process step within a plan version — free-form labels only until evidence arrives."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan_version = models.ForeignKey(
        HaccpPlanVersion,
        on_delete=models.CASCADE,
        related_name="process_steps",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    sequence = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("sequence", "code")
        verbose_name = "HACCP process step"
        verbose_name_plural = "HACCP process steps"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "plan_version",
                name="haccp_step_version_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.plan_version} / {self.code}"


class Hazard(models.Model):
    """Hazard shell under a process step — categories are generic, not Nelna classifications."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    process_step = models.ForeignKey(
        ProcessStep,
        on_delete=models.CASCADE,
        related_name="hazards",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=16, choices=HazardCategory.choices)
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("process_step__sequence", "code")
        verbose_name = "HACCP hazard"
        verbose_name_plural = "HACCP hazards"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "process_step",
                name="haccp_hazard_step_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.category})"


class ControlMeasure(models.Model):
    """Control measure linked to a hazard — descriptive only until procedures are approved."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hazard = models.ForeignKey(
        Hazard,
        on_delete=models.CASCADE,
        related_name="control_measures",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("code",)
        verbose_name = "HACCP control measure"
        verbose_name_plural = "HACCP control measures"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "hazard",
                name="haccp_measure_hazard_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return self.code


class ControlPoint(models.Model):
    """
    Control point (CCP / OPRP / PRP) on a process step.

    Does not invent which Nelna steps are CCPs — codes/titles are empty shells.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan_version = models.ForeignKey(
        HaccpPlanVersion,
        on_delete=models.CASCADE,
        related_name="control_points",
    )
    process_step = models.ForeignKey(
        ProcessStep,
        on_delete=models.CASCADE,
        related_name="control_points",
    )
    hazard = models.ForeignKey(
        Hazard,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="control_points",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    control_point_type = models.CharField(
        max_length=8,
        choices=HaccpControlPointType.choices,
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("code",)
        verbose_name = "HACCP control point"
        verbose_name_plural = "HACCP control points"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "plan_version",
                name="haccp_cp_version_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.control_point_type})"

    def clean(self) -> None:
        super().clean()
        process_step = self.process_step
        if process_step is not None and self.plan_version_id:
            if process_step.plan_version_id != self.plan_version_id:
                raise ValidationError(
                    {"process_step": "Process step must belong to the same plan version."}
                )
        hazard = self.hazard
        if hazard is not None and self.process_step_id:
            if hazard.process_step_id != self.process_step_id:
                raise ValidationError({"hazard": "Hazard must belong to the same process step."})


class CriticalLimitReference(models.Model):
    """
    Critical-limit *reference* — never stores invented Nelna limit values as facts.

    May optionally pin an approved SpecificationParameter; numeric placeholders
    remain null until company evidence is loaded through controlled configuration.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    control_point = models.OneToOneField(
        ControlPoint,
        on_delete=models.CASCADE,
        related_name="critical_limit",
    )
    specification_parameter = models.ForeignKey(
        "master_data.SpecificationParameter",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="haccp_critical_limit_refs",
        help_text="Optional pin to an approved specification parameter — not invented bounds.",
    )
    rule_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque approved rule/document reference code — not a limit value.",
    )
    unit = models.CharField(max_length=32, blank=True, default="")
    precision = models.PositiveSmallIntegerField(null=True, blank=True)
    boundary_semantics = models.CharField(
        max_length=40,
        choices=BoundarySemantics.choices,
        default=BoundarySemantics.INCLUSIVE,
    )
    # Placeholders only — must stay null unless loaded from approved evidence.
    lower_bound = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    upper_bound = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    source_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "HACCP critical limit reference"
        verbose_name_plural = "HACCP critical limit references"

    def __str__(self) -> str:
        return f"Limit ref for {self.control_point.code}"


class MonitoringRule(models.Model):
    """Monitoring architecture shell — actual method/frequency remain EVIDENCE REQUIRED."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    control_point = models.OneToOneField(
        ControlPoint,
        on_delete=models.CASCADE,
        related_name="monitoring_rule",
    )
    method_reference = models.CharField(max_length=255, blank=True, default="")
    frequency_reference = models.CharField(max_length=255, blank=True, default="")
    responsible_category = models.CharField(max_length=128, blank=True, default="")
    required_equipment_reference = models.CharField(max_length=255, blank=True, default="")
    verification_requirement = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "HACCP monitoring rule"
        verbose_name_plural = "HACCP monitoring rules"

    def __str__(self) -> str:
        return f"Monitoring for {self.control_point.code}"


class CorrectiveActionReference(models.Model):
    """
    Reference to an approved procedure/action plan.

    Does not execute HOLD/NCR/CAPA. Runtime auto-action requires an explicitly
    approved deterministic rule (default: none).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    control_point = models.OneToOneField(
        ControlPoint,
        on_delete=models.CASCADE,
        related_name="corrective_action_ref",
    )
    procedure_reference = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    # Explicit opt-in — must remain False until company policy + deterministic rule exist.
    auto_raise_hold_enabled = models.BooleanField(default=False)
    auto_raise_ncr_enabled = models.BooleanField(default=False)

    class Meta:
        verbose_name = "HACCP corrective action reference"
        verbose_name_plural = "HACCP corrective action references"

    def __str__(self) -> str:
        return self.procedure_reference


class ChecklistItemHaccpBinding(models.Model):
    """
    Links a checklist item to an exact HACCP plan version + control point.

    Published checklist versions and submissions must snapshot this binding;
    changing the plan later must not rewrite history.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist_item = models.OneToOneField(
        "checklists.ChecklistItem",
        on_delete=models.CASCADE,
        related_name="haccp_binding",
    )
    plan_version = models.ForeignKey(
        HaccpPlanVersion,
        on_delete=models.PROTECT,
        related_name="checklist_bindings",
    )
    control_point = models.ForeignKey(
        ControlPoint,
        on_delete=models.PROTECT,
        related_name="checklist_bindings",
    )
    frozen_haccp_context = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Immutable snapshot of plan version + control-point identity at bind time; "
            "historical submissions must rely on this, not live plan edits."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Checklist item HACCP binding"
        verbose_name_plural = "Checklist item HACCP bindings"

    def __str__(self) -> str:
        return f"item={self.checklist_item_id}/cp={self.control_point_id}"

    def clean(self) -> None:
        super().clean()
        control_point = self.control_point
        if control_point is not None and self.plan_version_id:
            if control_point.plan_version_id != self.plan_version_id:
                raise ValidationError(
                    {"control_point": "Control point must belong to the bound plan version."}
                )


class HaccpHistoryEntry(models.Model):
    """Domain history for plan/version/control-point changes (complements SecurityAuditEvent)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="haccp_history_entries",
    )
    plan = models.ForeignKey(
        HaccpPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    plan_version = models.ForeignKey(
        HaccpPlanVersion,
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
        related_name="haccp_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "HACCP history entry"
        verbose_name_plural = "HACCP history entries"

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at}"
