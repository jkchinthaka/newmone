"""QMS quality audit planning, findings, and follow-up — Phase 45 (ADR-056).

This module is not apps.security_audit. Security event logging remains a
separate control. Company audit frequency, severity taxonomy, and close
rules remain APR-070 EVIDENCE REQUIRED.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class QualityAuditType(models.TextChoices):
    """Generic architectural types — not Nelna programme codes or frequencies."""

    INTERNAL = "INTERNAL", "Internal"
    EXTERNAL = "EXTERNAL", "External"
    SUPPLIER = "SUPPLIER", "Supplier"
    PROCESS = "PROCESS", "Process"
    SYSTEM = "SYSTEM", "System"


class QualityAuditStatus(models.TextChoices):
    PLANNED = "PLANNED", "Planned"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    FINDINGS = "FINDINGS", "Findings"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


AUDIT_TRANSITIONS: dict[str, frozenset[str]] = {
    QualityAuditStatus.PLANNED: frozenset(
        {QualityAuditStatus.IN_PROGRESS, QualityAuditStatus.CANCELLED}
    ),
    QualityAuditStatus.IN_PROGRESS: frozenset(
        {QualityAuditStatus.FINDINGS, QualityAuditStatus.CANCELLED}
    ),
    QualityAuditStatus.FINDINGS: frozenset(
        {QualityAuditStatus.CLOSED, QualityAuditStatus.IN_PROGRESS}
    ),
    QualityAuditStatus.CLOSED: frozenset(),
    QualityAuditStatus.CANCELLED: frozenset(),
}

TERMINAL_AUDIT_STATUSES = frozenset({QualityAuditStatus.CLOSED, QualityAuditStatus.CANCELLED})


class QualityAuditFindingStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ACTION_COMPLETED = "ACTION_COMPLETED", "Action completed"
    VERIFIED = "VERIFIED", "Verified"
    CLOSED = "CLOSED", "Closed"


FINDING_TRANSITIONS: dict[str, frozenset[str]] = {
    QualityAuditFindingStatus.OPEN: frozenset({QualityAuditFindingStatus.ACTION_COMPLETED}),
    QualityAuditFindingStatus.ACTION_COMPLETED: frozenset(
        {QualityAuditFindingStatus.VERIFIED, QualityAuditFindingStatus.OPEN}
    ),
    QualityAuditFindingStatus.VERIFIED: frozenset({QualityAuditFindingStatus.CLOSED}),
    QualityAuditFindingStatus.CLOSED: frozenset(),
}


class QualityAudit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_audits"
    )
    audit_code = models.CharField(
        max_length=64, help_text="Owner-supplied audit identifier (not seeded)."
    )
    audit_type = models.CharField(max_length=16, choices=QualityAuditType.choices)
    type_code_reference = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Optional owner-configured type catalogue code (APR-070).",
    )
    title = models.CharField(max_length=255)
    scope_summary = models.TextField()
    site_reference = models.CharField(max_length=128, blank=True, default="")
    department_reference = models.CharField(max_length=128, blank=True, default="")
    process_reference = models.CharField(max_length=128, blank=True, default="")
    planned_date = models.DateField(null=True, blank=True)
    lead_auditor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_audits_led",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=16,
        choices=QualityAuditStatus.choices,
        default=QualityAuditStatus.PLANNED,
    )
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audits",
    )
    checklist_version = models.ForeignKey(
        "checklists.ChecklistVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audits",
    )
    checklist_task = models.ForeignKey(
        "scheduling.ChecklistTask",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audits",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_audits_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audits_closed",
    )

    class Meta:
        verbose_name = "Quality audit"
        verbose_name_plural = "Quality audits"
        constraints = [
            models.UniqueConstraint(
                Lower("audit_code"),
                "organization",
                name="quality_audit_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="qa_audit_org_status_idx"),
            models.Index(fields=["organization", "site_reference"], name="qa_audit_org_site_idx"),
            models.Index(
                fields=["organization", "process_reference"],
                name="qa_audit_org_process_idx",
            ),
        ]
        default_permissions = ()
        permissions = [
            ("view_qualityaudit", "Can view QMS quality audits"),
            ("plan_qualityaudit", "Can plan QMS quality audits"),
            ("execute_qualityaudit", "Can execute QMS quality audits and record findings"),
            ("close_qualityaudit", "Can verify findings and close QMS quality audits"),
            ("link_audit_quality_case", "Can explicitly link/create NCR/CAPA from a finding"),
            ("manage_auditfindingconfig", "Can manage finding classification/severity shells"),
        ]

    def __str__(self) -> str:
        return f"{self.audit_code} ({self.status})"

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_AUDIT_STATUSES

    def clean(self) -> None:
        super().clean()
        if not (self.audit_code or "").strip():
            raise ValidationError({"audit_code": "Audit identifier is required."})
        self.audit_code = (self.audit_code or "").strip()
        if not (self.title or "").strip():
            raise ValidationError({"title": "Title is required."})
        self.title = (self.title or "").strip()
        if not (self.scope_summary or "").strip():
            raise ValidationError({"scope_summary": "Scope is required."})
        if self.audit_type not in QualityAuditType.values:
            raise ValidationError({"audit_type": "Unknown architectural audit type."})


class QualityAuditParticipant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    audit = models.ForeignKey(QualityAudit, on_delete=models.PROTECT, related_name="participants")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_audit_participations",
    )
    role_reference = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["audit", "user"], name="quality_audit_participant_uniq"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.audit_id}:{self.user_id}"


class QualityAuditChecklistBinding(models.Model):
    """Registers a checklist template as an audit template, not an FG operational check."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_audit_checklist_bindings"
    )
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        related_name="quality_audit_bindings",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_audit_checklist_bindings_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "checklist_template"],
                name="quality_audit_checklist_bind_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"audit-checklist:{self.checklist_template_id}"


