"""Configurable sampling-plan engine — Phase 24.

Versioned shells for company-approved sampling configuration later.
No ISO/AQL tables, sample sizes, or accept/reject numbers are seeded.
Sampling evaluation FAIL/REJECT must never auto-create QA dispositions.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization, Site


class SamplingPlanVersionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    RETIRED = "RETIRED", "Retired"


class SamplingEvaluationResult(models.TextChoices):
    """Deterministic sampling outcome — not a QA RELEASE/HOLD/REJECT."""

    ACCEPT = "ACCEPT", "Sampling accept"
    REJECT = "REJECT", "Sampling reject"
    NOT_EVALUATED = "NOT_EVALUATED", "Not evaluated (missing approved thresholds)"


class SamplingPlan(models.Model):
    """Stable logical identity of a sampling plan across versions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sampling_plans",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    # Optional opaque pointer to an external standard the *company* may adopt later.
    external_standard_source = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque company-declared source name/version only — never a copied ISO table.",
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sampling_plans_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Sampling plan"
        verbose_name_plural = "Sampling plans"
        permissions = [
            ("manage_samplingplan", "Can draft/edit sampling plan versions"),
            ("publish_samplingplan", "Can approve/retire sampling plan versions"),
            ("view_sampling", "Can view sampling plans (read-only)"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="sampling_plan_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class SamplingPlanVersion(models.Model):
    """Immutable after APPROVED/RETIRED — historical submissions must PROTECT this row."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        SamplingPlan,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=SamplingPlanVersionStatus.choices,
        default=SamplingPlanVersionStatus.DRAFT,
    )
    change_summary = models.TextField(blank=True, default="")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sampling_versions_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sampling_versions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("plan__code", "-version_number")
        verbose_name = "Sampling plan version"
        verbose_name_plural = "Sampling plan versions"
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "version_number"],
                name="sampling_plan_version_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.plan.code} v{self.version_number} ({self.status})"

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            SamplingPlanVersionStatus.APPROVED,
            SamplingPlanVersionStatus.RETIRED,
        }


class SamplingRule(models.Model):
    """
    Optional matching dimensions for a plan version.

    Inactive/blank dimensions are ignored. No dimension is activated as company
    policy until evidence-backed configuration is loaded.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan_version = models.ForeignKey(
        SamplingPlanVersion,
        on_delete=models.CASCADE,
        related_name="rules",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255, blank=True, default="")
    priority = models.PositiveIntegerField(
        default=100,
        help_text="Lower number wins when multiple rules match (deterministic).",
    )
    # Optional dimension shells — leave null/blank until business activates them.
    product = models.ForeignKey(
        "master_data.FGProduct",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sampling_rules",
    )
    product_group_code = models.CharField(max_length=64, blank=True, default="")
    lot_size_min = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    lot_size_max = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    inspection_type = models.CharField(max_length=64, blank=True, default="")
    risk_class = models.CharField(max_length=64, blank=True, default="")
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sampling_rules",
    )
    process_code = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("priority", "code")
        verbose_name = "Sampling rule"
        verbose_name_plural = "Sampling rules"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "plan_version",
                name="sampling_rule_version_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} (p={self.priority})"

    def clean(self) -> None:
        super().clean()
        if (
            self.lot_size_min is not None
            and self.lot_size_max is not None
            and self.lot_size_min > self.lot_size_max
        ):
            raise ValidationError(
                {"lot_size_max": "lot_size_max cannot be less than lot_size_min."}
            )
        product = self.product
        if product is not None and self.plan_version_id:
            if product.organization_id != self.plan_version.plan.organization_id:
                raise ValidationError({"product": "Product must belong to the same organization."})
        site = self.site
        if site is not None and self.plan_version_id:
            if site.organization_id != self.plan_version.plan.organization_id:
                raise ValidationError({"site": "Site must belong to the same organization."})


class SampleRequirement(models.Model):
    """
    Outputs for a matched rule — values remain null/blank until approved config.

    Do not invent sample counts, AQL, or accept/reject numbers here.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule = models.OneToOneField(
        SamplingRule,
        on_delete=models.CASCADE,
        related_name="requirement",
    )
    required_sample_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Approved sample count only — null until company evidence supplies it.",
    )
    sample_grouping = models.CharField(max_length=128, blank=True, default="")
    accept_threshold = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Max defectives to ACCEPT when configured — not invented.",
    )
    reject_threshold = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Min defectives to REJECT when configured — not invented.",
    )
    inspection_level = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Sample requirement"
        verbose_name_plural = "Sample requirements"

    def __str__(self) -> str:
        return f"requirement/{self.rule.code}"

    def clean(self) -> None:
        super().clean()
        if (
            self.accept_threshold is not None
            and self.reject_threshold is not None
            and self.reject_threshold <= self.accept_threshold
        ):
            raise ValidationError(
                {
                    "reject_threshold": (
                        "reject_threshold must be greater than accept_threshold when both set."
                    )
                }
            )


class ChecklistItemSamplingBinding(models.Model):
    """
    Links a REPEATING_GROUP checklist item to an exact SamplingPlanVersion.

    Frozen context preserves historical resolution identity on submissions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist_item = models.OneToOneField(
        "checklists.ChecklistItem",
        on_delete=models.CASCADE,
        related_name="sampling_binding",
    )
    plan_version = models.ForeignKey(
        SamplingPlanVersion,
        on_delete=models.PROTECT,
        related_name="checklist_bindings",
    )
    frozen_sampling_context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Checklist item sampling binding"
        verbose_name_plural = "Checklist item sampling bindings"

    def __str__(self) -> str:
        return f"item={self.checklist_item_id}/plan_v={self.plan_version_id}"


class SamplingHistoryEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sampling_history_entries",
    )
    plan = models.ForeignKey(
        SamplingPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    plan_version = models.ForeignKey(
        SamplingPlanVersion,
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
        related_name="sampling_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Sampling history entry"
        verbose_name_plural = "Sampling history entries"

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at}"
