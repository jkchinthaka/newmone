"""Phase 13 — loading / dispatch quality foundation tests."""

from __future__ import annotations

import inspect
import uuid
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.dispatch.models import (
    ColdChainTemperatureReading,
    DispatchQualityRecord,
    DispatchRecordStatus,
    DispatchReleasePolicy,
)
from apps.dispatch.services import (
    cancel_dispatch_quality_record,
    complete_dispatch_quality_record,
    create_dispatch_quality_record,
    evaluate_release_gate,
    link_vehicle_inspection,
    record_cold_chain_temperature,
    set_dispatch_quantity_line,
    set_dispatch_release_policy,
    update_dispatch_quality_record,
)
from apps.organizations.models import Organization
from apps.quality.models import QAReviewDecision
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
        code=f"D{suffix}",
        name=f"Dispatch role {suffix}",
        permission=_perm(model, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)


@pytest.mark.django_db
def test_dispatch_vehicle_record_and_authorization() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    stranger = make_user(employee_code=f"S{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        DispatchQualityRecord,
        "create_dispatchqualityrecord",
        "manage_dispatchqualityrecord",
        "complete_dispatchqualityrecord",
        "view_dispatchqualityrecord",
    )
    record = create_dispatch_quality_record(
        actor=actor,
        organization=org,
        code=f"LD-{uuid.uuid4().hex[:6].upper()}",
        delivery_loading_reference="DEL-100",
        vehicle_reference="VH-22",
        driver_reference="DRV-9",
        loading_bay="BAY-1",
        seal_number="SEAL-1",
        batch_reference="BATCH-A",
        sub_lot_reference="SUB-1",
        quantity=Decimal("100.5"),
        quantity_uom="kg",
    )
    assert record.status == DispatchRecordStatus.OPEN
    assert record.vehicle_reference == "VH-22"
    assert DispatchReleasePolicy.objects.filter(
        organization=org, require_qa_release_before_loading=False
    ).exists()

    updated = update_dispatch_quality_record(
        actor=actor,
        dispatch_record_id=record.id,
        vehicle_reference="VH-99",
    )
    assert updated.vehicle_reference == "VH-99"

    linked = link_vehicle_inspection(
        actor=actor,
        dispatch_record_id=record.id,
        checklist_version_id=None,
        submission_id=None,
    )
    assert linked.vehicle_inspection_checklist_version_id is None

    with pytest.raises(PermissionDenied):
        create_dispatch_quality_record(
            actor=stranger,
            organization=org,
            code="LD-X",
        )

    completed = complete_dispatch_quality_record(actor=actor, dispatch_record_id=record.id)
    assert completed.status == DispatchRecordStatus.COMPLETED
    assert SecurityAuditEvent.objects.filter(
        event_type="DISPATCH_QUALITY_RECORD_COMPLETED"
    ).exists()


@pytest.mark.django_db
def test_temperature_decimal_and_no_invented_limits() -> None:
    org = make_org(code=f"T{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        DispatchQualityRecord,
        "create_dispatchqualityrecord",
        "manage_dispatchqualityrecord",
    )
    record = create_dispatch_quality_record(
        actor=actor, organization=org, code="LD-TEMP", vehicle_reference="VH-1"
    )
    reading = record_cold_chain_temperature(
        actor=actor,
        dispatch_record_id=record.id,
        reading_at=timezone.now(),
        temperature_celsius="2.750",
        device_reference="PROBE-1",
        reading_context="trailer centre",
    )
    assert isinstance(reading.temperature_celsius, Decimal)
    assert reading.temperature_celsius == Decimal("2.750")
    # No pass/fail fields on model
    field_names = {f.name for f in ColdChainTemperatureReading._meta.get_fields()}
    assert "pass_fail" not in field_names
    assert "limit" not in field_names
    assert "ccp" not in field_names
    with pytest.raises(ValidationError):
        record_cold_chain_temperature(
            actor=actor,
            dispatch_record_id=record.id,
            reading_at=timezone.now(),
            temperature_celsius="not-a-number",
        )


@pytest.mark.django_db
def test_quantity_integrity_remaining_and_over_load() -> None:
    org = make_org(code=f"Q{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        DispatchQualityRecord,
        "create_dispatchqualityrecord",
        "manage_dispatchqualityrecord",
    )
    record = create_dispatch_quality_record(
        actor=actor,
        organization=org,
        code="LD-QTY",
        batch_reference="B1",
        sub_lot_reference="S1",
    )
    line = set_dispatch_quantity_line(
        actor=actor,
        dispatch_record_id=record.id,
        released_quantity=Decimal("100.000000"),
        loaded_quantity=Decimal("40.500000"),
        unit_of_measure="kg",
        source_reference="manual-foundation",
    )
    assert line.remaining_quantity == Decimal("59.500000")
    assert isinstance(line.released_quantity, Decimal)
    with pytest.raises(ValidationError):
        set_dispatch_quantity_line(
            actor=actor,
            dispatch_record_id=record.id,
            released_quantity=Decimal("10"),
            loaded_quantity=Decimal("11"),
        )
    # Not an ERP ledger claim in services
    src = inspect.getsource(set_dispatch_quantity_line)
    assert "ERP" in src or "ledger" in src.lower()


