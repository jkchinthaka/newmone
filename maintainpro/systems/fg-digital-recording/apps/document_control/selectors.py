"""Quality document control selectors — Phase 43."""

from __future__ import annotations

import uuid
from datetime import datetime

from django.core.exceptions import PermissionDenied
from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.document_control.models import (
    DocumentVersionStatus,
    QualityDocument,
    QualityDocumentVersion,
    QualityRecordDocumentLink,
)
from apps.document_control.services import (
    PERM_APPROVE,
    PERM_EDIT,
    PERM_PUBLISH,
    PERM_VIEW_EFFECTIVE,
    _scope,
)


def _can_view_controlled(actor: User, organization_id: uuid.UUID) -> bool:
    scope = _scope(organization_id)
    return (
        user_has_permission(actor, PERM_EDIT, scope=scope)
        or user_has_permission(actor, PERM_APPROVE, scope=scope)
        or user_has_permission(actor, PERM_PUBLISH, scope=scope)
    )


def list_effective_documents(
    *,
    actor: User,
    organization_id: uuid.UUID,
    as_of: datetime | None = None,
    document_kind: str | None = None,
) -> QuerySet[QualityDocument]:
    if not user_has_permission(
        actor, PERM_VIEW_EFFECTIVE, scope=_scope(organization_id)
    ) and not _can_view_controlled(actor, organization_id):
        raise PermissionDenied("Permission denied.")
    moment = as_of or timezone.now()
    version_qs = QualityDocumentVersion.objects.filter(
        status=DocumentVersionStatus.EFFECTIVE,
        effective_from__lte=moment,
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=moment))
    qs = QualityDocument.objects.filter(
        organization_id=organization_id,
        versions__in=version_qs,
    ).distinct()
    if document_kind:
        qs = qs.filter(document_kind=document_kind)
    return qs.order_by("code")


def get_effective_version(
    *,
    document: QualityDocument,
    as_of: datetime | None = None,
) -> QualityDocumentVersion | None:
    moment = as_of or timezone.now()
    return (
        QualityDocumentVersion.objects.filter(
            document=document,
            status__in={
                DocumentVersionStatus.EFFECTIVE,
                DocumentVersionStatus.RETIRED,
            },
            effective_from__lte=moment,
        )
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=moment))
        .order_by("-effective_from")
        .first()
    )


def list_controlled_versions(
    *,
    actor: User,
    organization_id: uuid.UUID,
    document_id: uuid.UUID | None = None,
) -> QuerySet[QualityDocumentVersion]:
    if not _can_view_controlled(actor, organization_id):
        raise PermissionDenied("Permission denied.")
    qs = QualityDocumentVersion.objects.filter(
        document__organization_id=organization_id
    ).select_related("document")
    if document_id is not None:
        qs = qs.filter(document_id=document_id)
    return qs.order_by("document__code", "-created_at")


def list_record_document_links(
    *,
    organization_id: uuid.UUID,
    linked_kind: str,
    linked_object_id: uuid.UUID,
) -> QuerySet[QualityRecordDocumentLink]:
    return QualityRecordDocumentLink.objects.filter(
        organization_id=organization_id,
        linked_kind=linked_kind,
        linked_object_id=linked_object_id,
    ).select_related("document_version", "document_version__document")


def operator_may_view_version(*, actor: User, version: QualityDocumentVersion) -> bool:
    org_id = version.document.organization_id
    if _can_view_controlled(actor, org_id):
        return True
    if version.status != DocumentVersionStatus.EFFECTIVE:
        return False
    return user_has_permission(actor, PERM_VIEW_EFFECTIVE, scope=Scope(organization_id=org_id))
