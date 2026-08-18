"""Allergen / changeover / line-clearance foundation — Phase 30.

Generic allergen reference shells and changeover records only.
Does not invent Nelna allergen lists, cleaning rules, or sequencing rules.
Production block remains OFF unless dual-gated company policy is approved.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from apps.organizations.models import Organization


class DeclarationStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    RETIRED = "RETIRED", "Retired"


class ChangeoverStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    RECORDED = "RECORDED", "Recorded"
    VERIFIED = "VERIFIED", "Verified"
    VOIDED = "VOIDED", "Voided"


class LineClearanceStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    COMPLETED = "COMPLETED", "Completed"
    VOIDED = "VOIDED", "Voided"


class AllergenReference(models.Model):
    """
    Generic allergen code/name shell for future mappings.

    Company allergen catalogues are NOT seeded — EVIDENCE REQUIRED (APR-056).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="allergen_references",
    )
    code = models.CharField(
        max_length=64,
        help_text="Company-assigned allergen code — not invented by the system.",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="allergen_references_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Allergen reference"
        verbose_name_plural = "Allergen references"
        permissions = [
            (
                "manage_allergenreference",
                "Can manage allergen reference shells",
            ),
            ("view_changeover", "Can view allergen/changeover/line-clearance records"),
            (
                "manage_changeover",
                "Can record allergen/changeover/line-clearance events",
            ),
            (
                "verify_changeover",
                "Can verify changeover / line-clearance records (QA/Food Safety)",
            ),
            (
                "manage_allergenriskpolicy",
                "Can update allergen risk / production-block policy stubs",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="changeover_allergen_ref_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class ProductAllergenDeclaration(models.Model):
    """
    Product association to an approved allergen declaration reference.

    Does not invent which allergens apply — mappings remain EVIDENCE REQUIRED.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="product_allergen_declarations",
    )
    product = models.ForeignKey(
        "master_data.FGProduct",
        on_delete=models.PROTECT,
        related_name="allergen_declarations",
    )
    status = models.CharField(
        max_length=16,
        choices=DeclarationStatus.choices,
        default=DeclarationStatus.DRAFT,
    )
    declaration_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque company declaration / document-control reference.",
    )
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    allergen_references = models.ManyToManyField(
        AllergenReference,
        blank=True,
        related_name="product_declarations",
        help_text="Optional links — leave empty until company mapping evidenced.",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="product_allergen_declarations_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="product_allergen_declarations_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Product allergen declaration"
        verbose_name_plural = "Product allergen declarations"

    def __str__(self) -> str:
        return f"{self.product.code} declaration ({self.status})"

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            DeclarationStatus.APPROVED,
            DeclarationStatus.RETIRED,
        }

    def clean(self) -> None:
        super().clean()
        product = self.product
        if product is not None and self.organization_id:
            if product.organization_id != self.organization_id:
                raise ValidationError({"product": "Product must belong to the same organization."})
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_from > self.effective_to
        ):
            raise ValidationError({"effective_to": "effective_to cannot be before effective_from."})


class ChangeoverRecord(models.Model):
    """
    Product-to-product changeover shell with checklist and packaging hooks.

    Does not invent cleaning sequences or allergen matrix block rules.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="changeover_records",
    )
    previous_product = models.ForeignKey(
        "master_data.FGProduct",
        on_delete=models.PROTECT,
        related_name="changeovers_as_previous",
    )
    next_product = models.ForeignKey(
        "master_data.FGProduct",
        on_delete=models.PROTECT,
        related_name="changeovers_as_next",
    )
    line_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque line identifier — Line master EVIDENCE REQUIRED.",
    )
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=ChangeoverStatus.choices,
        default=ChangeoverStatus.RECORDED,
    )
    batch_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque batch/dossier reference for future traceability.",
    )
    cleaning_checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="changeover_cleaning_refs",
        help_text="Preferred: reuse checklist engine for cleaning/clearance.",
    )
    cleaning_checklist_version = models.ForeignKey(
        "checklists.ChecklistVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="changeover_cleaning_refs",
    )
    packaging_artwork_hook = models.ForeignKey(
        "packaging.LineClearanceArtworkHook",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="changeover_records",
        help_text="Optional packaging/label clearance hook from Phase 29.",
    )
    previous_declaration = models.ForeignKey(
        ProductAllergenDeclaration,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="changeovers_as_previous_declaration",
    )
    next_declaration = models.ForeignKey(
        ProductAllergenDeclaration,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="changeovers_as_next_declaration",
    )
    verification_notes = models.TextField(blank=True, default="")
    evidence_object_key = models.CharField(max_length=512, blank=True, default="")
    evidence_file_name = models.CharField(max_length=255, blank=True, default="")
    frozen_changeover_context = models.JSONField(default=dict, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="changeovers_verified",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="changeovers_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-started_at",)
        verbose_name = "Changeover record"
        verbose_name_plural = "Changeover records"
        indexes = [
            models.Index(fields=["organization", "line_code", "-started_at"]),
            models.Index(fields=["organization", "batch_reference"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.organization.code} "
            f"{self.previous_product.code}->{self.next_product.code} "
            f"({self.line_code or 'NO-LINE'})"
        )

    def clean(self) -> None:
        super().clean()
        previous_product = self.previous_product
        if previous_product is not None and self.organization_id:
            if previous_product.organization_id != self.organization_id:
                raise ValidationError(
                    {"previous_product": "Previous product must match organization."}
                )
        next_product = self.next_product
        if next_product is not None and self.organization_id:
            if next_product.organization_id != self.organization_id:
                raise ValidationError({"next_product": "Next product must match organization."})
        cleaning_checklist_template = self.cleaning_checklist_template
        if (
            self.cleaning_checklist_template_id
            and cleaning_checklist_template is not None
            and cleaning_checklist_template.organization_id != self.organization_id
        ):
            raise ValidationError(
                {
                    "cleaning_checklist_template": (
                        "Checklist template must belong to the organization."
                    )
                }
            )
        cleaning_checklist_version = self.cleaning_checklist_version
        if cleaning_checklist_version is not None and self.cleaning_checklist_template_id:
            if cleaning_checklist_version.template_id != self.cleaning_checklist_template_id:
                raise ValidationError(
                    {
                        "cleaning_checklist_version": (
                            "Checklist version must belong to the selected template."
                        )
                    }
                )


class LineClearanceRecord(models.Model):
    """
    Line-clearance evidence driven by the checklist engine where practical.

    Hardcoded pass/fail cleaning steps are intentionally avoided.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="line_clearance_records",
    )
    changeover = models.ForeignKey(
        ChangeoverRecord,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="line_clearances",
    )
    line_code = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=16,
        choices=LineClearanceStatus.choices,
        default=LineClearanceStatus.COMPLETED,
    )
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        related_name="line_clearance_records",
    )
    checklist_version = models.ForeignKey(
        "checklists.ChecklistVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="line_clearance_records",
        help_text="Exact checklist version used — historical pin.",
    )
    checklist_submission = models.ForeignKey(
        "recording.ChecklistSubmission",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="line_clearance_records",
        help_text="Optional immutable submission evidence when available.",
    )
    packaging_artwork_hook = models.ForeignKey(
        "packaging.LineClearanceArtworkHook",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="line_clearance_records",
    )
    notes = models.TextField(blank=True, default="")
    evidence_object_key = models.CharField(max_length=512, blank=True, default="")
    frozen_clearance_context = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(default=timezone.now)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="line_clearances_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-completed_at",)
        verbose_name = "Line clearance record"
        verbose_name_plural = "Line clearance records"
        indexes = [
            models.Index(fields=["organization", "line_code", "-completed_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/LC/{self.line_code or 'NO-LINE'}"

    def clean(self) -> None:
        super().clean()
        checklist_template = self.checklist_template
        if checklist_template is not None and self.organization_id:
            if checklist_template.organization_id != self.organization_id:
                raise ValidationError(
                    {"checklist_template": ("Checklist template must belong to the organization.")}
                )
        checklist_version = self.checklist_version
        if checklist_version is not None and self.checklist_template_id:
            if checklist_version.template_id != self.checklist_template_id:
                raise ValidationError(
                    {
                        "checklist_version": (
                            "Checklist version must belong to the selected template."
                        )
                    }
                )
        changeover = self.changeover
        if changeover is not None and self.organization_id:
            if changeover.organization_id != self.organization_id:
                raise ValidationError({"changeover": "Changeover must belong to the organization."})


class AllergenRiskPolicy(models.Model):
    """
    Org-level allergen matrix / changeover production-block stub.

    Default OFF. Dual-gated with CHANGEOVER_ALLERGEN_BLOCK_APPROVED (APR-056).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="allergen_risk_policy",
    )
    policy_enabled = models.BooleanField(
        default=False,
        help_text="When False, allergen matrix never blocks production start.",
    )
    procedure_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque company SOP / matrix reference — not invented.",
    )
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="allergen_risk_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Allergen risk policy"
        verbose_name_plural = "Allergen risk policies"

    def __str__(self) -> str:
        state = "ENABLED" if self.policy_enabled else "DISABLED"
        return f"{self.organization.code} allergen risk ({state})"


class ChangeoverHistoryEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="changeover_history_entries",
    )
    changeover = models.ForeignKey(
        ChangeoverRecord,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    line_clearance = models.ForeignKey(
        LineClearanceRecord,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    event_type = models.CharField(max_length=64)
    note = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="changeover_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Changeover history entry"
        verbose_name_plural = "Changeover history entries"

    def __str__(self) -> str:
        return f"{self.event_type}:{self.changeover_id or self.line_clearance_id}"
