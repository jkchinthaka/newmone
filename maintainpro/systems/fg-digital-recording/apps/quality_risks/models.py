"""Configurable quality-risk management — Phase 47 (ADR-058).

Architectural fields only. Do not invent a Nelna scoring methodology,
1–5 matrix, RAG thresholds, or acceptance criteria. Scoring remains
disabled until an owner-cited company method is configured (APR-072).
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class QualityRiskStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    OPEN = "OPEN", "Open"
    UNDER_REVIEW = "UNDER_REVIEW", "Under review"
    ACCEPTED = "ACCEPTED", "Accepted (residual)"
    MITIGATING = "MITIGATING", "Mitigating"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


RISK_TRANSITIONS: dict[str, frozenset[str]] = {
    QualityRiskStatus.DRAFT: frozenset({QualityRiskStatus.OPEN, QualityRiskStatus.CANCELLED}),
    QualityRiskStatus.OPEN: frozenset(
        {
            QualityRiskStatus.UNDER_REVIEW,
            QualityRiskStatus.MITIGATING,
            QualityRiskStatus.ACCEPTED,
            QualityRiskStatus.CLOSED,
            QualityRiskStatus.CANCELLED,
        }
    ),
    QualityRiskStatus.UNDER_REVIEW: frozenset(
        {
            QualityRiskStatus.OPEN,
            QualityRiskStatus.ACCEPTED,
            QualityRiskStatus.MITIGATING,
            QualityRiskStatus.CANCELLED,
        }
    ),
    QualityRiskStatus.ACCEPTED: frozenset(
        {QualityRiskStatus.MITIGATING, QualityRiskStatus.OPEN, QualityRiskStatus.CLOSED}
    ),
    QualityRiskStatus.MITIGATING: frozenset(
        {QualityRiskStatus.OPEN, QualityRiskStatus.ACCEPTED, QualityRiskStatus.CLOSED}
    ),
    QualityRiskStatus.CLOSED: frozenset(),
    QualityRiskStatus.CANCELLED: frozenset(),
}

TERMINAL_RISK_STATUSES = frozenset({QualityRiskStatus.CLOSED, QualityRiskStatus.CANCELLED})


class QualityRiskLinkKind(models.TextChoices):
    PRODUCT = "PRODUCT", "Product"
    PROCESS = "PROCESS", "Process"
    HACCP = "HACCP", "HACCP"
    SUPPLIER = "SUPPLIER", "Supplier"
    EQUIPMENT = "EQUIPMENT", "Equipment"
    SYSTEM_FEATURE = "SYSTEM_FEATURE", "System feature"
    NCR = "NCR", "Nonconformance"
    CAPA = "CAPA", "CAPA"
    AUDIT = "AUDIT", "QMS audit"
    CHANGE_CONTROL = "CHANGE_CONTROL", "Change control"


class QualityRiskMitigationKind(models.TextChoices):
    CAPA = "CAPA", "CAPA"
    CHANGE_REQUEST = "CHANGE_REQUEST", "Change request"
    TRAINING = "TRAINING", "Training"
    DOCUMENT = "DOCUMENT", "Controlled document"
    CONTROL = "CONTROL", "Control"


class QualityRisk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_risks"
    )
    risk_code = models.CharField(
        max_length=64, help_text="Owner-supplied risk identifier (not seeded)."
    )
    title = models.CharField(max_length=255)
    category_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Owner-configured category shell. Not a seeded Nelna taxonomy.",
    )
    cause = models.TextField(blank=True, default="")
    potential_impact = models.TextField(blank=True, default="")
    existing_control = models.TextField(blank=True, default="")
    description = models.TextField(blank=True, default="")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_risks_owned",
    )
    owner_reference = models.CharField(max_length=128, blank=True, default="")
    status = models.CharField(
        max_length=16,
        choices=QualityRiskStatus.choices,
        default=QualityRiskStatus.DRAFT,
    )
    next_review_date = models.DateField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_risks_accepted",
    )
    acceptance_rationale = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_risks_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_risks_closed",
    )

    class Meta:
        verbose_name = "Quality risk"
        verbose_name_plural = "Quality risks"
        constraints = [
            models.UniqueConstraint(
                Lower("risk_code"),
                "organization",
                name="quality_risk_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="qr_risk_org_status_idx"),
            models.Index(
                fields=["organization", "next_review_date"], name="qr_risk_org_review_idx"
            ),
        ]
        default_permissions = ()
        permissions = [
            ("view_qualityrisk", "Can view quality risks"),
            ("manage_qualityrisk", "Can create and maintain quality risks"),
            ("assess_qualityrisk", "Can record historical risk assessments"),
            ("accept_qualityrisk", "Can accept residual quality risk"),
            ("manage_qualityriskpolicy", "Can configure owner-cited scoring policy"),
        ]

    def __str__(self) -> str:
        return f"{self.risk_code} ({self.status})"

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_RISK_STATUSES

    def clean(self) -> None:
        super().clean()
        if not (self.risk_code or "").strip():
            raise ValidationError({"risk_code": "Risk identifier is required."})
        self.risk_code = (self.risk_code or "").strip()
        if not (self.title or "").strip():
            raise ValidationError({"title": "Title is required."})
        self.title = (self.title or "").strip()


class QualityRiskCategoryConfig(models.Model):
    """Unseeded category shells — not a Nelna risk taxonomy."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_risk_categories"
    )
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_risk_categories_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="quality_risk_category_org_code_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code}"


