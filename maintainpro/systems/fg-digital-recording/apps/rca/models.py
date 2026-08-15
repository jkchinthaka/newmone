"""Structured root-cause analysis toolkit — Phase 49 (ADR-060).

Optional 5 Why, fishbone, and cause/evidence tools. Software and AI must not
auto-confirm a root cause. Confirmation is a human permissioned act with evidence.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class RcaStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    ROOT_CAUSE_CONFIRMED = "ROOT_CAUSE_CONFIRMED", "Root cause confirmed"
    VERIFIED = "VERIFIED", "Verification recorded"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


TERMINAL_RCA_STATUSES = frozenset({RcaStatus.CLOSED, RcaStatus.CANCELLED})


class RcaSourceKind(models.TextChoices):
    NCR = "NCR", "Nonconformance"
    COMPLAINT = "COMPLAINT", "Customer complaint"
    AUDIT_FINDING = "AUDIT_FINDING", "QMS audit finding"
    CAPA = "CAPA", "CAPA"
    OTHER = "OTHER", "Other owner-cited source"


class RcaCauseState(models.TextChoices):
    POSSIBLE_CAUSE = "POSSIBLE_CAUSE", "Possible cause"
    SUPPORTED_CAUSE = "SUPPORTED_CAUSE", "Supported cause"
    CONFIRMED_ROOT_CAUSE = "CONFIRMED_ROOT_CAUSE", "Confirmed root cause"


class RcaFishboneCategory(models.TextChoices):
    """Generic Ishikawa labels — not a Nelna process taxonomy."""

    PEOPLE = "PEOPLE", "People"
    METHOD = "METHOD", "Method"
    MACHINE = "MACHINE", "Machine"
    MATERIAL = "MATERIAL", "Material"
    MEASUREMENT = "MEASUREMENT", "Measurement"
    ENVIRONMENT = "ENVIRONMENT", "Environment"
    OTHER = "OTHER", "Other owner-cited category"


class RootCauseAnalysis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="root_cause_analyses"
    )
    rca_code = models.CharField(
        max_length=64, help_text="Owner-supplied RCA identifier (not seeded)."
    )
    source_kind = models.CharField(max_length=16, choices=RcaSourceKind.choices)
    source_citation = models.CharField(max_length=512)
    linked_object_id = models.UUIDField(null=True, blank=True)
    problem_statement = models.TextField()
    containment_reference = models.TextField(
        blank=True,
        default="",
        help_text="Optional immediate containment citation. Does not open or close NCR/CAPA.",
    )
    facilitator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rca_facilitated",
    )
    facilitator_reference = models.CharField(max_length=128, blank=True, default="")
    started_at = models.DateTimeField()
    status = models.CharField(max_length=24, choices=RcaStatus.choices, default=RcaStatus.DRAFT)
    confirmed_root_cause_text = models.TextField(blank=True, default="")
    verification_notes = models.TextField(blank=True, default="")
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rca_verified",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rca_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rca_closed",
    )

    class Meta:
        verbose_name = "Root cause analysis"
        verbose_name_plural = "Root cause analyses"
        constraints = [
            models.UniqueConstraint(
                Lower("rca_code"),
                "organization",
                name="rca_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="rca_org_status_idx"),
        ]
        default_permissions = ()
        permissions = [
            ("view_rca", "Can view root-cause analyses"),
            ("manage_rca", "Can create and edit RCA records and hypotheses"),
            ("confirm_rca", "Can confirm a human-supported root cause"),
            ("link_rca_capa", "Can link a confirmed root cause to CAPA"),
        ]

    def __str__(self) -> str:
        return f"{self.rca_code} ({self.status})"

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_RCA_STATUSES

    def clean(self) -> None:
        super().clean()
        if not (self.rca_code or "").strip():
            raise ValidationError({"rca_code": "RCA identifier is required."})
        self.rca_code = (self.rca_code or "").strip()
        if not (self.problem_statement or "").strip():
            raise ValidationError({"problem_statement": "Problem statement is required."})
        if not (self.source_citation or "").strip() and self.linked_object_id is None:
            raise ValidationError(
                {"source_citation": "Provide a source citation or a linked source object."}
            )
        self.source_citation = (self.source_citation or "").strip()
        if self.source_kind not in RcaSourceKind.values:
            raise ValidationError({"source_kind": "Unknown RCA source kind."})


class RcaParticipant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rca = models.ForeignKey(
        RootCauseAnalysis, on_delete=models.PROTECT, related_name="participants"
    )
    participant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rca_participations",
    )
    name_reference = models.CharField(max_length=128, blank=True, default="")
    role_note = models.CharField(max_length=128, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rca_participants_added",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return self.name_reference or str(self.participant_id)

    def clean(self) -> None:
        super().clean()
        if self.participant_id is None and not (self.name_reference or "").strip():
            raise ValidationError(
                {"name_reference": "Provide a participant user or a name reference."}
            )


class RcaFiveWhyStep(models.Model):
    """Optional 5 Why chain. Count is not mandated."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rca = models.ForeignKey(
        RootCauseAnalysis, on_delete=models.PROTECT, related_name="five_why_steps"
    )
    sequence = models.PositiveIntegerField()
    why_question = models.CharField(max_length=512)
    answer = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rca_five_why_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        ordering = ("sequence",)
        constraints = [
            models.UniqueConstraint(fields=["rca", "sequence"], name="rca_five_why_sequence_uniq"),
        ]

    def __str__(self) -> str:
        return f"why:{self.rca_id}:{self.sequence}"

    def clean(self) -> None:
        super().clean()
        if not (self.why_question or "").strip():
            raise ValidationError({"why_question": "Why question is required."})
        if not (self.answer or "").strip():
            raise ValidationError({"answer": "Why answer is required."})