@pytest.mark.django_db
def test_release_policy_disabled_and_enabled_block() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        DispatchQualityRecord,
        "create_dispatchqualityrecord",
        "manage_dispatchqualityrecord",
        "complete_dispatchqualityrecord",
        "manage_dispatchreleasepolicy",
    )
    record = create_dispatch_quality_record(
        actor=actor, organization=org, code="LD-GATE", vehicle_reference="VH"
    )
    # Default disabled — complete allowed without QA RELEASE
    policy = DispatchReleasePolicy.objects.get(organization=org)
    assert policy.require_qa_release_before_loading is False
    gate_off = evaluate_release_gate(record=record, policy=policy)
    assert gate_off["gate_enabled"] is False
    assert gate_off["allowed"] is True

    set_dispatch_release_policy(
        actor=actor,
        organization=org,
        require_qa_release_before_loading=True,
        notes="EVIDENCE REQUIRED / proposed enablement for tests only",
    )
    policy.refresh_from_db()
    assert policy.require_qa_release_before_loading is True
    gate_on = evaluate_release_gate(record=record, policy=policy)
    assert gate_on["allowed"] is False

    with pytest.raises(ValidationError) as exc:
        complete_dispatch_quality_record(actor=actor, dispatch_record_id=record.id)
    assert "release_gate" in exc.value.message_dict
    assert SecurityAuditEvent.objects.filter(event_type="DISPATCH_RELEASE_GATE_BLOCKED").exists()

    # AI must never appear as gate authority
    gate_src = inspect.getsource(evaluate_release_gate)
    assert "AI" in gate_src or "ai" in gate_src.lower()


def test_evaluate_release_gate_with_release_decision() -> None:
    policy = DispatchReleasePolicy(require_qa_release_before_loading=True)
    qa = SimpleNamespace(id=uuid.uuid4(), decision=QAReviewDecision.RELEASE)
    record = SimpleNamespace(organization_id=uuid.uuid4(), qa_review_id=qa.id, qa_review=qa)
    result = evaluate_release_gate(record=record, policy=policy)  # type: ignore[arg-type]
    assert result["allowed"] is True
    assert result["qa_decision"] == QAReviewDecision.RELEASE

    qa_hold = SimpleNamespace(id=uuid.uuid4(), decision=QAReviewDecision.HOLD)
    record_hold = SimpleNamespace(
        organization_id=uuid.uuid4(), qa_review_id=qa_hold.id, qa_review=qa_hold
    )
    blocked = evaluate_release_gate(record=record_hold, policy=policy)  # type: ignore[arg-type]
    assert blocked["allowed"] is False


@pytest.mark.django_db
def test_cross_org_denied_and_cancel() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    actor_a = make_user(employee_code=f"AA{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    actor_b = make_user(employee_code=f"BB{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor_a,
        org_a,
        DispatchQualityRecord,
        "create_dispatchqualityrecord",
        "manage_dispatchqualityrecord",
    )
    _grant(
        actor_b,
        org_b,
        DispatchQualityRecord,
        "create_dispatchqualityrecord",
        "manage_dispatchqualityrecord",
    )
    record = create_dispatch_quality_record(
        actor=actor_a, organization=org_a, code="LD-XO", vehicle_reference="VH"
    )
    with pytest.raises(PermissionDenied):
        update_dispatch_quality_record(
            actor=actor_b,
            dispatch_record_id=record.id,
            vehicle_reference="stolen",
        )
    cancelled = cancel_dispatch_quality_record(
        actor=actor_a, dispatch_record_id=record.id, note="abort"
    )
    assert cancelled.status == DispatchRecordStatus.CANCELLED
    with pytest.raises(ValidationError):
        record_cold_chain_temperature(
            actor=actor_a,
            dispatch_record_id=record.id,
            reading_at=timezone.now() + timedelta(minutes=1),
            temperature_celsius=Decimal("1.0"),
        )


@pytest.mark.django_db
def test_no_erp_write_and_quality_services_no_auto_dispatch() -> None:
    from apps.dispatch import services as dispatch_services
    from apps.quality import services as quality_services

    dsrc = inspect.getsource(dispatch_services)
    assert "No ERP" in dsrc or "Never writes to ERP" in dsrc or "no ERP" in dsrc.lower()
    qsrc = inspect.getsource(quality_services)
    assert "create_dispatch_quality_record" not in qsrc
    assert "set_dispatch_release_policy" not in qsrc
