"""Packaging label / artwork verification foundation — Phase 29.

Versioned artwork masters linked to FG products. Does not invent shelf life,
date-code formulas, customer label rules, or artwork catalogue numbers.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class ArtworkVersionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    RETIRED = "RETIRED", "Retired"


class PackagingArtwork(models.Model):
    """Stable identity for a packaging / label artwork across versions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="packaging_artworks",
    )
    product = models.ForeignKey(
        "master_data.FGProduct",
        on_delete=models.PROTECT,
        related_name="packaging_artworks",
    )
    code = models.CharField(
        max_length=64,
        help_text="Company-assigned artwork code — not invented by the system.",
    )
    title = models.CharField(max_length=255)
    pack_configuration_label = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque pack-configuration label — catalogue EVIDENCE REQUIRED.",
    )
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="packaging_artworks_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Packaging artwork"
        verbose_name_plural = "Packaging artworks"
        permissions = [
            (
                "manage_packagingartwork",
                "Can draft/edit packaging artwork versions (Product Master)",
            ),
            (
                "approve_packagingartwork",
                "Can approve/retire packaging artwork versions (Document Control)",
            ),
            ("view_packaging", "Can view packaging artwork (read-only)"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="packaging_artwork_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        product = self.product
        if product is not None and self.organization_id:
            if product.organization_id != self.organization_id:
                raise ValidationError({"product": "Product must belong to the same organization."})


class ArtworkVersion(models.Model):
    """Immutable after APPROVED/RETIRED — historical checklist bindings PROTECT this row."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    artwork = models.ForeignKey(
        PackagingArtwork,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=ArtworkVersionStatus.choices,
        default=ArtworkVersionStatus.DRAFT,
    )
    change_summary = models.TextField(blank=True, default="")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    approval_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque company approval / document-control reference — not invented.",
    )
    # Date-coding architecture shells — store references only; no shelf-life math.
    date_code_format_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque approved date-code format/rule reference — no formula invented.",
    )
    batch_code_format_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque batch-code format reference — no formula invented.",
    )
    evidence_object_key = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="Optional private-storage object key for artwork PDF/image evidence.",
    )
    evidence_file_name = models.CharField(max_length=255, blank=True, default="")
    evidence_content_type = models.CharField(max_length=128, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="artwork_versions_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="artwork_versions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("artwork__code", "-version_number")
        verbose_name = "Artwork version"
        verbose_name_plural = "Artwork versions"
        constraints = [
            models.UniqueConstraint(
                fields=["artwork", "version_number"],
                name="packaging_artwork_version_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.artwork.code} v{self.version_number} ({self.status})"

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            ArtworkVersionStatus.APPROVED,
            ArtworkVersionStatus.RETIRED,
        }

    def clean(self) -> None:
        super().clean()
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_from > self.effective_to
        ):
            raise ValidationError({"effective_to": "effective_to cannot be before effective_from."})


class ChecklistItemArtworkBinding(models.Model):
    """
    Links a checklist item to an exact APPROVED ArtworkVersion for label verification.

    Frozen context preserves historical artwork identity on submissions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist_item = models.OneToOneField(
        "checklists.ChecklistItem",
        on_delete=models.CASCADE,
        related_name="artwork_binding",
    )
    artwork_version = models.ForeignKey(
        ArtworkVersion,
        on_delete=models.PROTECT,
        related_name="checklist_bindings",
    )
    frozen_artwork_context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Checklist item artwork binding"
        verbose_name_plural = "Checklist item artwork bindings"

    def __str__(self) -> str:
        return f"item={self.checklist_item_id}/art_v={self.artwork_version_id}"


class LineClearanceArtworkHook(models.Model):
    """
    Prepared link for future changeover / line-clearance checks.

    Does not implement line-clearance workflow — stores intended artwork
    association only until company SOP is evidenced (APR-055).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="line_clearance_artwork_hooks",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255, blank=True, default="")
    artwork_version = models.ForeignKey(
        ArtworkVersion,
        on_delete=models.PROTECT,
        related_name="line_clearance_hooks",
    )
    line_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque line label — Line master EVIDENCE REQUIRED.",
    )
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="line_clearance_artwork_hooks",
        help_text="Optional future line-clearance checklist template.",
    )
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="line_clearance_artwork_hooks_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Line clearance artwork hook"
        verbose_name_plural = "Line clearance artwork hooks"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="packaging_line_clearance_hook_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        if self.artwork_version_id and self.organization_id:
            art_org = self.artwork_version.artwork.organization_id
            if art_org != self.organization_id:
                raise ValidationError(
                    {"artwork_version": "Artwork must belong to the same organization."}
                )
        checklist_template = self.checklist_template
        if checklist_template is not None and self.organization_id:
            if checklist_template.organization_id != self.organization_id:
                raise ValidationError(
                    {
                        "checklist_template": (
                            "Checklist template must belong to the same organization."
                        )
                    }
                )


class ArtworkVerificationRecord(models.Model):
    """
    Optional operational verification snapshot for a batch / run.

    Stores approved date-code *values* as entered — does not calculate EXP from shelf life.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="artwork_verification_records",
    )
    artwork_version = models.ForeignKey(
        ArtworkVersion,
        on_delete=models.PROTECT,
        related_name="verification_records",
    )
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    # Date-coding shells — recorded values only.
    mfg_date = models.DateField(
        null=True,
        blank=True,
        help_text="Recorded MFG date when company procedure requires it — not calculated.",
    )
    exp_date = models.DateField(
        null=True,
        blank=True,
        help_text="Recorded EXP date when supplied — shelf-life calculation not implemented.",
    )
    batch_code = models.CharField(max_length=128, blank=True, default="")
    date_code_format_reference_snapshot = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Copied from artwork version at verification time.",
    )
    frozen_artwork_context = models.JSONField(default=dict, blank=True)
    checklist_submission = models.ForeignKey(
        "recording.ChecklistSubmission",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="artwork_verifications",
    )
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="artwork_verifications_recorded",
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-recorded_at",)
        verbose_name = "Artwork verification record"
        verbose_name_plural = "Artwork verification records"

    def __str__(self) -> str:
        return f"verify/{self.artwork_version_id}@{self.recorded_at}"


class PackagingHistoryEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="packaging_history_entries",
    )
    artwork = models.ForeignKey(
        PackagingArtwork,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    artwork_version = models.ForeignKey(
        ArtworkVersion,
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
        related_name="packaging_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Packaging history entry"
        verbose_name_plural = "Packaging history entries"

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at}"
