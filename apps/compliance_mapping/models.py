"""Compliance / control-mapping foundation — Phase 46 (ADR-057).

System controls can support compliance *evidence*. Software implementation
alone does not prove regulatory, legal, or certification compliance.

Do not seed ISO / FSSC / HACCP / SLS applicability. Owner-supplied source
identifiers and clause references only. IMPLEMENTED is never COMPLIANT.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class ComplianceSourceKind(models.TextChoices):
    """Architectural source kinds — not a Nelna applicability catalogue."""

    COMPANY_POLICY = "COMPANY_POLICY", "Company policy"
    HACCP_PLAN = "HACCP_PLAN", "Approved HACCP plan"
    CUSTOMER_REQUIREMENT = "CUSTOMER_REQUIREMENT", "Customer requirement"
    LEGAL_REGULATORY = "LEGAL_REGULATORY", "Legal / regulatory requirement"
    CERTIFICATION_SCHEME = "CERTIFICATION_SCHEME", "Certification-scheme requirement"
    OTHER = "OTHER", "Other owner-cited source"


class ApplicabilityStatus(models.TextChoices):
    NOT_ASSESSED = "NOT_ASSESSED", "Not assessed"
    APPLICABILITY_PENDING = "APPLICABILITY_PENDING", "Applicability pending"
    APPLICABLE = "APPLICABLE", "Applicable"
    NOT_APPLICABLE = "NOT_APPLICABLE", "Not applicable"


class SourceRegisterStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    ACTIVE = "ACTIVE", "Active"
    SUPERSEDED = "SUPERSEDED", "Superseded"
    WITHDRAWN = "WITHDRAWN", "Withdrawn"


LOCKED_EDITION_STATUSES = frozenset(
    {SourceRegisterStatus.SUPERSEDED, SourceRegisterStatus.WITHDRAWN}
)


class ControlMappingStatus(models.TextChoices):
    """Truthful mapping statuses. There is no COMPLIANT value."""

    NOT_ASSESSED = "NOT_ASSESSED", "Not assessed"
    APPLICABILITY_PENDING = "APPLICABILITY_PENDING", "Applicability pending"
    APPLICABLE = "APPLICABLE", "Applicable"
    NOT_APPLICABLE = "NOT_APPLICABLE", "Not applicable"
    CONTROL_DESIGNED = "CONTROL_DESIGNED", "Control designed"
    IMPLEMENTED = "IMPLEMENTED", "Implemented"
    VERIFIED = "VERIFIED", "Verified"
    GAP_IDENTIFIED = "GAP_IDENTIFIED", "Gap identified"


MAPPING_TRANSITIONS: dict[str, frozenset[str]] = {
    ControlMappingStatus.NOT_ASSESSED: frozenset(
        {
            ControlMappingStatus.APPLICABILITY_PENDING,
            ControlMappingStatus.APPLICABLE,
            ControlMappingStatus.NOT_APPLICABLE,
        }
    ),
    ControlMappingStatus.APPLICABILITY_PENDING: frozenset(
        {
            ControlMappingStatus.NOT_ASSESSED,
            ControlMappingStatus.APPLICABLE,
            ControlMappingStatus.NOT_APPLICABLE,
        }
    ),
    ControlMappingStatus.APPLICABLE: frozenset(
        {
            ControlMappingStatus.APPLICABILITY_PENDING,
            ControlMappingStatus.CONTROL_DESIGNED,
            ControlMappingStatus.GAP_IDENTIFIED,
        }
    ),
    ControlMappingStatus.NOT_APPLICABLE: frozenset({ControlMappingStatus.APPLICABILITY_PENDING}),
    ControlMappingStatus.CONTROL_DESIGNED: frozenset(
        {
            ControlMappingStatus.APPLICABLE,
            ControlMappingStatus.IMPLEMENTED,
            ControlMappingStatus.GAP_IDENTIFIED,
        }
    ),
    ControlMappingStatus.IMPLEMENTED: frozenset(
        {
            ControlMappingStatus.CONTROL_DESIGNED,
            ControlMappingStatus.VERIFIED,
            ControlMappingStatus.GAP_IDENTIFIED,
        }
    ),
    ControlMappingStatus.VERIFIED: frozenset(
        {ControlMappingStatus.IMPLEMENTED, ControlMappingStatus.GAP_IDENTIFIED}
    ),
    ControlMappingStatus.GAP_IDENTIFIED: frozenset(
        {
            ControlMappingStatus.APPLICABLE,
            ControlMappingStatus.CONTROL_DESIGNED,
            ControlMappingStatus.IMPLEMENTED,
        }
    ),
}


class SystemControlKind(models.TextChoices):
    """Architectural system-control kinds that may hold evidence."""

    CHECKLIST_DEFINITION = "CHECKLIST_DEFINITION", "Checklist definition"
    HACCP_CONTROL = "HACCP_CONTROL", "HACCP control"
    TRAINING_RECORD = "TRAINING_RECORD", "Training record"
    CALIBRATION = "CALIBRATION", "Calibration"
    LABORATORY = "LABORATORY", "Laboratory"
    NCR = "NCR", "Nonconformance"
    CAPA = "CAPA", "CAPA"
    QUALITY_AUDIT = "QUALITY_AUDIT", "QMS audit record"
    DOCUMENT_VERSION = "DOCUMENT_VERSION", "Controlled document version"
    SECURITY_CONTROL = "SECURITY_CONTROL", "System security control"
    BACKUP_DR = "BACKUP_DR", "Backup / DR evidence"
    OTHER = "OTHER", "Other owner-cited control"


class GapActionKind(models.TextChoices):
    RISK = "RISK", "Risk register reference"
    CHANGE_REQUEST = "CHANGE_REQUEST", "Quality change request"
    NCR = "NCR", "Nonconformance"
    CAPA = "CAPA", "CAPA"
    ACTION = "ACTION", "Generic follow-up action"


class ComplianceSource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="compliance_sources"
    )
    source_code = models.CharField(
        max_length=64, help_text="Owner-supplied source identifier (not seeded)."
    )
    kind = models.CharField(max_length=32, choices=ComplianceSourceKind.choices)
    title = models.CharField(max_length=255)
    business_owner_reference = models.CharField(max_length=128, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="compliance_sources_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Compliance source"
        verbose_name_plural = "Compliance sources"
        constraints = [
            models.UniqueConstraint(
                Lower("source_code"),
                "organization",
                name="compliance_source_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "kind"], name="cm_source_org_kind_idx"),
        ]
        default_permissions = ()
        permissions = [
            ("view_compliancemapping", "Can view compliance sources and control mappings"),
            ("manage_compliancesource", "Can register and revise compliance sources"),
            ("manage_compliancecontrol", "Can create and update control mappings"),
            ("verify_compliancecontrol", "Can record verification of implemented controls"),
            ("link_compliance_gap_action", "Can explicitly link gap follow-up actions"),
        ]

    def __str__(self) -> str:
        return f"{self.source_code} ({self.kind})"

    def clean(self) -> None:
        super().clean()
        if not (self.source_code or "").strip():
            raise ValidationError({"source_code": "Source identifier is required."})
        self.source_code = (self.source_code or "").strip()
        if not (self.title or "").strip():
            raise ValidationError({"title": "Title is required."})
        self.title = (self.title or "").strip()
        if self.kind not in ComplianceSourceKind.values:
            raise ValidationError({"kind": "Unknown architectural source kind."})


class ComplianceSourceEdition(models.Model):
    """Exact official edition citation only — never reproduced standard text."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.ForeignKey(ComplianceSource, on_delete=models.PROTECT, related_name="editions")
    version_edition = models.CharField(max_length=128)
    official_source_citation = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="Exact official publisher/version citation. Do not store copyrighted text.",
    )
    applicability_status = models.CharField(
        max_length=24,
        choices=ApplicabilityStatus.choices,
        default=ApplicabilityStatus.NOT_ASSESSED,
    )
    evidence_reference = models.CharField(max_length=255, blank=True, default="")
    last_reviewed_on = models.DateField(null=True, blank=True)
    register_status = models.CharField(
        max_length=16,
        choices=SourceRegisterStatus.choices,
        default=SourceRegisterStatus.ACTIVE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="compliance_source_editions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                Lower("version_edition"),
                "source",
                name="compliance_source_edition_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["source", "register_status"],
                name="cm_edition_source_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.source.source_code}@{self.version_edition}"

    @property
    def is_locked(self) -> bool:
        return self.register_status in LOCKED_EDITION_STATUSES

    def clean(self) -> None:
        super().clean()
        if not (self.version_edition or "").strip():
            raise ValidationError({"version_edition": "Version / edition is required."})
        self.version_edition = (self.version_edition or "").strip()
        if self.applicability_status not in ApplicabilityStatus.values:
            raise ValidationError({"applicability_status": "Unknown applicability status."})


class ComplianceControlMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="compliance_control_mappings"
    )
    edition = models.ForeignKey(
        ComplianceSourceEdition, on_delete=models.PROTECT, related_name="mappings"
    )
    clause_reference = models.CharField(
        max_length=128,
        help_text="Owner-supplied clause/requirement ID. Do not invent standard text.",
    )
    requirement_summary = models.TextField(
        blank=True,
        default="",
        help_text="Owner-supplied summary only. Do not paste proprietary standard text.",
    )
    system_control_kind = models.CharField(max_length=32, choices=SystemControlKind.choices)
    system_control_reference = models.CharField(max_length=255)
    owner_reference = models.CharField(max_length=128, blank=True, default="")
    status = models.CharField(
        max_length=24,
        choices=ControlMappingStatus.choices,
        default=ControlMappingStatus.NOT_ASSESSED,
    )
    gap_summary = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="compliance_mappings_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        default_permissions = ()
        indexes = [
            models.Index(fields=["organization", "status"], name="cm_mapping_org_status_idx"),
            models.Index(fields=["edition", "status"], name="cm_mapping_edition_status_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.clause_reference}:{self.status}"

    def clean(self) -> None:
        super().clean()
        if not (self.clause_reference or "").strip():
            raise ValidationError(
                {"clause_reference": "Clause / requirement reference is required."}
            )
        self.clause_reference = (self.clause_reference or "").strip()
        if not (self.system_control_reference or "").strip():
            raise ValidationError(
                {"system_control_reference": "System control reference is required."}
            )
        self.system_control_reference = (self.system_control_reference or "").strip()
        if self.system_control_kind not in SystemControlKind.values:
            raise ValidationError({"system_control_kind": "Unknown system control kind."})
        if self.status not in ControlMappingStatus.values:
            raise ValidationError({"status": "Unknown mapping status."})
        if self.status == "COMPLIANT":
            raise ValidationError({"status": "IMPLEMENTED is not COMPLIANT."})


class ComplianceEvidenceLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(
        ComplianceControlMapping, on_delete=models.PROTECT, related_name="evidence_links"
    )
    evidence_kind = models.CharField(max_length=32, choices=SystemControlKind.choices)
    linked_object_id = models.UUIDField(null=True, blank=True)
    citation = models.CharField(max_length=512)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="compliance_evidence_links_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        indexes = [
            models.Index(fields=["mapping", "evidence_kind"], name="cm_evi_map_kind_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.evidence_kind}:{self.citation}"

    def clean(self) -> None:
        super().clean()
        if not (self.citation or "").strip() and self.linked_object_id is None:
            raise ValidationError({"citation": "Provide a citation or a linked object identifier."})
        self.citation = (self.citation or "").strip()
        if self.evidence_kind not in SystemControlKind.values:
            raise ValidationError({"evidence_kind": "Unknown evidence kind."})


class ComplianceGap(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        ADDRESSED = "ADDRESSED", "Addressed"
        CLOSED = "CLOSED", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(
        ComplianceControlMapping, on_delete=models.PROTECT, related_name="gaps"
    )
    description = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="compliance_gaps_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="compliance_gaps_closed",
    )

    class Meta:
        default_permissions = ()
        indexes = [models.Index(fields=["mapping", "status"], name="cm_gap_map_status_idx")]

    def __str__(self) -> str:
        return f"gap:{self.mapping_id}:{self.status}"

    def clean(self) -> None:
        super().clean()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Gap description is required."})


class ComplianceGapAction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gap = models.ForeignKey(ComplianceGap, on_delete=models.PROTECT, related_name="actions")
    action_kind = models.CharField(max_length=16, choices=GapActionKind.choices)
    risk_reference = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Owner-supplied risk ID (e.g. governance register). Not a certification claim.",
    )
    action_summary = models.CharField(max_length=512)
    due_date = models.DateField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="compliance_gap_actions_owned",
    )
    nonconformance = models.ForeignKey(
        "nonconformance.NonConformanceRecord",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="compliance_gap_actions",
    )
    corrective_action = models.ForeignKey(
        "capa.CorrectiveAction",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="compliance_gap_actions",
    )
    change_request = models.ForeignKey(
        "change_control.QualityChangeRequest",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="compliance_gap_actions",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="compliance_gap_actions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()

    def __str__(self) -> str:
        return f"{self.action_kind}:{self.gap_id}"


class ComplianceMappingEvent(models.Model):
    """Append-only mapping history (not apps.security_audit)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="compliance_mapping_events"
    )
    source = models.ForeignKey(ComplianceSource, on_delete=models.PROTECT, related_name="events")
    edition = models.ForeignKey(
        ComplianceSourceEdition,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="events",
    )
    mapping = models.ForeignKey(
        ComplianceControlMapping,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="events",
    )
    gap = models.ForeignKey(
        ComplianceGap,
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
        related_name="compliance_mapping_events",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        default_permissions = ()
        indexes = [
            models.Index(fields=["organization", "created_at"], name="cm_event_org_created_idx"),
            models.Index(fields=["source", "created_at"], name="cm_event_source_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"
