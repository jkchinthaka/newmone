"""Security audit recording tests."""

from __future__ import annotations

import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory
from tests.factories import make_user

from apps.security_audit.admin import SecurityAuditEventAdmin
from apps.security_audit.models import SecurityAuditEvent
from apps.security_audit.services import mask_unknown_identifier, record_event, sanitize_metadata


@pytest.mark.django_db
def test_record_event_strips_sensitive_metadata() -> None:
    user = make_user(employee_code="TST001")
    event = record_event(
        event_type="PASSWORD_CHANGED",
        actor=user,
        subject_user=user,
        metadata={
            "password": "secret-should-not-store",
            "session": "abc",
            "token": "xyz",
            "safe_note": "ok",
        },
    )
    assert "password" not in event.metadata
    assert "session" not in event.metadata
    assert "token" not in event.metadata
    assert event.metadata.get("safe_note") == "ok"


@pytest.mark.django_db
def test_mask_unknown_identifier() -> None:
    masked = mask_unknown_identifier("UNKNOWN99")
    assert masked.startswith("unknown:")
    assert "UNKNOWN99" not in masked
    assert mask_unknown_identifier("UNKNOWN99") == masked


@pytest.mark.django_db
def test_sanitize_metadata_nested() -> None:
    cleaned = sanitize_metadata({"outer": {"password": "x", "keep": 1}, "cookie": "a"})
    assert "cookie" not in cleaned
    assert cleaned["outer"]["keep"] == 1
    assert "password" not in cleaned["outer"]


@pytest.mark.django_db
def test_admin_is_read_only() -> None:
    site = AdminSite()
    admin = SecurityAuditEventAdmin(SecurityAuditEvent, site)
    request = RequestFactory().get("/admin/")
    request.user = make_user(employee_code="TSTADMIN", is_superuser=True, is_staff=True)
    assert admin.has_add_permission(request) is False
    assert admin.has_change_permission(request) is False
    assert admin.has_delete_permission(request) is False


@pytest.mark.django_db
def test_unsupported_event_type_rejected() -> None:
    with pytest.raises(ValueError):
        record_event(event_type="NOT_A_REAL_EVENT")
