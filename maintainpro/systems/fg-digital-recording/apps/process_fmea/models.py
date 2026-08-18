"""Process FMEA foundation — Phase 48 (ADR-059).

Structured PFMEA records linked to quality-risk architecture.
Do not invent RPN thresholds, Action Priority tables, or 1–10 scales.
Scoring stays disabled until an owner-cited model is configured (APR-073).
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class ProcessFmeaVersionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    SUPERSEDED = "SUPERSEDED", "Superseded"
    WITHDRAWN = "WITHDRAWN", "Withdrawn"


LOCKED_FMEA_VERSION_STATUSES = frozenset(
    {
        ProcessFmeaVersionStatus.APPROVED,
        ProcessFmeaVersionStatus.SUPERSEDED,
        ProcessFmeaVersionStatus.WITHDRAWN,
    }
)


class FmeaScoringFormulaKind(models.TextChoices):
    """Architectural calculation kinds — not a Nelna FMEA methodology."""

    NONE = "NONE", "No automatic calculation"
    SOD_PRODUCT = "SOD_PRODUCT", "Mathematical S×O×D after explicit configuration"
    OWNER_SUPPLIED = "OWNER_SUPPLIED", "Owner-supplied score text only"


class ProcessFmeaLinkKind(models.TextChoices):
    PROCESS = "PROCESS", "Process"
    HACCP = "HACCP", "HACCP"
    CHECKLIST = "CHECKLIST", "Checklist"
    RISK = "RISK", "Quality risk"
    NCR = "NCR", "Nonconformance"
    CAPA = "CAPA", "CAPA"
    CHANGE_CONTROL = "CHANGE_CONTROL", "Change control"


class ProcessFmeaActionKind(models.TextChoices):
    CAPA = "CAPA", "CAPA"
    CHANGE_REQUEST = "CHANGE_REQUEST", "Change request"
    ACTION = "ACTION", "Owner follow-up"


class ProcessFmea(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="process_fmeas"
    )
    fmea_code = models.CharField(
        max_length=64, help_text="Owner-supplied PFMEA identifier (not seeded)."
    )
    title = models.CharField(max_length=255)
    process_reference = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmeas_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Process FMEA"
        verbose_name_plural = "Process FMEAs"
        constraints = [
            models.UniqueConstraint(
                Lower("fmea_code"),
                "organization",
                name="process_fmea_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "fmea_code"], name="pfmea_org_code_idx"),
        ]
        default_permissions = ()
        permissions = [
            ("view_processfmea", "Can view process FMEA records"),
            ("manage_processfmea", "Can draft and maintain process FMEA versions"),
            ("approve_processfmea", "Can approve process FMEA versions"),
            ("configure_processfmeascoring", "Can configure owner-cited FMEA scoring"),
            ("link_processfmea_action", "Can link recommended actions to CAPA/change"),
        ]

    def __str__(self) -> str:
        return f"{self.fmea_code}"

    def clean(self) -> None:
        super().clean()
        if not (self.fmea_code or "").strip():
            raise ValidationError({"fmea_code": "FMEA identifier is required."})
        self.fmea_code = (self.fmea_code or "").strip()
        if not (self.title or "").strip():
            raise ValidationError({"title": "Title is required."})
        self.title = (self.title or "").strip()


class ProcessFmeaVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fmea = models.ForeignKey(ProcessFmea, on_delete=models.PROTECT, related_name="versions")
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=ProcessFmeaVersionStatus.choices,
        default=ProcessFmeaVersionStatus.DRAFT,
    )
    scoring_enabled = models.BooleanField(default=False)
    formula_kind = models.CharField(
        max_length=16,
        choices=FmeaScoringFormulaKind.choices,
        default=FmeaScoringFormulaKind.NONE,
    )
    formula_citation = models.CharField(max_length=512, blank=True, default="")
    revision_note = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_versions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="process_fmea_versions_approved",
    )

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["fmea", "version_number"], name="process_fmea_version_uniq"
            ),
        ]
        ordering = ("version_number",)
        indexes = [
            models.Index(fields=["fmea", "status"], name="pfmea_ver_status_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.fmea_id}:v{self.version_number} ({self.status})"

    @property
    def is_historically_locked(self) -> bool:
        return self.status in LOCKED_FMEA_VERSION_STATUSES


class ProcessFmeaScoringPolicy(models.Model):
    """Owner-cited scoring configuration. Default OFF. No invented RPN policy."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="process_fmea_scoring_policies"
    )
    scoring_enabled = models.BooleanField(default=False)
    formula_kind = models.CharField(
        max_length=16,
        choices=FmeaScoringFormulaKind.choices,
        default=FmeaScoringFormulaKind.NONE,
    )
    formula_citation = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="Official owner-cited scoring method. Empty until APR-073.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_scoring_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["organization"], name="process_fmea_scoring_policy_org_uniq"
            ),
        ]

    def __str__(self) -> str:
        return f"fmea-scoring:{self.organization_id}:{'on' if self.scoring_enabled else 'off'}"


