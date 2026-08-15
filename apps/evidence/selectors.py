"""Permission-aware evidence selectors."""

from __future__ import annotations

import uuid

from django.core.exceptions import PermissionDenied
from django.db.models import QuerySet

from apps.access_control.services import organization_ids_with_permission
from apps.accounts.models import User
from apps.evidence.linking import (
    UPLOAD_EVIDENCE,
    VIEW_EVIDENCE,
    assert_can_view_target,
    resolve_linked_target,
)
from apps.evidence.models import EvidenceAttachment, EvidenceLifecycleStatus


def actor_can_access_evidence_module(actor: User | None) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return bool(
        organization_ids_with_permission(actor, VIEW_EVIDENCE)
        or organization_ids_with_permission(actor, UPLOAD_EVIDENCE)
    )


def list_evidence_for_link(
    actor: User | None,
    *,
    linked_kind: str,
    linked_object_id: uuid.UUID,
    include_retired: bool = False,
) -> QuerySet[EvidenceAttachment]:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return EvidenceAttachment.objects.none()
    try:
        target = resolve_linked_target(kind=linked_kind, object_id=linked_object_id)
        assert_can_view_target(actor=actor, target=target)
    except (PermissionDenied, Exception):
        return EvidenceAttachment.objects.none()

    qs = EvidenceAttachment.objects.filter(
        organization_id=target.organization_id,
        linked_kind=linked_kind,
        linked_object_id=linked_object_id,
    ).select_related("uploaded_by")
    if not include_retired:
        qs = qs.filter(lifecycle_status=EvidenceLifecycleStatus.ACTIVE)
    return qs.order_by("-uploaded_at")


def get_evidence_attachment(
    actor: User | None, attachment_id: uuid.UUID
) -> EvidenceAttachment | None:
    attachment = (
        EvidenceAttachment.objects.select_related("organization", "uploaded_by")
        .filter(pk=attachment_id)
        .first()
    )
    if attachment is None:
        return None
    if actor is None:
        return None
    target = resolve_linked_target(
        kind=attachment.linked_kind,
        object_id=attachment.linked_object_id,
    )
    assert_can_view_target(actor=actor, target=target)
    return attachment
