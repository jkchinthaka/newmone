"""Customer quality complaint management — Phase 39.

Traceable complaint cases with opaque ERP customer references, configurable
category strings (not a seeded severity taxonomy), batch-trace shells, and
communication references that never auto-send (ADR-050 / APR-064).
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class ComplaintCaseStatus(models.TextChoices):
    """Technical workflow statuses — not a seeded customer-service SLA."""

    DRAFT = "DRAFT", "Draft"
    OPEN = "OPEN", "Open"
    INVESTIGATING = "INVESTIGATING", "Investigating"
    PENDING_RESPONSE = "PENDING_RESPONSE", "Pending response"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


COMPLAINT_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    ComplaintCaseStatus.DRAFT: frozenset({ComplaintCaseStatus.OPEN, ComplaintCaseStatus.CANCELLED}),
    ComplaintCaseStatus.OPEN: frozenset(
        {
            ComplaintCaseStatus.INVESTIGATING,
            ComplaintCaseStatus.PENDING_RESPONSE,
            ComplaintCaseStatus.CLOSED,
            ComplaintCaseStatus.CANCELLED,
        }
    ),
    ComplaintCaseStatus.INVESTIGATING: frozenset(
        {
            ComplaintCaseStatus.PENDING_RESPONSE,
            ComplaintCaseStatus.CLOSED,
            ComplaintCaseStatus.CANCELLED,
            ComplaintCaseStatus.OPEN,
        }
    ),
    ComplaintCaseStatus.PENDING_RESPONSE: frozenset(
        {
            ComplaintCaseStatus.INVESTIGATING,
            ComplaintCaseStatus.CLOSED,
            ComplaintCaseStatus.CANCELLED,
        }
    ),
    ComplaintCaseStatus.CLOSED: frozenset(),
    ComplaintCaseStatus.CANCELLED: frozenset(),
}


class ComplaintInvestigationLinkKind(models.TextChoices):
    INVESTIGATION = "INVESTIGATION", "Investigation reference"
    RCA = "RCA", "Root-cause analysis reference"
    NCR = "NCR", "Nonconformance"
    CAPA = "CAPA", "Corrective / preventive action"


class CustomerComplaintCase(models.Model):
    """
    Organization-scoped customer quality complaint.

    Customer identity is an opaque ERP reference — not a local customer master.
    Category / severity strings are configurable references (EVIDENCE REQUIRED),
    not invented taxonomies.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="customer_complaint_cases",
    )
    code = models.CharField(max_length=64, help_text="Opaque complaint ID.")
    received_at = models.DateTimeField()
    channel_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque intake channel / procedure reference.",
    )
    erp_customer_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="ERP customer master key — SoR for customer identity.",
    )
    customer_display_label = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Optional non-PII label; sensitive reveal requires dedicated permission.",
    )
    product_reference = models.CharField(max_length=128, blank=True, default="")
    batch_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque batch/lot if known — empty when unknown.",
    )
    batch_known = models.BooleanField(
        default=False,
        help_text="True when batch_reference was provided at intake or confirmed later.",
    )
    description = models.TextField()
    category_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Configurable category reference — not a seeded taxonomy.",
    )
    severity_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Configurable severity reference — EVIDENCE REQUIRED.",
    )
    status = models.CharField(
        max_length=32,
        choices=ComplaintCaseStatus.choices,
        default=ComplaintCaseStatus.DRAFT,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="customer_complaints_owned",
        null=True,
        blank=True,
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="customer_complaints_closed",
        null=True,
        blank=True,
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    closure_notes = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="customer_complaints_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Customer complaint case"
        verbose_name_plural = "Customer complaint cases"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="complaint_case_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "code"]),
            models.Index(fields=["organization", "batch_reference"]),
            models.Index(fields=["organization", "erp_customer_reference"]),
        ]
        permissions = [
            ("view_customercomplaint", "Can view customer complaint cases"),
            ("create_customercomplaint", "Can create customer complaint cases"),
            ("manage_customercomplaint", "Can update complaint investigation and links"),
            ("close_customercomplaint", "Can close customer complaint cases"),
            (
                "view_complaint_customer_sensitive",
                "Can view customer-sensitive labels on complaints (privacy-restricted)",
            ),
            ("record_complaint_communication", "Can record complaint communication references"),
            ("manage_complaintpolicy", "Can manage complaint policy stubs"),
        ]

    def __str__(self) -> str:
        return f"{self.code}/{self.status}"

    def clean(self) -> None:
        super().clean()
        code = (self.code or "").strip()
        if not code:
            raise ValidationError({"code": "Complaint ID / code is required."})
        self.code = code
        if not (self.description or "").strip():
            raise ValidationError({"description": "Description is required."})
        batch = (self.batch_reference or "").strip()
        self.batch_reference = batch
        if batch:
            self.batch_known = True
        # Do not invent batch when unknown — leave blank and batch_known False.


