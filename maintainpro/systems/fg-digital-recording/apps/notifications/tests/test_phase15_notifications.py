"""Phase 15 — workflow notifications foundation tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core import mail
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.mail import EmailMultiAlternatives
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.notifications.models import (
    Notification,
    NotificationDeliveryAttempt,
    NotificationDeliveryStatus,
    NotificationEventType,
    OrganizationNotificationPolicy,
)
from apps.notifications.privacy import escape_template_text, validate_safe_notification_text
from apps.notifications.services import (
    create_in_app_notification,
    mark_notification_read,
    queue_sms_notification,
    set_notification_policy,
)
from apps.notifications.tasks import deliver_notification_email
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant(user: User, org: Organization, model: type[Any], *codenames: str) -> None:
    suffix = uuid.uuid4().hex[:6].upper()
    role = make_role_with_permission(
        code=f"N{suffix}",
        name=f"Notify role {suffix}",
        permission=_perm(model, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)


@pytest.mark.django_db
def test_events_disabled_by_default_and_recipient_auth() -> None:
    org = make_org(code=f"N{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    recipient = make_user(employee_code=f"R{uuid.uuid4().hex[:6].upper()}")
    recipient.email = "recipient@example.com"
    recipient.save(update_fields=["email"])
    stranger = make_user(employee_code=f"S{uuid.uuid4().hex[:6].upper()}")
    _grant(actor, org, Notification, "manage_notifications")
    _grant(actor, org, OrganizationNotificationPolicy, "manage_notificationpolicy")

    # Disabled by default — no notification created
    none = create_in_app_notification(
        actor=actor,
        organization=org,
        recipient=recipient,
        event_type=NotificationEventType.TASK_ASSIGNED,
        title="Task assigned",
        safe_message="A checklist task was assigned to you.",
        dedupe_key=f"task-assign-{uuid.uuid4().hex}",
    )
    assert none is None

    set_notification_policy(
        actor=actor,
        organization=org,
        enabled_event_types=[NotificationEventType.TASK_ASSIGNED],
        email_delivery_enabled=False,
    )
    note = create_in_app_notification(
        actor=actor,
        organization=org,
        recipient=recipient,
        event_type=NotificationEventType.TASK_ASSIGNED,
        title="Task assigned",
        safe_message="A checklist task was assigned to you.",
        dedupe_key=f"task-assign-{uuid.uuid4().hex}",
    )
    assert note is not None
    assert note.recipient_id == recipient.id
    assert note.read_at is None

    with pytest.raises(PermissionDenied):
        mark_notification_read(actor=stranger, notification_id=note.id)

    marked = mark_notification_read(actor=recipient, notification_id=note.id)
    assert marked.read_at is not None


@pytest.mark.django_db
def test_duplicate_dedupe_and_sensitive_exclusion() -> None:
    org = make_org(code=f"N{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    recipient = make_user(employee_code=f"R{uuid.uuid4().hex[:6].upper()}")
    _grant(actor, org, Notification, "manage_notifications")
    _grant(actor, org, OrganizationNotificationPolicy, "manage_notificationpolicy")
    set_notification_policy(
        actor=actor,
        organization=org,
        enabled_event_types=[NotificationEventType.QA_PENDING],
    )
    key = f"qa-pending-{uuid.uuid4().hex}"
    first = create_in_app_notification(
        actor=actor,
        organization=org,
        recipient=recipient,
        event_type=NotificationEventType.QA_PENDING,
        title="QA pending",
        safe_message="A submission awaits QA review.",
        dedupe_key=key,
    )
    second = create_in_app_notification(
        actor=actor,
        organization=org,
        recipient=recipient,
        event_type=NotificationEventType.QA_PENDING,
        title="QA pending again",
        safe_message="A submission awaits QA review.",
        dedupe_key=key,
    )
    assert first is not None and second is not None
    assert first.id == second.id
    assert Notification.objects.filter(recipient=recipient, dedupe_key__iexact=key).count() == 1

    with pytest.raises(ValidationError):
        create_in_app_notification(
            actor=actor,
            organization=org,
            recipient=recipient,
            event_type=NotificationEventType.QA_PENDING,
            title="Leak",
            safe_message="Operator answer was YES and review note says hold product",
            dedupe_key=f"bad-{uuid.uuid4().hex}",
        )
    with pytest.raises(ValidationError):
        create_in_app_notification(
            actor=actor,
            organization=org,
            recipient=recipient,
            event_type=NotificationEventType.QA_PENDING,
            title="Meta leak",
            safe_message="QA review is pending.",
            dedupe_key=f"meta-{uuid.uuid4().hex}",
            metadata={"answers": {"item": "YES"}},
        )


def test_template_escaping_and_sms_blocked() -> None:
    escaped = escape_template_text('<script>alert("x")</script>')
    assert "<script>" not in escaped
    assert "&lt;script&gt;" in escaped
    with pytest.raises(ValidationError):
        validate_safe_notification_text(
            "Contains answer details", field="safe_message", max_length=280
        )
    with pytest.raises(ValidationError):
        queue_sms_notification(to="+94000000000", body="hi")


@pytest.mark.django_db
def test_email_retry_idempotent(settings: Any) -> None:
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.EMAIL_HOST = "localhost"
    org = make_org(code=f"N{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    recipient = make_user(employee_code=f"R{uuid.uuid4().hex[:6].upper()}")
    recipient.email = "qa@example.com"
    recipient.save(update_fields=["email"])
    _grant(actor, org, Notification, "manage_notifications")
    _grant(actor, org, OrganizationNotificationPolicy, "manage_notificationpolicy")
    set_notification_policy(
        actor=actor,
        organization=org,
        enabled_event_types=[NotificationEventType.QA_HOLD],
        email_delivery_enabled=True,
    )
    note = create_in_app_notification(
        actor=actor,
        organization=org,
        recipient=recipient,
        event_type=NotificationEventType.QA_HOLD,
        title="QA HOLD recorded",
        safe_message="A QA HOLD disposition was recorded.",
        dedupe_key=f"hold-{uuid.uuid4().hex}",
    )
    assert note is not None
    attempt = NotificationDeliveryAttempt.objects.get(notification=note)
    result1 = deliver_notification_email(str(attempt.id))
    assert result1.get("ok") is True
    attempt.refresh_from_db()
    assert attempt.status == NotificationDeliveryStatus.DELIVERED
    assert len(mail.outbox) >= 1
    html = ""
    last_message = mail.outbox[-1]
    if isinstance(last_message, EmailMultiAlternatives) and last_message.alternatives:
        html = str(last_message.alternatives[0][0])
    assert "no checklist answers" in html.lower() or "review notes" in html.lower()
    assert "<script>" not in html
    assert "YES" not in mail.outbox[-1].body  # no sample answer values
    before = attempt.attempt_count
    result2 = deliver_notification_email(str(attempt.id))
    attempt.refresh_from_db()
    assert result2.get("idempotent") is True or result2.get("reason") == "already_delivered"
    assert attempt.attempt_count == before
    assert SecurityAuditEvent.objects.filter(event_type="NOTIFICATION_CREATED").exists()