class QualityRiskScoringPolicy(models.Model):
    """Owner-cited scoring configuration. Default OFF. No invented matrix."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_risk_scoring_policies"
    )
    scoring_enabled = models.BooleanField(default=False)
    formula_citation = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="Official owner-cited scoring method. Empty until APR-072.",
    )
    high_rated_codes = models.JSONField(
        default=list,
        blank=True,
        help_text="Owner-supplied residual-risk input codes treated as high-rated. Empty default.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_risk_scoring_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["organization"], name="quality_risk_scoring_policy_org_uniq"
            ),
        ]

    def __str__(self) -> str:
        return f"scoring:{self.organization_id}:{'on' if self.scoring_enabled else 'off'}"


class QualityRiskAssessment(models.Model):
    """Append-only assessment snapshot. Previous rows are never overwritten."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    risk = models.ForeignKey(QualityRisk, on_delete=models.PROTECT, related_name="assessments")
    version_number = models.PositiveIntegerField()
    likelihood_input = models.CharField(max_length=64, blank=True, default="")
    severity_input = models.CharField(max_length=64, blank=True, default="")
    detectability_input = models.CharField(max_length=64, blank=True, default="")
    exposure_input = models.CharField(max_length=64, blank=True, default="")
    residual_risk_input = models.CharField(max_length=64, blank=True, default="")
    computed_score_text = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Owner-supplied score text. Allowed only when scoring_enabled.",
    )
    method_citation = models.CharField(max_length=512, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_risk_assessments",
    )
    assessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["risk", "version_number"], name="quality_risk_assessment_version_uniq"
            ),
        ]
        ordering = ("version_number",)
        indexes = [
            models.Index(fields=["risk", "assessed_at"], name="qr_assess_risk_at_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.risk_id}:v{self.version_number}"


class QualityRiskLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    risk = models.ForeignKey(QualityRisk, on_delete=models.PROTECT, related_name="links")
    link_kind = models.CharField(max_length=32, choices=QualityRiskLinkKind.choices)
    linked_object_id = models.UUIDField(null=True, blank=True)
    citation = models.CharField(max_length=512)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_risk_links_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        indexes = [models.Index(fields=["risk", "link_kind"], name="qr_link_risk_kind_idx")]

    def __str__(self) -> str:
        return f"{self.link_kind}:{self.citation}"

    def clean(self) -> None:
        super().clean()
        if not (self.citation or "").strip() and self.linked_object_id is None:
            raise ValidationError({"citation": "Provide a citation or a linked object identifier."})
        self.citation = (self.citation or "").strip()
        if self.link_kind not in QualityRiskLinkKind.values:
            raise ValidationError({"link_kind": "Unknown risk link kind."})


class QualityRiskMitigation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    risk = models.ForeignKey(QualityRisk, on_delete=models.PROTECT, related_name="mitigations")
    mitigation_kind = models.CharField(max_length=16, choices=QualityRiskMitigationKind.choices)
    summary = models.CharField(max_length=512)
    citation = models.CharField(max_length=512, blank=True, default="")
    due_date = models.DateField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_risk_mitigations_owned",
    )
    corrective_action = models.ForeignKey(
        "capa.CorrectiveAction",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_risk_mitigations",
    )
    change_request = models.ForeignKey(
        "change_control.QualityChangeRequest",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_risk_mitigations",
    )
    training_record = models.ForeignKey(
        "training.TrainingRecord",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_risk_mitigations",
    )
    document_version = models.ForeignKey(
        "document_control.QualityDocumentVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_risk_mitigations",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_risk_mitigations_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"{self.mitigation_kind}:{self.risk_id}"

    def clean(self) -> None:
        super().clean()
        if not (self.summary or "").strip():
            raise ValidationError({"summary": "Mitigation summary is required."})
        self.summary = (self.summary or "").strip()


class QualityRiskReview(models.Model):
    """Append-only periodic review. Does not replace assessment history."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    risk = models.ForeignKey(QualityRisk, on_delete=models.PROTECT, related_name="reviews")
    notes = models.TextField()
    next_review_date = models.DateField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_risk_reviews",
    )
    reviewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        ordering = ("reviewed_at",)

    def __str__(self) -> str:
        return f"review:{self.risk_id}:{self.reviewed_at:%Y-%m-%d}"


class QualityRiskEvent(models.Model):
    """Append-only quality-risk history (not apps.security_audit)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    risk = models.ForeignKey(QualityRisk, on_delete=models.PROTECT, related_name="events")
    event_type = models.CharField(max_length=64)
    summary = models.CharField(max_length=512)
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_risk_events",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        default_permissions = ()
        indexes = [models.Index(fields=["risk", "created_at"], name="qr_event_risk_created_idx")]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"
