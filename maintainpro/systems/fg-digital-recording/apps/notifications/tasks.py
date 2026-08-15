"""Celery tasks for notification email delivery — idempotent retries."""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from apps.core.persistence import atomic, lock_queryset
from django.utils import timezone

from apps.notifications.models import (
    NotificationChannel,
    NotificationDeliveryAttempt,
    NotificationDeliveryStatus,
)
from apps.notifications.services import render_email_bodies, smtp_is_configured
from apps.security_audit.services import record_event
from celery import shared_task


@shared_task(
    name="apps.notifications.tasks.deliver_notification_email",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)  # type: ignore[untyped-decorator]
def deliver_notification_email(self: Any, delivery_attempt_id: str) -> dict[str, Any]:
    """
    Deliver one email attempt idempotently.

    Already-DELIVERED attempts are no-ops. Failures update status and may retry.
    """
    with atomic():
        attempt = (
            lock_queryset(
            NotificationDeliveryAttempt.objects.select_related("notification", "notification__recipient").filter(pk=delivery_attempt_id)
            ).first()
        )
        if attempt is None:
            return {"ok": False, "reason": "missing_attempt"}
        if attempt.channel != NotificationChannel.EMAIL:
            return {"ok": False, "reason": "not_email"}
        if attempt.status == NotificationDeliveryStatus.DELIVERED:
            return {"ok": True, "reason": "already_delivered", "idempotent": True}

        attempt.attempt_count += 1
        attempt.last_attempted_at = timezone.now()

        if not smtp_is_configured():
            attempt.status = NotificationDeliveryStatus.SKIPPED
            attempt.last_error = "SMTP not configured"
            attempt.save(
                update_fields=[
                    "attempt_count",
                    "last_attempted_at",
                    "status",
                    "last_error",
                    "updated_at",
                ]
            )
            return {"ok": True, "reason": "smtp_not_configured"}

        notification = attempt.notification
        recipient_email = (notification.recipient.email or "").strip()
        if not recipient_email:
            attempt.status = NotificationDeliveryStatus.SKIPPED
            attempt.last_error = "Recipient has no email"
            attempt.save(
                update_fields=[
                    "attempt_count",
                    "last_attempted_at",
                    "status",
                    "last_error",
                    "updated_at",
                ]
            )
            return {"ok": True, "reason": "no_recipient_email"}

        plain, html_body = render_email_bodies(notification=notification)
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "") or "noreply@localhost"
        try:
            send_mail(
                subject=notification.title,
                message=plain,
                from_email=from_email,
                recipient_list=[recipient_email],
                html_message=html_body,
                fail_silently=False,
            )
        except Exception as exc:  # noqa: BLE001 — record and retry
            attempt.status = NotificationDeliveryStatus.FAILED
            attempt.last_error = str(exc)[:255]
            attempt.save(
                update_fields=[
                    "attempt_count",
                    "last_attempted_at",
                    "status",
                    "last_error",
                    "updated_at",
                ]
            )
            record_event(
                event_type="NOTIFICATION_EMAIL_FAILED",
                actor=None,
                metadata={
                    "delivery_attempt_id": str(attempt.id),
                    "notification_id": str(notification.id),
                    "attempt_count": attempt.attempt_count,
                },
            )
            try:
                raise self.retry(exc=exc)
            except self.MaxRetriesExceededError:
                return {"ok": False, "reason": "max_retries", "error": str(exc)[:200]}

        attempt.status = NotificationDeliveryStatus.DELIVERED
        attempt.last_error = ""
        attempt.save(
            update_fields=[
                "attempt_count",
                "last_attempted_at",
                "status",
                "last_error",
                "updated_at",
            ]
        )
        record_event(
            event_type="NOTIFICATION_EMAIL_DELIVERED",
            actor=None,
            metadata={
                "delivery_attempt_id": str(attempt.id),
                "notification_id": str(notification.id),
                "attempt_count": attempt.attempt_count,
            },
        )
        return {"ok": True, "reason": "delivered", "attempt_count": attempt.attempt_count}
