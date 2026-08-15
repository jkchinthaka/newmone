"""Phase 17 — Bileeta/ERP integration boundary tests (vendor evidence gated)."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.integrations.bileeta.client import LiveBileetaClient
from apps.integrations.bileeta.mock import MockBileetaAdapter, sample_mock_event
from apps.integrations.contracts import INBOUND_FIELD_EVIDENCE, InboundFieldEvidence
from apps.integrations.errors import (
    IntegrationError,
    IntegrationErrorClass,
    classify_http_status,
)
from apps.integrations.models import IntegrationAttempt, IntegrationAttemptStatus
from apps.integrations.outbound import prepare_disposition_command, send_disposition_to_erp
from apps.integrations.reconciliation import reconcile_external_batch_events
from apps.integrations.retry import DEFAULT_RETRY_POLICY
from apps.integrations.security import redact_mapping, redact_string
from apps.integrations.services import (
    attempt_live_pull_blocked,
    get_vendor_evidence_status,
    ingest_inbound_batch_event,
    mark_attempt_dead_letter,
)
from apps.integrations.vendor_evidence import (
    assert_live_calls_allowed,
    evidence_is_complete,
    missing_evidence_codes,
)
from apps.organizations.models import Organization
from apps.scheduling.models import ExternalBatchEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant(user: User, org: Organization, *codenames: str) -> None:
    suffix = uuid.uuid4().hex[:6].upper()
    role = make_role_with_permission(
        code=f"I{suffix}",
        name=f"Integ role {suffix}",
        permission=_perm(IntegrationAttempt, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(IntegrationAttempt, code))
    grant_role(user, role, organization=org)


def test_vendor_evidence_gate_blocks_live() -> None:
    assert evidence_is_complete() is False
    assert "API_DOCS" in missing_evidence_codes()
    with pytest.raises(RuntimeError, match="VENDOR API EVIDENCE REQUIRED"):
        assert_live_calls_allowed()
    client = LiveBileetaClient()
    with pytest.raises(IntegrationError) as exc:
        client.fetch_batch_events()
    assert exc.value.error_class == IntegrationErrorClass.VENDOR_EVIDENCE_BLOCKED


def test_contract_field_evidence_catalogue() -> None:
    assert INBOUND_FIELD_EVIDENCE["source_event_id"] == InboundFieldEvidence.MAPPED_INTERNAL
    assert INBOUND_FIELD_EVIDENCE["quantity"] == InboundFieldEvidence.EVIDENCE_REQUIRED
    assert INBOUND_FIELD_EVIDENCE["uom"] == InboundFieldEvidence.EVIDENCE_REQUIRED


def test_retry_backoff_and_http_classification() -> None:
    assert DEFAULT_RETRY_POLICY.delay_for_attempt(1) == 1.0
    assert DEFAULT_RETRY_POLICY.delay_for_attempt(2) == 2.0
    assert DEFAULT_RETRY_POLICY.delay_for_attempt(3) == 4.0
    assert classify_http_status(401) == (IntegrationErrorClass.AUTH_FAILURE, False)
    assert classify_http_status(429) == (IntegrationErrorClass.RATE_LIMITED, True)
    assert classify_http_status(503) == (IntegrationErrorClass.TRANSIENT, True)


def test_secret_redaction() -> None:
    redacted = redact_mapping(
        {
            "authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.payload",
            "client_secret": "super-secret",
            "external_batch_id": "B-1",
            "nested": {"api_key": "abc123", "ok": "visible"},
        }
    )
    assert redacted["authorization"] == "***REDACTED***"
    assert redacted["client_secret"] == "***REDACTED***"
    assert redacted["external_batch_id"] == "B-1"
    assert redacted["nested"]["api_key"] == "***REDACTED***"
    assert "Bearer ***REDACTED***" in redact_string(
        "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload"
    )


def test_mock_timeout_auth_rate_limit() -> None:
    with pytest.raises(IntegrationError) as t:
        MockBileetaAdapter(fail_mode="timeout", events=[]).pull_with_retries()
    assert t.value.error_class == IntegrationErrorClass.TIMEOUT

    with pytest.raises(IntegrationError) as a:
        MockBileetaAdapter(fail_mode="auth", events=[]).pull_with_retries()
    assert a.value.error_class == IntegrationErrorClass.AUTH_FAILURE

    with pytest.raises(IntegrationError) as r:
        MockBileetaAdapter(fail_mode="rate_limit", events=[]).pull_with_retries()
    assert r.value.error_class == IntegrationErrorClass.RATE_LIMITED
    assert r.value.retryable is True


@pytest.mark.django_db
def test_outbound_disposition_not_sent() -> None:
    cmd = prepare_disposition_command(
        organization_id=str(uuid.uuid4()),
        checklist_submission_id=str(uuid.uuid4()),
        qa_review_id=str(uuid.uuid4()),
        disposition="RELEASE",
        correlation_id="corr-1",
    )
    with pytest.raises(IntegrationError) as exc:
        send_disposition_to_erp(cmd)
    assert exc.value.error_class == IntegrationErrorClass.OUTBOUND_NOT_APPROVED


@pytest.mark.django_db
def test_evidence_status_rbac_and_duplicate_ingest() -> None:
    org = make_org(code=f"I{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    stranger = make_user(employee_code=f"S{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, "manage_integrationboundary", "view_integrationboundary")

    with pytest.raises(PermissionDenied):
        get_vendor_evidence_status(actor=stranger)

    status = get_vendor_evidence_status(actor=user)
    assert "BLOCKED" in status["phase_status"]
    assert status["complete"] is False

    event = sample_mock_event(
        source_event_id=f"evt-{uuid.uuid4().hex}",
        external_batch_id=f"BATCH-{uuid.uuid4().hex[:8]}",
        external_organization_key="NO-SUCH-ORG-KEY",
        correlation_id="corr-dup",
    )
    first, _ = ingest_inbound_batch_event(actor=user, organization=org, contract=event)
    second, _ = ingest_inbound_batch_event(actor=user, organization=org, contract=event)
    assert first.id == second.id
    assert first.status == IntegrationAttemptStatus.FAILED
    assert first.error_class == IntegrationErrorClass.BAD_MAPPING.value

    with pytest.raises(RuntimeError, match="VENDOR API EVIDENCE REQUIRED"):
        attempt_live_pull_blocked(actor=user)


@pytest.mark.django_db
def test_bad_mapping_dead_letter_and_reconciliation() -> None:
    org = make_org(code=f"M{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(user, org, "manage_integrationboundary", "view_integrationboundary")
    event = sample_mock_event(
        source_event_id=f"evt-{uuid.uuid4().hex}",
        external_batch_id="BATCH-MAP-FAIL",
        external_organization_key="NO-SUCH-ORG-KEY",
    )
    attempt, batch_event = ingest_inbound_batch_event(actor=user, organization=org, contract=event)
    assert attempt.status == IntegrationAttemptStatus.FAILED
    assert attempt.error_class == IntegrationErrorClass.BAD_MAPPING.value
    assert batch_event is not None
    assert attempt.external_batch_event_id == batch_event.id

    dead = mark_attempt_dead_letter(
        actor=user, attempt_id=attempt.id, reason="poison_after_mapping_failure"
    )
    assert dead.status == IntegrationAttemptStatus.DEAD_LETTER

    findings = reconcile_external_batch_events(
        source_system=event.source_system,
        limit=100,
    )
    kinds = {f.kind for f in findings}
    assert "MAPPING_FAILED" in kinds
    assert ExternalBatchEvent.objects.filter(pk=batch_event.id).exists()
