"""Controlled quality document management — Phase 43 (ADR-054).

Generic architectural document kinds only. Owner-configured type/code
references remain empty until QMS owners supply values (APR-068).
Acknowledgement is not competency training.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class DocumentKind(models.TextChoices):
    """Generic QMS kinds — not Nelna document codes."""

    SOP = "SOP", "SOP"
    WORK_INSTRUCTION = "WORK_INSTRUCTION", "Work instruction"
    SPECIFICATION = "SPECIFICATION", "Specification"
    TEST_METHOD = "TEST_METHOD", "Test method"
    POLICY = "POLICY", "Policy"
    FORM_REFERENCE = "FORM_REFERENCE", "Form reference"


class DocumentVersionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    UNDER_REVIEW = "UNDER_REVIEW", "Under review"
    APPROVED = "APPROVED", "Approved"
    EFFECTIVE = "EFFECTIVE", "Effective"
    RETIRED = "RETIRED", "Retired"


IMMUTABLE_VERSION_STATUSES = frozenset(
    {
        DocumentVersionStatus.APPROVED,
        DocumentVersionStatus.EFFECTIVE,
        DocumentVersionStatus.RETIRED,
    }
)

VERSION_TRANSITIONS: dict[str, frozenset[str]] = {
    DocumentVersionStatus.DRAFT: frozenset({DocumentVersionStatus.UNDER_REVIEW}),
    DocumentVersionStatus.UNDER_REVIEW: frozenset(
        {DocumentVersionStatus.DRAFT, DocumentVersionStatus.APPROVED}
    ),
    DocumentVersionStatus.APPROVED: frozenset(
        {DocumentVersionStatus.EFFECTIVE, DocumentVersionStatus.RETIRED}
    ),
    DocumentVersionStatus.EFFECTIVE: frozenset({DocumentVersionStatus.RETIRED}),
    DocumentVersionStatus.RETIRED: frozenset(),
}


class QualityDocument(models.Model):
    """Organization-scoped document identity. Codes are owner-supplied, not seeded."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_documents"
    )
    code = models.CharField(max_length=64, help_text="Owner-supplied document code.")
    title = models.CharField(max_length=255)
    document_kind = models.CharField(max_length=32, choices=DocumentKind.choices)
    type_code_reference = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Optional owner-configured type catalogue code (APR-068).",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_documents_owned",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_documents_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quality document"
        verbose_name_plural = "Quality documents"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="quality_document_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "document_kind"]),
        ]
        default_permissions = ()
        permissions = [
            ("view_effectivedocument", "Can view effective quality documents"),
            ("edit_qualitydocument", "Can create/edit draft quality documents"),
            ("approve_qualitydocument", "Can review/approve quality document versions"),
            ("publish_qualitydocument", "Can make effective / retire document versions"),
            ("acknowledge_qualitydocument", "Can acknowledge a document version (not training)"),
            ("link_qualitydocumentversion", "Can link quality records to a document version"),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.document_kind})"

    def clean(self) -> None:
        super().clean()
        if not (self.code or "").strip():
            raise ValidationError({"code": "Document code is required."})
        self.code = (self.code or "").strip()
        if not (self.title or "").strip():
            raise ValidationError({"title": "Document title is required."})
        self.title = (self.title or "").strip()
        if self.document_kind not in DocumentKind.values:
            raise ValidationError({"document_kind": "Unknown architectural document kind."})


class QualityDocumentVersion(models.Model):
    """Immutable after APPROVED/EFFECTIVE/RETIRED. File via Phase 11 evidence id."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(QualityDocument, on_delete=models.PROTECT, related_name="versions")
    revision = models.CharField(max_length=32)
    status = models.CharField(
        max_length=16,
        choices=DocumentVersionStatus.choices,
        default=DocumentVersionStatus.DRAFT,
    )
    title_snapshot = models.CharField(max_length=255, blank=True, default="")
    approval_reference = models.CharField(max_length=255, blank=True, default="")
    evidence_attachment_id = models.UUIDField(null=True, blank=True)
    effective_from = models.DateTimeField(null=True, blank=True)
    effective_to = models.DateTimeField(null=True, blank=True)
    change_summary = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_document_versions_created",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_document_versions_approved",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_document_versions_published",
    )
    retired_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_document_versions_retired",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    retired_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("document__code", "-created_at")
        constraints = [
            models.UniqueConstraint(
                Lower("revision"),
                "document",
                name="quality_document_version_rev_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["document", "status"]),
            models.Index(fields=["status", "effective_from"]),
        ]
        default_permissions = ()
        verbose_name = "Quality document version"
        verbose_name_plural = "Quality document versions"

    def __str__(self) -> str:
        return f"{self.document_id}/{self.revision}/{self.status}"

    @property
    def is_content_immutable(self) -> bool:
        return self.status in IMMUTABLE_VERSION_STATUSES

    def clean(self) -> None:
        super().clean()
        if not (self.revision or "").strip():
            raise ValidationError({"revision": "Revision is required."})
        self.revision = (self.revision or "").strip()


class QualityDocumentEvent(models.Model):
    """Append-only document lifecycle history."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(QualityDocument, on_delete=models.PROTECT, related_name="events")
    version = models.ForeignKey(
        QualityDocumentVersion,
        on_delete=models.PROTECT,
        related_name="events",
        null=True,
        blank=True,
    )
    event_type = models.CharField(max_length=64)
    summary = models.CharField(max_length=512)
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_document_events",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        default_permissions = ()
        indexes = [models.Index(fields=["document", "created_at"])]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"


class QualityDocumentAcknowledgement(models.Model):
    """
    Optional read/acknowledged record.

    Explicitly not competency training (Phase 05E remains the training module).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(
        QualityDocumentVersion,
        on_delete=models.PROTECT,
        related_name="acknowledgements",
    )
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_document_acknowledgements",
    )
    acknowledged_at = models.DateTimeField()
    is_not_competency_training = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["version", "acknowledged_by"],
                name="quality_document_ack_version_user_uniq",
            ),
        ]
        default_permissions = ()

    def __str__(self) -> str:
        return f"ack:{self.version_id}:{self.acknowledged_by_id}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.is_not_competency_training = True
        super().save(*args, **kwargs)


class QualityRecordDocumentLink(models.Model):
    """Historical link from a quality record to an exact document version."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="quality_record_document_links",
    )
    document_version = models.ForeignKey(
        QualityDocumentVersion,
        on_delete=models.PROTECT,
        related_name="record_links",
    )
    linked_kind = models.CharField(max_length=64)
    linked_object_id = models.UUIDField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_record_document_links_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "linked_kind", "linked_object_id", "document_version"],
                name="quality_record_doc_link_uniq",
            ),
        ]
        default_permissions = ()
        indexes = [
            models.Index(fields=["organization", "linked_kind", "linked_object_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.linked_kind}:{self.linked_object_id}->{self.document_version_id}"