class QualityAuditFindingCodeConfig(models.Model):
    """Owner-configured classification/severity shells — unseeded."""

    class Kind(models.TextChoices):
        CLASSIFICATION = "CLASSIFICATION", "Classification"
        SEVERITY = "SEVERITY", "Severity"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_audit_finding_codes"
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_audit_finding_codes_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                "kind",
                name="quality_audit_finding_code_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.kind}:{self.code}"


class QualityAuditFinding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    audit = models.ForeignKey(QualityAudit, on_delete=models.PROTECT, related_name="findings")
    description = models.TextField()
    reference = models.CharField(max_length=255, blank=True, default="")
    classification_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Owner-configured; not a seeded Nelna taxonomy.",
    )
    severity_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Owner-configured; not a seeded Nelna taxonomy.",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audit_findings_owned",
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=QualityAuditFindingStatus.choices,
        default=QualityAuditFindingStatus.OPEN,
    )
    nonconformance = models.ForeignKey(
        "nonconformance.NonConformanceRecord",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audit_findings",
    )
    corrective_action = models.ForeignKey(
        "capa.CorrectiveAction",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audit_findings",
    )
    action_completed_at = models.DateTimeField(null=True, blank=True)
    action_completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audit_findings_actioned",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audit_findings_verified",
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_audit_findings_closed",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_audit_findings_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        default_permissions = ()
        indexes = [
            models.Index(fields=["status", "due_date"], name="qa_finding_status_due_idx"),
            models.Index(fields=["audit", "status"], name="qa_finding_audit_status_idx"),
        ]

    def __str__(self) -> str:
        return f"finding:{self.audit_id}:{self.status}"

    def clean(self) -> None:
        super().clean()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Finding description is required."})


class QualityAuditEvent(models.Model):
    """Append-only QMS audit-management history (not security_audit)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    audit = models.ForeignKey(QualityAudit, on_delete=models.PROTECT, related_name="events")
    finding = models.ForeignKey(
        QualityAuditFinding,
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
        related_name="quality_audit_events",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        default_permissions = ()
        indexes = [models.Index(fields=["audit", "created_at"], name="qa_event_audit_created_idx")]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"
