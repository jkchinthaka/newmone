"""Workflow notification services — Phase 15.

In-app first. Email optional when SMTP + policy enable it. No SMS.
Events disabled by default. Idempotent create + async email delivery.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from typing import Any

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from apps.core.persistence import atomic_fn, locked_get
from django.utils import timezone
from django.utils.html import strip_tags

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationDeliveryAttempt,
    NotificationDeliveryStatus,
    NotificationEventType,
    OrganizationNotificationPolicy,
)
from apps.notifications.privacy import (
    assert_safe_metadata,
    escape_template_text,
    validate_safe_notification_text,
)
from apps.organizations.models import Organization
from apps.security_audit.services import record_event

MANAGE_POLICY = "notifications.manage_notificationpolicy"
MANAGE_NOTIFICATIONS = "notifications.manage_notifications"
VIEW_OWN = "notifications.view_own_notifications"


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def smtp_is_configured() -> bool:
    """True when EMAIL_HOST (or usable backend) is present — never reads secrets into logs."""
    host = (getattr(settings, "EMAIL_HOST", "") or "").strip()
    backend = getattr(settings, "EMAIL_BACKEND", "") or ""
    if not host and "console" not in backend and "locmem" not in backend:
        return False
    # Console/locmem count as "configured" for local/test only when policy enables email.
    if host:
        return True
    return "console" in backend or "locmem" in backend


def get_or_create_notification_policy(
    *, organization: Organization, actor: User
) -> OrganizationNotificationPolicy:
    policy = OrganizationNotificationPolicy.objects.filter(organization=organization).first()
    if policy is not None:
        return policy
    return OrganizationNotificationPolicy.objects.create(
        organization=organization,
        enabled_event_types=[],
        email_delivery_enabled=False,
        updated_by=actor,
    )


@atomic_fn
def set_notification_policy(
    *,
    actor: User | None,
    organization: Organization,
    enabled_event_types: Iterable[str] | None = None,
    email_delivery_enabled: bool | None = None,
) -> OrganizationNotificationPolicy:
    """Update org policy. Events remain off unless explicitly listed."""
    user = _require_authenticated_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=Scope(organization_id=organization.id))
    policy = get_or_create_notification_policy(organization=organization, actor=user)
    if enabled_event_types is not None:
        codes = [str(c).strip() for c in enabled_event_types if str(c).strip()]
        policy.enabled_event_types = codes
    if email_delivery_enabled is not None:
        policy.email_delivery_enabled = bool(email_delivery_enabled)
    policy.updated_by = user
    policy.full_clean()
    policy.save()
    record_event(
        event_type="NOTIFICATION_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "enabled_event_types": list(policy.enabled_event_types),
            "email_delivery_enabled": policy.email_delivery_enabled,
        },
    )
    return policy


def event_is_enabled(*, organization: Organization, event_type: str) -> bool:
    policy = OrganizationNotificationPolicy.objects.filter(organization=organization).first()
    if policy is None:
        return False
    return event_type in (policy.enabled_event_types or [])


def _can_dispatch(user: User, organization_id: uuid.UUID) -> bool:
    scope = Scope(organization_id=organization_id)
    return user_has_permission(user, MANAGE_NOTIFICATIONS, scope=scope) or user_has_permission(
        user, MANAGE_POLICY, scope=scope
    )


@atomic_fn
def create_in_app_notification(
    *,
    actor: User | None,
    organization: Organization,
    recipient: User,
    event_type: str,
    title: str,
    safe_message: str,
    dedupe_key: str,
    reference_kind: str = "",
    reference_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
    force: bool = False,
) -> Notification | None:
    """
    Create an in-app notification if the org policy enables the event type.

    Duplicate (recipient + dedupe_key) returns the existing row (idempotent).
    Returns None when the event type is disabled (unless force=True for tests/admin).
    """
    user = _require_authenticated_actor(actor)
    if not _can_dispatch(user, organization.id):
        raise PermissionDenied("Permission denied.")
    if event_type not in NotificationEventType.values:
        raise ValidationError({"event_type": "Unknown notification event type."})
    if not force and not event_is_enabled(organization=organization, event_type=event_type):
        return None
    if not recipient.is_active:
        raise ValidationError({"recipient": "Recipient must be an active user."})

    safe_title = validate_safe_notification_text(strip_tags(title), field="title", max_length=120)
    safe_body = validate_safe_notification_text(
        strip_tags(safe_message), field="safe_message", max_length=280
    )
    assert_safe_metadata(metadata)
    key = (dedupe_key or "").strip()
    if not key:
        raise ValidationError({"dedupe_key": "dedupe_key is required for idempotency."})

    existing = Notification.objects.filter(recipient=recipient, dedupe_key__iexact=key).first()
    if existing is not None:
        return existing

    notification = Notification(
        organization=organization,
        recipient=recipient,
        event_type=event_type,
        title=safe_title,
        safe_message=safe_body,
        reference_kind=(reference_kind or "").strip()[:64],
        reference_id=reference_id,
        dedupe_key=key,
        delivery_status=NotificationDeliveryStatus.DELIVERED,
    )
    try:
        notification.full_clean()
        notification.save()
    except IntegrityError:
        return Notification.objects.filter(recipient=recipient, dedupe_key__iexact=key).get()

    record_event(
        event_type="NOTIFICATION_CREATED",
        actor=user,
        subject_user=recipient,
        metadata={
            "notification_id": str(notification.id),
            "organization_id": str(organization.id),
            "event_type": event_type,
            "dedupe_key": key,
            "reference_kind": notification.reference_kind,
            "reference_id": str(reference_id) if reference_id else "",
        },
    )

    policy = OrganizationNotificationPolicy.objects.filter(organization=organization).first()
    if (
        policy is not None
        and policy.email_delivery_enabled
        and smtp_is_configured()
        and (recipient.email or "").strip()
    ):
        _enqueue_email_delivery(notification=notification)

    return notification


def _enqueue_email_delivery(*, notification: Notification) -> NotificationDeliveryAttempt:
    idem = f"email:{notification.id}"
    attempt, created = NotificationDeliveryAttempt.objects.get_or_create(
        idempotency_key=idem,
        defaults={
            "notification": notification,
            "channel": NotificationChannel.EMAIL,
            "status": NotificationDeliveryStatus.PENDING,
        },
    )
    if created or attempt.status in {
        NotificationDeliveryStatus.PENDING,
        NotificationDeliveryStatus.FAILED,
    }:
        from apps.notifications.tasks import deliver_notification_email

        deliver_notification_email.delay(str(attempt.id))
    return attempt


def queue_sms_notification(**_kwargs: Any) -> None:
    """SMS is not integrated until company/provider/budget approval."""
    raise ValidationError(
        {
            "channel": (
                "SMS notifications are not implemented. Provider/budget approval "
                "is EVIDENCE REQUIRED before integration."
            )
        }
    )


@atomic_fn
def mark_notification_read(*, actor: User | None, notification_id: uuid.UUID) -> Notification:
    user = _require_authenticated_actor(actor)
    notification = locked_get(Notification, pk=notification_id)
    if notification is None:
        raise ValidationError({"notification": "Notification not found."})
    if notification.recipient_id != user.id:
        raise PermissionDenied("Only the recipient may mark this notification read.")
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
        record_event(
            event_type="NOTIFICATION_READ",
            actor=user,
            metadata={
                "notification_id": str(notification.id),
                "organization_id": str(notification.organization_id),
            },
        )
    return notification


def render_email_bodies(*, notification: Notification) -> tuple[str, str]:
    """Plain + HTML bodies using escaped safe fields only."""
    title = escape_template_text(notification.title)
    body = escape_template_text(notification.safe_message)
    footer = "This message contains no checklist answers or review notes."
    plain = f"{notification.title}\n\n{notification.safe_message}\n\n{footer}\n"
    html_body = (
        f"<p><strong>{title}</strong></p><p>{body}</p>"
        f"<p><em>{escape_template_text(footer)}</em></p>"
    )
    return plain, html_body