class ProcessStep(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(
        ProcessFmeaVersion, on_delete=models.PROTECT, related_name="process_steps"
    )
    step_code = models.CharField(max_length=64)
    sequence = models.PositiveIntegerField(default=1)
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_steps_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        ordering = ("sequence", "step_code")
        constraints = [
            models.UniqueConstraint(
                Lower("step_code"),
                "version",
                name="process_fmea_step_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.step_code}"

    def clean(self) -> None:
        super().clean()
        if not (self.step_code or "").strip():
            raise ValidationError({"step_code": "Process step identifier is required."})
        self.step_code = (self.step_code or "").strip()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Process step description is required."})


class FailureMode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    process_step = models.ForeignKey(
        ProcessStep, on_delete=models.PROTECT, related_name="failure_modes"
    )
    mode_code = models.CharField(max_length=64)
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_modes_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                Lower("mode_code"),
                "process_step",
                name="process_fmea_mode_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.mode_code}"

    def clean(self) -> None:
        super().clean()
        if not (self.mode_code or "").strip():
            raise ValidationError({"mode_code": "Failure mode identifier is required."})
        self.mode_code = (self.mode_code or "").strip()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Failure mode description is required."})


class FailureEffect(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    failure_mode = models.ForeignKey(FailureMode, on_delete=models.PROTECT, related_name="effects")
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_effects_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"effect:{self.failure_mode_id}"

    def clean(self) -> None:
        super().clean()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Failure effect description is required."})


class PotentialCause(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    failure_mode = models.ForeignKey(FailureMode, on_delete=models.PROTECT, related_name="causes")
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_causes_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"cause:{self.failure_mode_id}"

    def clean(self) -> None:
        super().clean()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Potential cause description is required."})


class CurrentControl(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    failure_mode = models.ForeignKey(
        FailureMode, on_delete=models.PROTECT, related_name="current_controls"
    )
    description = models.TextField()
    control_reference = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_controls_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"control:{self.failure_mode_id}"

    def clean(self) -> None:
        super().clean()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Current control description is required."})


class FailureModeAssessment(models.Model):
    """Append-only S/O/D snapshot. Previous rows are never overwritten."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    failure_mode = models.ForeignKey(
        FailureMode, on_delete=models.PROTECT, related_name="assessments"
    )
    snapshot_number = models.PositiveIntegerField()
    severity_input = models.CharField(max_length=64, blank=True, default="")
    occurrence_input = models.CharField(max_length=64, blank=True, default="")
    detection_input = models.CharField(max_length=64, blank=True, default="")
    computed_score_text = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Mathematical product or owner text. Allowed only when scoring is configured.",
    )
    method_citation = models.CharField(max_length=512, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_assessments",
    )
    assessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["failure_mode", "snapshot_number"],
                name="process_fmea_assessment_snapshot_uniq",
            ),
        ]
        ordering = ("snapshot_number",)

    def __str__(self) -> str:
        return f"assess:{self.failure_mode_id}:v{self.snapshot_number}"


class RecommendedAction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    failure_mode = models.ForeignKey(
        FailureMode, on_delete=models.PROTECT, related_name="recommended_actions"
    )
    summary = models.CharField(max_length=512)
    action_kind = models.CharField(
        max_length=16,
        choices=ProcessFmeaActionKind.choices,
        default=ProcessFmeaActionKind.ACTION,
    )
    citation = models.CharField(max_length=512, blank=True, default="")
    corrective_action = models.ForeignKey(
        "capa.CorrectiveAction",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="process_fmea_actions",
    )
    change_request = models.ForeignKey(
        "change_control.QualityChangeRequest",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="process_fmea_actions",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_actions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"{self.action_kind}:{self.failure_mode_id}"

    def clean(self) -> None:
        super().clean()
        if not (self.summary or "").strip():
            raise ValidationError({"summary": "Recommended action summary is required."})
        self.summary = (self.summary or "").strip()


class ProcessFmeaLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(ProcessFmeaVersion, on_delete=models.PROTECT, related_name="links")
    link_kind = models.CharField(max_length=32, choices=ProcessFmeaLinkKind.choices)
    linked_object_id = models.UUIDField(null=True, blank=True)
    citation = models.CharField(max_length=512)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_links_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        indexes = [models.Index(fields=["version", "link_kind"], name="pfmea_link_kind_idx")]

    def __str__(self) -> str:
        return f"{self.link_kind}:{self.citation}"

    def clean(self) -> None:
        super().clean()
        if not (self.citation or "").strip() and self.linked_object_id is None:
            raise ValidationError({"citation": "Provide a citation or a linked object identifier."})
        self.citation = (self.citation or "").strip()
        if self.link_kind not in ProcessFmeaLinkKind.values:
            raise ValidationError({"link_kind": "Unknown FMEA link kind."})


class ProcessFmeaEvent(models.Model):
    """Append-only process-FMEA history (not apps.security_audit)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fmea = models.ForeignKey(ProcessFmea, on_delete=models.PROTECT, related_name="events")
    version = models.ForeignKey(
        ProcessFmeaVersion,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="events",
    )
    event_type = models.CharField(max_length=64)
    summary = models.CharField(max_length=512)
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="process_fmea_events",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        default_permissions = ()
        indexes = [models.Index(fields=["fmea", "created_at"], name="pfmea_event_created_idx")]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"
