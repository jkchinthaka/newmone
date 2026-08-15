"""Quality change control selectors — Phase 44."""

from __future__ import annotations

import uuid

from django.core.exceptions import PermissionDenied
from django.db.models import QuerySet

from apps.access_control.services import user_has_permission
from apps.accounts.models import User
from apps.change_control.models import (
    QualityChangeAffectedLink,
    QualityChangeEvent,
    QualityChangeImplementationLink,
    QualityChangeRequest,
)
from apps.change_control.services import PERM_VIEW, _scope


def list_quality_changes(
    *,
    actor: User,
    organization_id: uuid.UUID,
    status: str | None = None,
) -> QuerySet[QualityChangeRequest]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    qs = QualityChangeRequest.objects.filter(organization_id=organization_id)
    if status:
        qs = qs.filter(status=status)
    return qs.order_by("-requested_at")


def get_quality_change_for_org(
    *,
    actor: User,
    organization_id: uuid.UUID,
    change_id: uuid.UUID,
) -> QualityChangeRequest:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return QualityChangeRequest.objects.get(pk=change_id, organization_id=organization_id)


def list_affected_links(*, change: QualityChangeRequest) -> QuerySet[QualityChangeAffectedLink]:
    return change.affected_links.all().order_by("created_at")


def list_implementation_links(
    *, change: QualityChangeRequest
) -> QuerySet[QualityChangeImplementationLink]:
    return change.implementation_links.all().order_by("recorded_at")


def list_change_events(*, change: QualityChangeRequest) -> QuerySet[QualityChangeEvent]:
    return change.events.all().order_by("created_at")