class RcaFishboneEntry(models.Model):
    """Optional Ishikawa entry. Categories are architectural, not required."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rca = models.ForeignKey(
        RootCauseAnalysis, on_delete=models.PROTECT, related_name="fishbone_entries"
    )
    category = models.CharField(max_length=16, choices=RcaFishboneCategory.choices)
    category_label = models.CharField(max_length=128, blank=True, default="")
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rca_fishbone_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"fishbone:{self.category}"

    def clean(self) -> None:
        super().clean()
        if self.category not in RcaFishboneCategory.values:
            raise ValidationError({"category": "Unknown fishbone category."})
        if not (self.description or "").strip():
            raise ValidationError({"description": "Fishbone description is required."})


class RcaCause(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rca = models.ForeignKey(RootCauseAnalysis, on_delete=models.PROTECT, related_name="causes")
    statement = models.TextField()
    state = models.CharField(
        max_length=24,
        choices=RcaCauseState.choices,
        default=RcaCauseState.POSSIBLE_CAUSE,
    )
    suggested_by_ai = models.BooleanField(default=False)
    evidence_citation = models.CharField(max_length=512, blank=True, default="")
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rca_causes_confirmed",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rca_causes_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"{self.state}:{self.rca_id}"

    def clean(self) -> None:
        super().clean()
        if not (self.statement or "").strip():
            raise ValidationError({"statement": "Cause statement is required."})
        if self.state not in RcaCauseState.values:
            raise ValidationError({"state": "Unknown cause state."})


class RcaEvidenceLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rca = models.ForeignKey(
        RootCauseAnalysis, on_delete=models.PROTECT, related_name="evidence_links"
    )
    cause = models.ForeignKey(
        RcaCause,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="evidence_links",
    )
    citation = models.CharField(max_length=512)
    linked_object_id = models.UUIDField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rca_evidence_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"evidence:{self.citation}"

    def clean(self) -> None:
        super().clean()
        if not (self.citation or "").strip() and self.linked_object_id is None:
            raise ValidationError(
                {"citation": "Provide an evidence citation or object identifier."}
            )
        self.citation = (self.citation or "").strip()


class RcaCapaLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cause = models.ForeignKey(RcaCause, on_delete=models.PROTECT, related_name="capa_links")
    corrective_action = models.ForeignKey(
        "capa.CorrectiveAction",
        on_delete=models.PROTECT,
        related_name="rca_cause_links",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rca_capa_links_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"capa:{self.cause_id}"


class RcaEvent(models.Model):
    """Append-only RCA history (not apps.security_audit)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rca = models.ForeignKey(RootCauseAnalysis, on_delete=models.PROTECT, related_name="events")
    event_type = models.CharField(max_length=64)
    summary = models.CharField(max_length=512)
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rca_events",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        default_permissions = ()
        indexes = [models.Index(fields=["rca", "created_at"], name="rca_event_created_idx")]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"
