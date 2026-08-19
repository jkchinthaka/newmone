"""Quality document control services — Phase 43 (ADR-054)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.core.persistence import atomic_fn, lock_queryset
from apps.document_control.models import (
    IMMUTABLE_VERSION_STATUSES,
    VERSION_TRANSITIONS,
    DocumentKind,
    DocumentVersionStatus,
    QualityDocument,
    QualityDocumentAcknowledgement,
    QualityDocumentEvent,
    QualityDocumentVersion,
    QualityRecordDocumentLink,
)
from apps.security_audit.services import record_event

PERM_VIEW_EFFECTIVE = "document_control.view_effectivedocument"
PERM_EDIT = "document_control.edit_qualitydocument"
PERM_APPROVE = "document_control.approve_qualitydocument"
PERM_PUBLISH = "document_control.publish_qualitydocument"
PERM_ACK = "document_control.acknowledge_qualitydocument"
PERM_LINK = "document_control.link_qualitydocumentversion"


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User, permission: str, organization_id: uuid.UUID) -> None:
    if not user_has_permission(actor, permission, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")


def _append_event(
    *,
    document: QualityDocument,
    version: QualityDocumentVersion | None,
    event_type: str,
    actor: User,
    summary: str,
    payload: dict[str, Any] | None = None,
) -> QualityDocumentEvent:
    return QualityDocumentEvent.objects.create(
        document=document,
        version=version,
        event_type=event_type,
        summary=summary,
        payload=payload or {},
        actor=actor,
    )


def _assert_editable_version(version: QualityDocumentVersion) -> None:
    if version.status in IMMUTABLE_VERSION_STATUSES:
        raise ValidationError(
            {
                "status": (
                    "Approved, effective, or retired document versions cannot be "
                    "silently edited. Create a new revision."
                )
            }
        )


def _transition(version: QualityDocumentVersion, target: str) -> None:
    allowed = VERSION_TRANSITIONS.get(version.status, frozenset())
    if target not in allowed:
        raise ValidationError({"status": f"Cannot transition from {version.status} to {target}."})


@atomic_fn
def create_quality_document(
    *,
    actor: User,
    organization_id: uuid.UUID,
    code: str,
    title: str,
    document_kind: str,
    type_code_reference: str = "",
    owner: User | None = None,
    first_revision: str = "01",
    change_summary: str = "",
) -> tuple[QualityDocument, QualityDocumentVersion]:
    _require(actor, PERM_EDIT, organization_id)
    if document_kind not in DocumentKind.values:
        raise ValidationError({"document_kind": "Unknown architectural document kind."})
    code = (code or "").strip()
    title = (title or "").strip()
    if not code:
        raise ValidationError({"code": "Document code is required."})
    if not title:
        raise ValidationError({"title": "Document title is required."})
    if QualityDocument.objects.filter(organization_id=organization_id, code__iexact=code).exists():
        raise ValidationError({"code": "A document with this code already exists."})

    document = QualityDocument(
        organization_id=organization_id,
        code=code,
        title=title,
        document_kind=document_kind,
        type_code_reference=(type_code_reference or "").strip(),
        owner=owner,
        created_by=actor,
    )
    document.full_clean()
    document.save()
    version = QualityDocumentVersion(
        document=document,
        revision=(first_revision or "01").strip(),
        status=DocumentVersionStatus.DRAFT,
        title_snapshot=title,
        change_summary=change_summary,
        created_by=actor,
    )
    version.full_clean()
    version.save()
    _append_event(
        document=document,
        version=version,
        event_type="DOCUMENT_CREATED",
        actor=actor,
        summary="Quality document created with draft revision.",
        payload={"code": code, "revision": version.revision},
    )
    record_event(
        event_type="DOCUMENT_CREATED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "document_id": str(document.id),
            "version_id": str(version.id),
            "code": code,
        },
    )
    return document, version


@atomic_fn
def create_document_version(
    *,
    actor: User,
    document_id: uuid.UUID,
    revision: str,
    change_summary: str = "",
) -> QualityDocumentVersion:
    document = QualityDocument.objects.select_related("organization").get(pk=document_id)
    _require(actor, PERM_EDIT, document.organization_id)
    revision = (revision or "").strip()
    if not revision:
        raise ValidationError({"revision": "Revision is required."})
    if QualityDocumentVersion.objects.filter(document=document, revision__iexact=revision).exists():
        raise ValidationError({"revision": "This revision already exists."})
    version = QualityDocumentVersion(
        document=document,
        revision=revision,
        status=DocumentVersionStatus.DRAFT,
        title_snapshot=document.title,
        change_summary=change_summary,
        created_by=actor,
    )
    version.full_clean()
    version.save()
    _append_event(
        document=document,
        version=version,
        event_type="DOCUMENT_VERSION_CREATED",
        actor=actor,
        summary=f"Draft revision {revision} created.",
        payload={"revision": revision},
    )
    record_event(
        event_type="DOCUMENT_VERSION_CREATED",
        actor=actor,
        metadata={
            "organization_id": str(document.organization_id),
            "document_id": str(document.id),
            "version_id": str(version.id),
            "revision": revision,
        },
    )
    return version


@atomic_fn
def update_draft_version(
    *,
    actor: User,
    version_id: uuid.UUID,
    title: str | None = None,
    change_summary: str | None = None,
    approval_reference: str | None = None,
    evidence_attachment_id: uuid.UUID | None = None,
    clear_evidence: bool = False,
) -> QualityDocumentVersion:
    version = QualityDocumentVersion.objects.select_related("document").get(pk=version_id)
    _require(actor, PERM_EDIT, version.document.organization_id)
    _assert_editable_version(version)
    if title is not None:
        title = title.strip()
        if not title:
            raise ValidationError({"title": "Document title is required."})
        version.document.title = title
        version.document.save(update_fields=["title", "updated_at"])
        version.title_snapshot = title
    if change_summary is not None:
        version.change_summary = change_summary
    if approval_reference is not None:
        version.approval_reference = approval_reference.strip()
    if clear_evidence:
        version.evidence_attachment_id = None
    elif evidence_attachment_id is not None:
        version.evidence_attachment_id = evidence_attachment_id
    version.save()
    _append_event(
        document=version.document,
        version=version,
        event_type="DOCUMENT_VERSION_UPDATED",
        actor=actor,
        summary="Draft version updated.",
        payload={"revision": version.revision},
    )
    record_event(
        event_type="DOCUMENT_VERSION_UPDATED",
        actor=actor,
        metadata={
            "organization_id": str(version.document.organization_id),
            "version_id": str(version.id),
        },
    )
    return version


@atomic_fn
def submit_version_for_review(*, actor: User, version_id: uuid.UUID) -> QualityDocumentVersion:
    version = QualityDocumentVersion.objects.select_related("document").get(pk=version_id)
    _require(actor, PERM_EDIT, version.document.organization_id)
    _transition(version, DocumentVersionStatus.UNDER_REVIEW)
    version.status = DocumentVersionStatus.UNDER_REVIEW
    version.save(update_fields=["status", "updated_at"])
    _append_event(
        document=version.document,
        version=version,
        event_type="DOCUMENT_SUBMITTED_FOR_REVIEW",
        actor=actor,
        summary="Version submitted for review.",
        payload={"revision": version.revision},
    )
    record_event(
        event_type="DOCUMENT_SUBMITTED_FOR_REVIEW",
        actor=actor,
        metadata={
            "organization_id": str(version.document.organization_id),
            "version_id": str(version.id),
        },
    )
    return version


@atomic_fn
def return_version_to_draft(*, actor: User, version_id: uuid.UUID) -> QualityDocumentVersion:
    version = QualityDocumentVersion.objects.select_related("document").get(pk=version_id)
    _require(actor, PERM_APPROVE, version.document.organization_id)
    _transition(version, DocumentVersionStatus.DRAFT)
    version.status = DocumentVersionStatus.DRAFT
    version.save(update_fields=["status", "updated_at"])
    _append_event(
        document=version.document,
        version=version,
        event_type="DOCUMENT_RETURNED_TO_DRAFT",
        actor=actor,
        summary="Version returned to draft.",
        payload={"revision": version.revision},
    )
    record_event(
        event_type="DOCUMENT_RETURNED_TO_DRAFT",
        actor=actor,
        metadata={
            "organization_id": str(version.document.organization_id),
            "version_id": str(version.id),
        },
    )
    return version


@atomic_fn
def approve_document_version(
    *,
    actor: User,
    version_id: uuid.UUID,
    approval_reference: str,
) -> QualityDocumentVersion:
    version = QualityDocumentVersion.objects.select_related("document").get(pk=version_id)
    _require(actor, PERM_APPROVE, version.document.organization_id)
    if actor.pk == version.created_by_id:
        raise PermissionDenied("Approver cannot be the version author.")
    ref = (approval_reference or "").strip()
    if not ref:
        raise ValidationError({"approval_reference": "Approval reference is required."})
    _transition(version, DocumentVersionStatus.APPROVED)
    now = timezone.now()
    version.status = DocumentVersionStatus.APPROVED
    version.approval_reference = ref
    version.approved_by = actor
    version.approved_at = now
    version.save(
        update_fields=[
            "status",
            "approval_reference",
            "approved_by",
            "approved_at",
            "updated_at",
        ]
    )
    _append_event(
        document=version.document,
        version=version,
        event_type="DOCUMENT_APPROVED",
        actor=actor,
        summary="Version approved.",
        payload={"revision": version.revision, "approval_reference": ref},
    )
    record_event(
        event_type="DOCUMENT_APPROVED",
        actor=actor,
        metadata={
            "organization_id": str(version.document.organization_id),
            "version_id": str(version.id),
            "approval_reference": ref,
        },
    )
    return version


@atomic_fn
def make_version_effective(
    *,
    actor: User,
    version_id: uuid.UUID,
    effective_from: datetime | None = None,
) -> QualityDocumentVersion:
    version = QualityDocumentVersion.objects.select_related("document").get(pk=version_id)
    _require(actor, PERM_PUBLISH, version.document.organization_id)
    _transition(version, DocumentVersionStatus.EFFECTIVE)
    now = timezone.now()
    start = effective_from or now
    previous = lock_queryset(
        QualityDocumentVersion.objects.filter(
            document=version.document,
            status=DocumentVersionStatus.EFFECTIVE,
        ).exclude(pk=version.pk)
    )
    for prior in previous:
        prior.status = DocumentVersionStatus.RETIRED
        prior.effective_to = start
        prior.retired_by = actor
        prior.retired_at = now
        prior.save(
            update_fields=[
                "status",
                "effective_to",
                "retired_by",
                "retired_at",
                "updated_at",
            ]
        )
        _append_event(
            document=version.document,
            version=prior,
            event_type="DOCUMENT_SUPERSEDED",
            actor=actor,
            summary="Previous effective version retired by successor.",
            payload={"revision": prior.revision, "successor": version.revision},
        )
        record_event(
            event_type="DOCUMENT_RETIRED",
            actor=actor,
            metadata={
                "organization_id": str(version.document.organization_id),
                "version_id": str(prior.id),
                "reason": "superseded",
            },
        )
    version.status = DocumentVersionStatus.EFFECTIVE
    version.effective_from = start
    version.published_by = actor
    version.published_at = now
    version.save(
        update_fields=[
            "status",
            "effective_from",
            "published_by",
            "published_at",
            "updated_at",
        ]
    )
    _append_event(
        document=version.document,
        version=version,
        event_type="DOCUMENT_MADE_EFFECTIVE",
        actor=actor,
        summary="Version made effective.",
        payload={"revision": version.revision},
    )
    record_event(
        event_type="DOCUMENT_MADE_EFFECTIVE",
        actor=actor,
        metadata={
            "organization_id": str(version.document.organization_id),
            "version_id": str(version.id),
        },
    )
    return version


@atomic_fn
def retire_document_version(*, actor: User, version_id: uuid.UUID) -> QualityDocumentVersion:
    version = QualityDocumentVersion.objects.select_related("document").get(pk=version_id)
    _require(actor, PERM_PUBLISH, version.document.organization_id)
    _transition(version, DocumentVersionStatus.RETIRED)
    now = timezone.now()
    version.status = DocumentVersionStatus.RETIRED
    version.effective_to = now
    version.retired_by = actor
    version.retired_at = now
    version.save(
        update_fields=[
            "status",
            "effective_to",
            "retired_by",
            "retired_at",
            "updated_at",
        ]
    )
    _append_event(
        document=version.document,
        version=version,
        event_type="DOCUMENT_RETIRED",
        actor=actor,
        summary="Version retired.",
        payload={"revision": version.revision},
    )
    record_event(
        event_type="DOCUMENT_RETIRED",
        actor=actor,
        metadata={
            "organization_id": str(version.document.organization_id),
            "version_id": str(version.id),
        },
    )
    return version


def assert_can_access_document_file(*, actor: User, version: QualityDocumentVersion) -> None:
    org_id = version.document.organization_id
    if version.status == DocumentVersionStatus.EFFECTIVE:
        if not (
            user_has_permission(actor, PERM_VIEW_EFFECTIVE, scope=_scope(org_id))
            or user_has_permission(actor, PERM_EDIT, scope=_scope(org_id))
            or user_has_permission(actor, PERM_APPROVE, scope=_scope(org_id))
            or user_has_permission(actor, PERM_PUBLISH, scope=_scope(org_id))
        ):
            raise PermissionDenied("Permission denied.")
        return
    if not (
        user_has_permission(actor, PERM_EDIT, scope=_scope(org_id))
        or user_has_permission(actor, PERM_APPROVE, scope=_scope(org_id))
        or user_has_permission(actor, PERM_PUBLISH, scope=_scope(org_id))
    ):
        raise PermissionDenied("Operators may access only effective document files.")


@atomic_fn
def acknowledge_document_version(
    *,
    actor: User,
    version_id: uuid.UUID,
    notes: str = "",
) -> QualityDocumentAcknowledgement:
    version = QualityDocumentVersion.objects.select_related("document").get(pk=version_id)
    _require(actor, PERM_ACK, version.document.organization_id)
    if version.status != DocumentVersionStatus.EFFECTIVE:
        raise ValidationError({"version": "Only effective document versions can be acknowledged."})
    existing = QualityDocumentAcknowledgement.objects.filter(
        version=version, acknowledged_by=actor
    ).first()
    if existing is not None:
        return existing
    ack = QualityDocumentAcknowledgement.objects.create(
        version=version,
        acknowledged_by=actor,
        acknowledged_at=timezone.now(),
        is_not_competency_training=True,
        notes=notes,
    )
    _append_event(
        document=version.document,
        version=version,
        event_type="DOCUMENT_ACKNOWLEDGED",
        actor=actor,
        summary="Document version acknowledged (not competency training).",
        payload={"revision": version.revision, "is_not_competency_training": True},
    )
    record_event(
        event_type="DOCUMENT_ACKNOWLEDGED",
        actor=actor,
        metadata={
            "organization_id": str(version.document.organization_id),
            "version_id": str(version.id),
            "is_not_competency_training": True,
        },
    )
    return ack


@atomic_fn
def link_quality_record_to_document_version(
    *,
    actor: User,
    organization_id: uuid.UUID,
    document_version_id: uuid.UUID,
    linked_kind: str,
    linked_object_id: uuid.UUID,
) -> QualityRecordDocumentLink:
    _require(actor, PERM_LINK, organization_id)
    version = QualityDocumentVersion.objects.select_related("document").get(pk=document_version_id)
    if version.document.organization_id != organization_id:
        raise PermissionDenied("Permission denied.")
    if version.status not in {
        DocumentVersionStatus.APPROVED,
        DocumentVersionStatus.EFFECTIVE,
        DocumentVersionStatus.RETIRED,
    }:
        raise ValidationError(
            {
                "document_version": (
                    "Quality records may only reference approved, effective, or retired versions."
                )
            }
        )
    kind = (linked_kind or "").strip()
    if not kind:
        raise ValidationError({"linked_kind": "Linked kind is required."})
    existing = QualityRecordDocumentLink.objects.filter(
        organization_id=organization_id,
        linked_kind=kind,
        linked_object_id=linked_object_id,
        document_version=version,
    ).first()
    if existing is not None:
        return existing
    link = QualityRecordDocumentLink.objects.create(
        organization_id=organization_id,
        document_version=version,
        linked_kind=kind,
        linked_object_id=linked_object_id,
        created_by=actor,
    )
    _append_event(
        document=version.document,
        version=version,
        event_type="DOCUMENT_VERSION_LINKED",
        actor=actor,
        summary="Quality record linked to exact document version.",
        payload={
            "linked_kind": kind,
            "linked_object_id": str(linked_object_id),
            "revision": version.revision,
        },
    )
    record_event(
        event_type="DOCUMENT_VERSION_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "version_id": str(version.id),
            "linked_kind": kind,
            "linked_object_id": str(linked_object_id),
        },
    )
    return link
