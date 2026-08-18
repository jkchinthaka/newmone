"""Evidence upload / authorized download / soft-retire services."""

from __future__ import annotations

import uuid
from typing import Any, BinaryIO

from django.core.exceptions import PermissionDenied, ValidationError
from django.core.files.uploadedfile import UploadedFile
from apps.core.persistence import atomic_fn, locked_get
from django.http import FileResponse
from django.utils import timezone

from apps.accounts.models import User
from apps.evidence.filenames import content_disposition_attachment
from apps.evidence.hashing import hash_bytes, hash_fileobj
from apps.evidence.linking import (
    assert_can_retire,
    assert_can_upload_to_target,
    assert_can_view_target,
    resolve_linked_target,
)
from apps.evidence.models import (
    EvidenceAttachment,
    EvidenceLifecycleStatus,
    EvidenceLinkedKind,
)
from apps.evidence.policies import validate_upload_candidate
from apps.evidence.scanning import get_malware_scanner
from apps.evidence.storage import build_randomized_storage_key, get_evidence_store
from apps.security_audit.services import record_event


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _audit_meta(attachment: EvidenceAttachment) -> dict[str, Any]:
    return {
        "evidence_attachment_id": str(attachment.id),
        "organization_id": str(attachment.organization_id),
        "linked_kind": attachment.linked_kind,
        "linked_object_id": str(attachment.linked_object_id),
        "content_type": attachment.content_type,
        "size_bytes": attachment.size_bytes,
        "content_sha256": attachment.content_sha256,
        "storage_key_prefix": attachment.storage_key.split("/")[0][:32],
        "malware_scan_status": attachment.malware_scan_status,
        "original_filename_length": len(attachment.original_filename or ""),
    }


def _read_upload_bytes(
    *,
    uploaded_file: UploadedFile | None,
    file_bytes: bytes | None,
) -> tuple[bytes, str, str]:
    if file_bytes is not None:
        return file_bytes, "", "application/octet-stream"
    if uploaded_file is None:
        raise ValidationError({"file": "No file provided."})
    uploaded_file.seek(0)
    data = uploaded_file.read()
    name = getattr(uploaded_file, "name", "") or ""
    ctype = getattr(uploaded_file, "content_type", "") or "application/octet-stream"
    return data, name, ctype


@atomic_fn
def upload_evidence_attachment(
    *,
    actor: User | None,
    linked_kind: str,
    linked_object_id: uuid.UUID,
    uploaded_file: UploadedFile | None = None,
    file_name: str | None = None,
    content_type: str | None = None,
    file_bytes: bytes | None = None,
    caption: str | None = None,
) -> EvidenceAttachment:
    """
    Store a private evidence blob and metadata.

    Accepts either Django UploadedFile or explicit file_bytes (tests/services).
    Does not force evidence for checklist items — callers choose when to attach.
    """
    user = _require_authenticated_actor(actor)
    target = resolve_linked_target(kind=linked_kind, object_id=linked_object_id)
    assert_can_upload_to_target(actor=user, target=target)

    if linked_kind == EvidenceLinkedKind.CHECKLIST_RESPONSE and target.linkage_immutable:
        raise ValidationError(
            {
                "linked_object_id": (
                    "Cannot attach new evidence to an immutable checklist response. "
                    "Attach to submission / review objects instead."
                )
            }
        )

    data, stream_name, stream_ctype = _read_upload_bytes(
        uploaded_file=uploaded_file, file_bytes=file_bytes
    )
    raw_name = file_name if file_name is not None else stream_name
    declared_type = content_type if content_type is not None else stream_ctype

    validated = validate_upload_candidate(
        original_filename=raw_name,
        content_type=declared_type,
        size_bytes=len(data),
    )
    digest = hash_bytes(data)

    storage_key = build_randomized_storage_key(
        organization_id=target.organization_id,
        extension=validated.extension,
    )
    store = get_evidence_store()
    store.save_bytes(relative_key=storage_key, data=data)

    scanner = get_malware_scanner()
    scan = scanner.scan(storage_key=storage_key, content_sha256=digest)

    linkage_immutable = bool(target.linkage_immutable)
    if linked_kind in {
        EvidenceLinkedKind.CHECKLIST_SUBMISSION,
        EvidenceLinkedKind.SUPERVISOR_REVIEW,
        EvidenceLinkedKind.QA_REVIEW,
        EvidenceLinkedKind.NONCONFORMANCE,
        EvidenceLinkedKind.CAPA,
    }:
        linkage_immutable = True

    attachment = EvidenceAttachment(
        organization_id=target.organization_id,
        linked_kind=linked_kind,
        linked_object_id=linked_object_id,
        original_filename=validated.original_filename,
        storage_key=storage_key,
        content_type=validated.content_type,
        size_bytes=validated.size_bytes,
        content_sha256=digest,
        caption=(caption or "").strip()[:255],
        uploaded_by=user,
        linkage_immutable=linkage_immutable,
        malware_scan_status=scan.status,
        malware_scan_provider=scan.provider,
        malware_scan_detail=scan.detail,
        malware_scanned_at=None,
    )
    attachment.full_clean()
    attachment.save()

    record_event(
        event_type="EVIDENCE_UPLOADED",
        actor=user,
        metadata=_audit_meta(attachment),
    )
    return attachment


