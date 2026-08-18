"""Quality change control — Phase 44 (ADR-055).

Generic architectural lifecycle only. Company change-control SOP, risk
scoring, and approval SoD remain APR-069 EVIDENCE REQUIRED. Engineering
completion is never treated as business approval.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class ChangeRequestStatus(models.TextChoices):
    REQUESTED = "REQUESTED", "Requested"
    ASSESSMENT = "ASSESSMENT", "Assessment"
    APPROVED = "APPROVED", "Approved"
    IMPLEMENTING = "IMPLEMENTING", "Implementing"
    VERIFICATION = "VERIFICATION", "Verification"
    CLOSED = "CLOSED", "Closed"


CHANGE_TRANSITIONS: dict[str, frozenset[str]] = {
    ChangeRequestStatus.REQUESTED: frozenset({ChangeRequestStatus.ASSESSMENT}),
    ChangeRequestStatus.ASSESSMENT: frozenset(
        {ChangeRequestStatus.REQUESTED, ChangeRequestStatus.APPROVED}
    ),
    ChangeRequestStatus.APPROVED: frozenset({ChangeRequestStatus.IMPLEMENTING}),
    ChangeRequestStatus.IMPLEMENTING: frozenset({ChangeRequestStatus.VERIFICATION}),
    ChangeRequestStatus.VERIFICATION: frozenset({ChangeRequestStatus.CLOSED}),
    ChangeRequestStatus.CLOSED: frozenset(),
}

TERMINAL_STATUSES = frozenset({ChangeRequestStatus.CLOSED})

MUTABLE_LINK_STATUSES = frozenset({ChangeRequestStatus.REQUESTED, ChangeRequestStatus.ASSESSMENT})


class ChangeAffectedKind(models.TextChoices):
    """Architectural affected-area kinds — not Nelna catalogues."""

    PRODUCT = "PRODUCT", "Product"
    SPECIFICATION = "SPECIFICATION", "Specification"
    CHECKLIST = "CHECKLIST", "Checklist"
    HACCP_PLAN = "HACCP_PLAN", "HACCP plan"
    EQUIPMENT = "EQUIPMENT", "Equipment"
    PROCESS = "PROCESS", "Process"
    ERP_MAPPING = "ERP_MAPPING", "ERP mapping"
    DOCUMENT = "DOCUMENT", "Document"
    TRAINING = "TRAINING", "Training"
    SITE_LINE = "SITE_LINE", "Site / line"


class ChangeImplementationKind(models.TextChoices):
    DOCUMENT_VERSION = "DOCUMENT_VERSION", "Document version"
    CHECKLIST_VERSION = "CHECKLIST_VERSION", "Checklist version"
    SPECIFICATION_VERSION = "SPECIFICATION_VERSION", "Specification version"
    HACCP_PLAN_VERSION = "HACCP_PLAN_VERSION", "HACCP plan version"
    CONFIGURATION = "CONFIGURATION", "Configuration"
    ERP_MAPPING = "ERP_MAPPING", "ERP mapping"
    OTHER = "OTHER", "Other deployed reference"


class QualityChangeRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_change_requests"
    )
    change_code = models.CharField(
        max_length=64, help_text="Owner-supplied change identifier (not seeded)."
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    reason = models.TextField()
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_changes_requested",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_changes_owned",
    )
    status = models.CharField(
        max_length=16,
        choices=ChangeRequestStatus.choices,
        default=ChangeRequestStatus.REQUESTED,
    )
    requested_at = models.DateTimeField()
    target_date = models.DateField(null=True, blank=True)
    risk_impact_assessment = models.TextField(blank=True, default="")
    approval_reference = models.CharField(max_length=255, blank=True, default="")
    verification_reference = models.CharField(max_length=255, blank=True, default="")
    engineering_complete = models.BooleanField(
        default=False,
        help_text="Engineering completion does not constitute business approval.",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_changes_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_changes_verified",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_changes_closed",
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_changes_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quality change request"
        verbose_name_plural = "Quality change requests"
        constraints = [
            models.UniqueConstraint(
                Lower("change_code"),
                "organization",
                name="quality_change_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
        ]
        default_permissions = ()
        permissions = [
            ("view_qualitychange", "Can view quality change requests"),
            ("create_qualitychange", "Can create quality change requests"),
            ("assess_qualitychange", "Can assess quality change impact"),
            ("approve_qualitychange", "Can approve quality change requests"),
            ("implement_qualitychange", "Can record implementation of approved changes"),
            ("verify_qualitychange", "Can verify and close quality change requests"),
        ]

    def __str__(self) -> str:
        return f"{self.change_code} ({self.status})"

    @property
    def is_historically_locked(self) -> bool:
        return self.status in TERMINAL_STATUSES

    def clean(self) -> None:
        super().clean()
        if not (self.change_code or "").strip():
            raise ValidationError({"change_code": "Change identifier is required."})
        self.change_code = (self.change_code or "").strip()
        if not (self.title or "").strip():
            raise ValidationError({"title": "Title is required."})
        self.title = (self.title or "").strip()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Description is required."})
        if not (self.reason or "").strip():
            raise ValidationError({"reason": "Reason is required."})


class QualityChangeImpactAssessment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    change_request = models.OneToOneField(
        QualityChangeRequest,
        on_delete=models.PROTECT,
        related_name="impact_assessment",
    )
    quality_impact = models.TextField()
    food_safety_impact = models.TextField()
    technical_impact = models.TextField()
    training_impact = models.TextField()
    validation_requirement = models.TextField()
    data_migration_impact = models.TextField()
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_change_assessments",
    )
    assessed_at = models.DateTimeField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        default_permissions = ()
        verbose_name = "Quality change impact assessment"

    def __str__(self) -> str:
        return f"impact:{self.change_request.pk}"

    def clean(self) -> None:
        super().clean()
        required = {
            "quality_impact": self.quality_impact,
            "food_safety_impact": self.food_safety_impact,
            "technical_impact": self.technical_impact,
            "training_impact": self.training_impact,
            "validation_requirement": self.validation_requirement,
            "data_migration_impact": self.data_migration_impact,
        }
        errors = {
            key: "Impact field is required."
            for key, value in required.items()
            if not (value or "").strip()
        }
        if errors:
            raise ValidationError(errors)


class QualityChangeAffectedLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    change_request = models.ForeignKey(
        QualityChangeRequest, on_delete=models.PROTECT, related_name="affected_links"
    )
    linked_kind = models.CharField(max_length=32, choices=ChangeAffectedKind.choices)
    linked_object_id = models.UUIDField(null=True, blank=True)
    linked_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_change_affected_links_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["change_request", "linked_kind", "linked_object_id", "linked_reference"],
                name="quality_change_affected_link_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.linked_kind}:{self.linked_reference or self.linked_object_id}"

    def clean(self) -> None:
        super().clean()
        if self.linked_kind not in ChangeAffectedKind.values:
            raise ValidationError({"linked_kind": "Unknown affected-area kind."})
        if self.linked_object_id is None and not (self.linked_reference or "").strip():
            raise ValidationError(
                {"linked_reference": "Provide a linked object id or an opaque reference."}
            )


class QualityChangeImplementationLink(models.Model):
    """Deployed configuration/version cited against an approved change."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    change_request = models.ForeignKey(
        QualityChangeRequest,
        on_delete=models.PROTECT,
        related_name="implementation_links",
    )
    implemented_kind = models.CharField(max_length=32, choices=ChangeImplementationKind.choices)
    implemented_object_id = models.UUIDField(null=True, blank=True)
    implemented_reference = models.CharField(max_length=255)
    notes = models.CharField(max_length=255, blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_change_implementations_recorded",
    )
    recorded_at = models.DateTimeField()
    does_not_constitute_approval = models.BooleanField(default=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"{self.implemented_kind}:{self.implemented_reference}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.does_not_constitute_approval = True
        super().save(*args, **kwargs)


class QualityChangeEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    change_request = models.ForeignKey(
        QualityChangeRequest, on_delete=models.PROTECT, related_name="events"
    )
    event_type = models.CharField(max_length=64)
    summary = models.CharField(max_length=512)
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_change_events",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        default_permissions = ()
        indexes = [models.Index(fields=["change_request", "created_at"])]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"