class CustomerComplaintCategoryConfig(models.Model):
    """
    Org-configurable category/severity label shell.

    Empty until owners configure values — never a seeded Nelna taxonomy.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="customer_complaint_category_configs",
    )
    kind = models.CharField(
        max_length=32,
        help_text="CATEGORY or SEVERITY — technical discriminator only.",
    )
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="complaint_category_configs_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                "kind",
                name="complaint_category_org_kind_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.kind}:{self.code}"


class CustomerComplaintCommunication(models.Model):
    """Communication reference shell — does not send messages (APR-064)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    complaint_case = models.ForeignKey(
        CustomerComplaintCase,
        on_delete=models.PROTECT,
        related_name="communications",
    )
    reference = models.CharField(max_length=128)
    channel_reference = models.CharField(max_length=128, blank=True, default="")
    audience_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque audience label — no customer PII invent.",
    )
    evidence_attachment_id = models.UUIDField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="complaint_communications_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return self.reference


class CustomerComplaintInvestigationLink(models.Model):
    """Explicit investigation / RCA / NCR / CAPA link (user-initiated only)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    complaint_case = models.ForeignKey(
        CustomerComplaintCase,
        on_delete=models.PROTECT,
        related_name="investigation_links",
    )
    link_kind = models.CharField(
        max_length=32,
        choices=ComplaintInvestigationLinkKind.choices,
    )
    reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque investigation/RCA reference when no NCR/CAPA id.",
    )
    nonconformance_id = models.UUIDField(null=True, blank=True)
    corrective_action_id = models.UUIDField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    explicit_user_action = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="complaint_investigation_links_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["complaint_case", "link_kind"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.link_kind}:"
            f"{self.reference or self.nonconformance_id or self.corrective_action_id}"
        )

    def clean(self) -> None:
        super().clean()
        if not self.explicit_user_action:
            raise ValidationError(
                {
                    "explicit_user_action": (
                        "Investigation / RCA / NCR / CAPA links require explicit_user_action=True."
                    )
                }
            )


class CustomerComplaintEvidenceLink(models.Model):
    """Evidence attachment reference — binaries stay in evidence/object storage."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    complaint_case = models.ForeignKey(
        CustomerComplaintCase,
        on_delete=models.PROTECT,
        related_name="evidence_links",
    )
    evidence_attachment_id = models.UUIDField()
    notes = models.CharField(max_length=512, blank=True, default="")
    linked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="complaint_evidence_links_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["complaint_case", "evidence_attachment_id"],
                name="complaint_evidence_case_attachment_uniq",
            ),
        ]

    def __str__(self) -> str:
        return str(self.evidence_attachment_id)


class CustomerComplaintBatchTrace(models.Model):
    """
    Batch-trace shell linking complaint to dossier / genealogy / QA / lab / dispatch.

    Opaque UUID/reference fields only — does not invent product genealogy or
    invent QA disposition outcomes.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    complaint_case = models.OneToOneField(
        CustomerComplaintCase,
        on_delete=models.PROTECT,
        related_name="batch_trace",
    )
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    dossier_batch_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Phase 35 dossier lookup key — usually same as batch_reference.",
    )
    genealogy_node_id = models.UUIDField(null=True, blank=True)
    qa_disposition_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque QA disposition / review reference.",
    )
    qa_review_id = models.UUIDField(null=True, blank=True)
    lab_sample_id = models.UUIDField(null=True, blank=True)
    lab_sample_reference = models.CharField(max_length=128, blank=True, default="")
    dispatch_record_id = models.UUIDField(null=True, blank=True)
    dispatch_reference = models.CharField(max_length=128, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="complaint_batch_traces_updated",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"trace:{self.batch_reference or self.complaint_case.code}"


class CustomerComplaintTimelineEntry(models.Model):
    """Immutable append-only complaint timeline."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    complaint_case = models.ForeignKey(
        CustomerComplaintCase,
        on_delete=models.PROTECT,
        related_name="timeline_entries",
    )
    event_type = models.CharField(max_length=64)
    summary = models.CharField(max_length=512)
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="complaint_timeline_entries",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["complaint_case", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"


class CustomerComplaintPolicy(models.Model):
    """Org policy stubs — customer response auto-send dual-gated OFF (APR-064)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="customer_complaint_policy",
    )
    customer_response_auto_send_enabled = models.BooleanField(
        default=False,
        help_text=(
            "Org stub only — still requires COMPLAINT_CUSTOMER_RESPONSE_AUTO_SEND_APPROVED."
        ),
    )
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="customer_complaint_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Customer complaint policy"
        verbose_name_plural = "Customer complaint policies"

    def __str__(self) -> str:
        return f"{self.organization.code} complaint policy"
