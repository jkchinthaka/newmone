"""Selectors for workflow notifications."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.accounts.models import User
from apps.notifications.models import Notification, OrganizationNotificationPolicy


def notifications_for_recipient(
    *, recipient: User, unread_only: bool = False
) -> QuerySet[Notification]:
    qs = Notification.objects.filter(recipient=recipient).select_related("organization")
    if unread_only:
        qs = qs.filter(read_at__isnull=True)
    return qs.order_by("-created_at")


def notification_policy_for_organization(
    *, organization_id: uuid.UUID
) -> OrganizationNotificationPolicy | None:
    return OrganizationNotificationPolicy.objects.filter(organization_id=organization_id).first()