def authorize_evidence_download(
    *,
    actor: User | None,
    attachment_id: uuid.UUID,
) -> EvidenceAttachment:
    """Authorize download; raises PermissionDenied / ValidationError."""
    user = _require_authenticated_actor(actor)
    attachment = (
        EvidenceAttachment.objects.select_related("organization", "uploaded_by")
        .filter(pk=attachment_id)
        .first()
    )
    if attachment is None:
        raise ValidationError({"attachment": "Evidence attachment not found."})

    target = resolve_linked_target(
        kind=attachment.linked_kind,
        object_id=attachment.linked_object_id,
    )
    if target.organization_id != attachment.organization_id:
        raise PermissionDenied("Permission denied.")
    assert_can_view_target(actor=user, target=target)

    if attachment.lifecycle_status == EvidenceLifecycleStatus.RETIRED:
        raise ValidationError({"attachment": "Evidence attachment has been soft-retired."})

    return attachment


def open_evidence_file(attachment: EvidenceAttachment) -> BinaryIO:
    store = get_evidence_store()
    if not store.exists(attachment.storage_key):
        raise ValidationError({"attachment": "Evidence file is missing from private storage."})
    return store.open_read(attachment.storage_key)


def open_evidence_download(
    *,
    actor: User | None,
    attachment_id: uuid.UUID,
) -> tuple[EvidenceAttachment, BinaryIO]:
    attachment = authorize_evidence_download(actor=actor, attachment_id=attachment_id)
    store = get_evidence_store()
    if not store.exists(attachment.storage_key):
        record_event(
            event_type="EVIDENCE_ACCESS_DENIED",
            actor=actor,
            metadata={**_audit_meta(attachment), "reason": "missing_blob"},
        )
        raise ValidationError({"attachment": "Evidence file is missing from private storage."})

    handle = store.open_read(attachment.storage_key)
    record_event(
        event_type="EVIDENCE_DOWNLOADED",
        actor=actor,
        metadata=_audit_meta(attachment),
    )
    return attachment, handle


def build_evidence_file_response(
    *,
    actor: User | None,
    attachment_id: uuid.UUID,
) -> FileResponse:
    from io import BytesIO

    attachment, handle = open_evidence_download(actor=actor, attachment_id=attachment_id)
    try:
        payload = handle.read()
    finally:
        handle.close()
    response = FileResponse(
        BytesIO(payload),
        as_attachment=True,
        filename=attachment.original_filename,
        content_type=attachment.content_type,
    )
    response["Content-Disposition"] = content_disposition_attachment(attachment.original_filename)
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Type"] = attachment.content_type
    response["Cache-Control"] = "private, no-store"
    return response


@atomic_fn
def retire_evidence_attachment(
    *,
    actor: User | None,
    attachment_id: uuid.UUID,
    reason: str,
) -> EvidenceAttachment:
    """Soft-retire evidence — no casual hard-delete of metadata or blob."""
    user = _require_authenticated_actor(actor)
    reason_clean = (reason or "").strip()
    if not reason_clean:
        raise ValidationError({"reason": "A retirement reason is required."})

    attachment = locked_get(EvidenceAttachment, pk=attachment_id)
    if attachment is None:
        raise ValidationError({"attachment": "Evidence attachment not found."})

    target = resolve_linked_target(
        kind=attachment.linked_kind,
        object_id=attachment.linked_object_id,
    )
    assert_can_retire(actor=user, target=target)

    if attachment.lifecycle_status == EvidenceLifecycleStatus.RETIRED:
        return attachment

    attachment.lifecycle_status = EvidenceLifecycleStatus.RETIRED
    attachment.retired_at = timezone.now()
    attachment.retired_by = user
    attachment.retirement_reason = reason_clean[:255]
    attachment.full_clean()
    attachment.save(
        update_fields=[
            "lifecycle_status",
            "retired_at",
            "retired_by",
            "retirement_reason",
        ]
    )
    record_event(
        event_type="EVIDENCE_RETIRED",
        actor=user,
        metadata={
            **_audit_meta(attachment),
            "retirement_reason_length": len(reason_clean),
            "linkage_immutable": attachment.linkage_immutable,
        },
    )
    return attachment


# Alias kept for callers that prefer soft_retire_* naming.
soft_retire_evidence_attachment = retire_evidence_attachment


@atomic_fn
def mark_draft_response_evidence_immutable_for_record(*, record_id: uuid.UUID) -> int:
    """After ChecklistRecord submit — draft response attachments become immutable."""
    from apps.recording.models import ChecklistResponse

    response_ids = list(
        ChecklistResponse.objects.filter(checklist_record_id=record_id).values_list("id", flat=True)
    )
    if not response_ids:
        return 0
    return int(
        EvidenceAttachment.objects.filter(
            linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
            linked_object_id__in=response_ids,
            linkage_immutable=False,
            lifecycle_status=EvidenceLifecycleStatus.ACTIVE,
        ).update(linkage_immutable=True)
    )


def verify_attachment_hash(attachment: EvidenceAttachment) -> bool:
    return verify_attachment_integrity(attachment)


def verify_attachment_integrity(attachment: EvidenceAttachment) -> bool:
    """Re-hash stored bytes and compare to recorded SHA-256."""
    store = get_evidence_store()
    if not store.exists(attachment.storage_key):
        return False
    with store.open_read(attachment.storage_key) as handle:
        digest = hash_fileobj(handle)
    return digest == attachment.content_sha256
