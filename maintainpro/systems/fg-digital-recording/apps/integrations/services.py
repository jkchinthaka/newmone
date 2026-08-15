"""Integration services — adapter boundary only.

Live Bileeta HTTP is blocked until vendor evidence is complete (APR-011/012).
Domain checklist models/views must not call vendor HTTP; they use scheduling ports.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from apps.core.persistence import locked_get
from django.utils import timezone

from apps.access_control.services import (
    Scope,
    require_permission,
    user_has_permission_any_scope,
)
from apps.accounts.models import User
from apps.integrations.bileeta.client import LiveBileetaClient, live_client_is_callable
from apps.integrations.bileeta.mock import MockBileetaAdapter
from apps.integrations.contracts import InboundBatchEventContract
from apps.integrations.errors import IntegrationErrorClass
from apps.integrations.models import (
    IntegrationAttempt,
    IntegrationAttemptStatus,
    IntegrationChannel,
)
from apps.integrations.outbound import prepare_disposition_command, send_disposition_to_erp
from apps.integrations.reconciliation import reconcile_external_batch_events
from apps.integrations.security import redact_mapping
from apps.integrations.vendor_evidence import (
    assert_live_calls_allowed,
    evidence_is_complete,
    evidence_register_as_dicts,
    missing_evidence_codes,
)
from apps.organizations.models import Organization
from apps.scheduling.integration import accept_external_batch_event
from apps.scheduling.models import ExternalBatchEvent, ExternalBatchEventStatus
from apps.security_audit.services import record_event

VIEW_BOUNDARY = "integrations.view_integrationboundary"
MANAGE_BOUNDARY = "integrations.manage_integrationboundary"

__all__ = [
    "VIEW_BOUNDARY",
    "MANAGE_BOUNDARY",
    "get_vendor_evidence_status",
    "ingest_inbound_batch_event",
    "pull_mock_and_ingest",
    "attempt_live_pull_blocked",
    "mark_attempt_dead_letter",
    "prepare_disposition_command",
    "send_disposition_to_erp",
    "reconcile_external_batch_events",
]


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def get_vendor_evidence_status(*, actor: User | None) -> dict[str, Any]:
    user = _require_authenticated_actor(actor)
    if not user_has_permission_any_scope(user, VIEW_BOUNDARY):
        raise PermissionDenied("Permission denied.")
    return {
        "complete": evidence_is_complete(),
        "missing": missing_evidence_codes(),
        "live_client_callable": live_client_is_callable(),
        "items": evidence_register_as_dicts(),
        "phase_status": (
            "PHASE_17_BILEETA_COMPLETE"
            if evidence_is_complete()
            else "PHASE_17_BLOCKED_VENDOR_API_EVIDENCE_REQUIRED"
        ),
    }


def _idempotency_key(contract: InboundBatchEventContract) -> str:
    return f"{contract.source_system}:{contract.source_event_id}"


@transaction.atomic
def ingest_inbound_batch_event(
    *,
    actor: User | None,
    contract: InboundBatchEventContract,
    organization: Organization | None = None,
) -> tuple[IntegrationAttempt, ExternalBatchEvent | None]:
    """
    Anti-corruption ingest: contract → Phase 07F scheduling port.

    Idempotent on (source_system, source_event_id, INBOUND_BATCH).
    Unknown mappings surface as ExternalBatchEvent MAPPING_FAILED — never guessed.
    """
    user = _require_authenticated_actor(actor)
    if organization is not None:
        require_permission(user, MANAGE_BOUNDARY, scope=Scope(organization_id=organization.id))
    elif not user_has_permission_any_scope(user, MANAGE_BOUNDARY):
        raise PermissionDenied("Permission denied.")

    key = _idempotency_key(contract)
    existing = IntegrationAttempt.objects.filter(
        source_system=contract.source_system,
        idempotency_key=key,
        channel=IntegrationChannel.INBOUND_BATCH,
    ).first()
    if existing is not None:
        event = None
        if existing.external_batch_event_id:
            event = ExternalBatchEvent.objects.filter(pk=existing.external_batch_event_id).first()
        record_event(
            event_type="INTEGRATION_INBOUND_DUPLICATE",
            actor=user,
            metadata=redact_mapping(
                {
                    "organization_id": str(organization.id) if organization else "",
                    "idempotency_key": key,
                    "correlation_id": contract.correlation_id,
                    "attempt_id": str(existing.id),
                }
            ),
        )
        return existing, event

    attempt = IntegrationAttempt(
        organization=organization,
        channel=IntegrationChannel.INBOUND_BATCH,
        source_system=contract.source_system,
        idempotency_key=key,
        correlation_id=contract.correlation_id or contract.source_event_id,
        status=IntegrationAttemptStatus.PENDING,
        attempt_count=1,
        requested_by=user,
        metadata=redact_mapping(
            {
                "external_batch_id": contract.external_batch_id,
                "erp_product_code_present": bool(contract.erp_product_code),
                "correlation_id": contract.correlation_id,
            }
        ),
    )
    try:
        attempt.save()
    except IntegrityError:
        existing = IntegrationAttempt.objects.get(
            source_system=contract.source_system,
            idempotency_key=key,
            channel=IntegrationChannel.INBOUND_BATCH,
        )
        return existing, None

    try:
        event = accept_external_batch_event(actor=user, **contract.to_scheduling_kwargs())
    except ValidationError as exc:
        attempt.status = IntegrationAttemptStatus.FAILED
        attempt.error_class = IntegrationErrorClass.VALIDATION.value
        attempt.error_summary = str(exc)[:255]
        attempt.completed_at = timezone.now()
        attempt.save(
            update_fields=[
                "status",
                "error_class",
                "error_summary",
                "completed_at",
                "updated_at",
            ]
        )
        record_event(
            event_type="INTEGRATION_INBOUND_FAILED",
            actor=user,
            metadata=redact_mapping(
                {
                    "attempt_id": str(attempt.id),
                    "error_class": attempt.error_class,
                    "correlation_id": attempt.correlation_id,
                }
            ),
        )
        raise

    attempt.external_batch_event_id = event.id
    if organization is None and event.organization_id:
        attempt.organization_id = event.organization_id

    if event.status == ExternalBatchEventStatus.MAPPING_FAILED:
        attempt.status = IntegrationAttemptStatus.FAILED
        attempt.error_class = IntegrationErrorClass.BAD_MAPPING.value
        attempt.error_summary = (event.failure_code or "mapping_failed")[:255]
    elif event.status in {
        ExternalBatchEventStatus.APPLICABILITY_FAILED,
        ExternalBatchEventStatus.VERSION_FAILED,
        ExternalBatchEventStatus.REJECTED,
    }:
        attempt.status = IntegrationAttemptStatus.FAILED
        attempt.error_class = IntegrationErrorClass.VALIDATION.value
        attempt.error_summary = (event.failure_code or event.status)[:255]
    elif event.status == ExternalBatchEventStatus.COMPLETED:
        attempt.status = IntegrationAttemptStatus.SUCCEEDED
        attempt.error_class = ""
        attempt.error_summary = ""
    else:
        attempt.status = IntegrationAttemptStatus.FAILED
        attempt.error_class = IntegrationErrorClass.UNKNOWN.value
        attempt.error_summary = f"Unexpected event status: {event.status}"[:255]

    attempt.completed_at = timezone.now()
    attempt.save(
        update_fields=[
            "organization",
            "external_batch_event_id",
            "status",
            "error_class",
            "error_summary",
            "completed_at",
            "updated_at",
        ]
    )
    record_event(
        event_type=(
            "INTEGRATION_INBOUND_SUCCEEDED"
            if attempt.status == IntegrationAttemptStatus.SUCCEEDED
            else "INTEGRATION_INBOUND_FAILED"
        ),
        actor=user,
        metadata=redact_mapping(
            {
                "attempt_id": str(attempt.id),
                "organization_id": str(attempt.organization_id or ""),
                "external_batch_event_id": str(event.id),
                "event_status": event.status,
                "error_class": attempt.error_class,
                "correlation_id": attempt.correlation_id,
            }
        ),
    )
    return attempt, event


def pull_mock_and_ingest(
    *,
    actor: User | None,
    adapter: MockBileetaAdapter,
    organization: Organization | None = None,
) -> list[tuple[IntegrationAttempt, ExternalBatchEvent | None]]:
    """Contract-test path: mock pull (with retries) then ingest each event."""
    user = _require_authenticated_actor(actor)
    if organization is not None:
        require_permission(user, MANAGE_BOUNDARY, scope=Scope(organization_id=organization.id))
    elif not user_has_permission_any_scope(user, MANAGE_BOUNDARY):
        raise PermissionDenied("Permission denied.")
    events = adapter.pull_with_retries()
    results: list[tuple[IntegrationAttempt, ExternalBatchEvent | None]] = []
    for contract in events:
        results.append(
            ingest_inbound_batch_event(actor=user, contract=contract, organization=organization)
        )
    return results


def attempt_live_pull_blocked(*, actor: User | None) -> None:
    """
    Explicit live-path entry — always raises while evidence incomplete
    or when no approved endpoint path exists.
    """
    user = _require_authenticated_actor(actor)
    if not user_has_permission_any_scope(user, MANAGE_BOUNDARY):
        raise PermissionDenied("Permission denied.")
    record_event(
        event_type="INTEGRATION_LIVE_BLOCKED",
        actor=user,
        metadata=redact_mapping(
            {
                "missing": missing_evidence_codes(),
                "live_enabled_flag": live_client_is_callable(),
            }
        ),
    )
    # Prefer evidence gate first when incomplete.
    if not evidence_is_complete():
        assert_live_calls_allowed()
    LiveBileetaClient().fetch_batch_events()


@transaction.atomic
def mark_attempt_dead_letter(
    *,
    actor: User | None,
    attempt_id: uuid.UUID,
    reason: str,
) -> IntegrationAttempt:
    user = _require_authenticated_actor(actor)
    attempt = locked_get(IntegrationAttempt, pk=attempt_id)
    if attempt is None:
        raise ValidationError({"attempt": "Integration attempt not found."})
    scope = Scope(organization_id=attempt.organization_id) if attempt.organization_id else Scope()
    require_permission(user, MANAGE_BOUNDARY, scope=scope)
    attempt.status = IntegrationAttemptStatus.DEAD_LETTER
    attempt.error_summary = (reason or "dead_letter")[:255]
    attempt.completed_at = timezone.now()
    attempt.save(update_fields=["status", "error_summary", "completed_at", "updated_at"])
    record_event(
        event_type="INTEGRATION_DEAD_LETTER",
        actor=user,
        metadata=redact_mapping(
            {
                "attempt_id": str(attempt.id),
                "organization_id": str(attempt.organization_id or ""),
                "correlation_id": attempt.correlation_id,
                "error_class": attempt.error_class,
            }
        ),
    )
    return attempt
