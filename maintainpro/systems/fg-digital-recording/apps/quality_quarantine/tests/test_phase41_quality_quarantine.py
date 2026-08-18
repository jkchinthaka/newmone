"""Phase 41 — Quality quarantine management tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.organizations.models import Organization
from apps.quality_quarantine.models import (
    QualityQuarantineEvent,
    QualityQuarantineRecord,
    QuarantineErpSyncStatus,
    QuarantineSource,
    QuarantineStatus,
)
from apps.quality_quarantine.policy import (
    evaluate_quarantine_erp_sync,
    evaluate_quarantine_release,
    quality_quarantine_release_approved,
)
from apps.quality_quarantine.selectors import (
    events_for_quarantine,
    list_quarantines_by_batch,
    list_quarantines_by_source,
)
from apps.quality_quarantine.services import (
    attempt_quarantine_erp_sync,
    cancel_quarantine_record,
    open_quarantine_record,
    record_erp_sync_status,
    release_quarantine_record,
    update_quarantine_quantity,
    upsert_quarantine_policy,
)
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    content_type = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _quarantine_user(
    *,
    org: Organization,
    manage: bool = True,
    release: bool = False,
    policy: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"QQ{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"QQ{suffix}",
        name=f"Quarantine {suffix}",
        permission=_perm(QualityQuarantineRecord, "view_qualityquarantine"),
    )
    if manage:
        role.permissions.add(_perm(QualityQuarantineRecord, "manage_qualityquarantine"))
    if release:
        role.permissions.add(_perm(QualityQuarantineRecord, "release_qualityquarantine"))
    if policy:
        role.permissions.add(_perm(QualityQuarantineRecord, "manage_quarantinepolicystub"))
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_source_linkage_quantity_and_multiple_quarantines() -> None:
    org = make_org(code=f"Q{uuid.uuid4().hex[:6].upper()}")
    actor = _quarantine_user(org=org, policy=True)
    upsert_quarantine_policy(
        actor=actor,
        organization=org,
        quantity_recording_enabled=True,
        procedure_reference="QQ-PROC-TBC",
    )
    with pytest.raises(ValidationError):
        open_quarantine_record(
            actor=actor,
            organization=org,
            code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
            batch_reference="BATCH-A",
            source="NOT_A_SOURCE",
            source_reference="SRC-X",
            reason_reference="REASON-X",
        )

    hold = open_quarantine_record(
        actor=actor,
        organization=org,
        code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
        batch_reference="BATCH-SHARED",
        sub_lot_reference="SUB-1",
        source=QuarantineSource.QA_HOLD,
        source_reference="HOLD-CASE-1",
        reason_reference="QA-HOLD-REASON",
        quantity_reference="10",
        uom_reference="CS",
    )
    assert hold.status == QuarantineStatus.OPEN
    assert hold.not_inventory_ledger is True
    assert hold.erp_sync_status == QuarantineErpSyncStatus.NOT_SENT

    returned = open_quarantine_record(
        actor=actor,
        organization=org,
        code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
        batch_reference="BATCH-SHARED",
        source=QuarantineSource.RETURNED_PRODUCT,
        source_reference="RET-DOC-1",
        reason_reference="RETURN-REASON",
    )
    ncr = open_quarantine_record(
        actor=actor,
        organization=org,
        code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
        batch_reference="BATCH-SHARED",
        source=QuarantineSource.NCR,
        source_reference="NCR-1",
        reason_reference="NCR-REASON",
    )
    cases = list(list_quarantines_by_batch(organization_id=org.id, batch_reference="BATCH-SHARED"))
    assert {c.id for c in cases} == {hold.id, returned.id, ncr.id}
    assert (
        list_quarantines_by_source(
            organization_id=org.id,
            source=QuarantineSource.QA_HOLD,
            source_reference="HOLD-CASE-1",
        )
        .filter(pk=hold.id)
        .exists()
    )

    hold = update_quarantine_quantity(
        actor=actor, quarantine=hold, quantity_reference="12", uom_reference="CS"
    )
    assert hold.quantity_reference == "12"
    assert SecurityAuditEvent.objects.filter(event_type="QUARANTINE_OPENED").exists()
    assert events_for_quarantine(organization_id=org.id, quarantine_id=hold.id).count() >= 2


@pytest.mark.django_db
def test_quantity_requires_org_policy() -> None:
    org = make_org(code=f"Y{uuid.uuid4().hex[:6].upper()}")
    actor = _quarantine_user(org=org)
    with pytest.raises(ValidationError):
        open_quarantine_record(
            actor=actor,
            organization=org,
            code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
            batch_reference="BATCH-Q",
            source=QuarantineSource.MANUAL,
            source_reference="MANUAL-1",
            reason_reference="REASON",
            quantity_reference="5",
        )


@pytest.mark.django_db
@override_settings(QUALITY_QUARANTINE_RELEASE_APPROVED=False)
def test_release_authority_not_inferred_from_checklist_pass() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    manager = _quarantine_user(org=org, release=True)
    assert quality_quarantine_release_approved() is False
    record = open_quarantine_record(
        actor=manager,
        organization=org,
        code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
        batch_reference="BATCH-REL",
        source=QuarantineSource.LAB_PENDING,
        source_reference="LAB-1",
        reason_reference="PENDING-RESULT",
        metadata={"checklist_result": "PASS"},  # opaque metadata only — never auto-release
    )
    decision = evaluate_quarantine_release(organization_id=org.id)
    assert decision.allowed is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"
    with pytest.raises(ValidationError):
        release_quarantine_record(
            actor=manager,
            quarantine=record,
            resolution_reference="WOULD-AUTO-FROM-PASS",
        )

    viewer = _quarantine_user(org=org, manage=False, release=False)
    with pytest.raises(PermissionDenied):
        release_quarantine_record(actor=viewer, quarantine=record)

    with override_settings(QUALITY_QUARANTINE_RELEASE_APPROVED=True):
        released = release_quarantine_record(
            actor=manager,
            quarantine=record,
            resolution_reference="APPROVED-RELEASE-REF",
        )
    assert released.status == QuarantineStatus.RELEASED
    assert released.resolution_reference == "APPROVED-RELEASE-REF"
    assert released.not_inventory_ledger is True
    assert SecurityAuditEvent.objects.filter(event_type="QUARANTINE_RELEASED").exists()


@pytest.mark.django_db
@override_settings(QUALITY_QUARANTINE_ERP_SYNC_APPROVED=False)
def test_erp_sync_status_tracking_and_outbound_blocked() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    actor = _quarantine_user(org=org, policy=True)
    upsert_quarantine_policy(
        actor=actor,
        organization=org,
        erp_sync_enabled=True,
        procedure_reference="ERP-SYNC-TBC",
    )
    decision = evaluate_quarantine_erp_sync(organization_id=org.id)
    assert decision.allowed is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"

    record = open_quarantine_record(
        actor=actor,
        organization=org,
        code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
        batch_reference="BATCH-ERP",
        source=QuarantineSource.INCOMING_INSPECTION,
        source_reference="IQC-1",
        reason_reference="INCOMING-HOLD",
    )
    record = record_erp_sync_status(
        actor=actor,
        quarantine=record,
        status=QuarantineErpSyncStatus.PENDING,
        detail="Awaiting adapter",
    )
    assert record.erp_sync_status == QuarantineErpSyncStatus.PENDING
    record = record_erp_sync_status(
        actor=actor,
        quarantine=record,
        status=QuarantineErpSyncStatus.FAILED,
        detail="Adapter unavailable",
    )
    assert record.erp_sync_status == QuarantineErpSyncStatus.FAILED
    with pytest.raises(IntegrationError) as exc:
        attempt_quarantine_erp_sync(actor=actor, quarantine=record)
    assert exc.value.error_class == IntegrationErrorClass.OUTBOUND_NOT_APPROVED
    assert SecurityAuditEvent.objects.filter(event_type="QUARANTINE_ERP_SYNC_BLOCKED").exists()


@pytest.mark.django_db
def test_cross_org_isolation() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    user_a = _quarantine_user(org=org_a)
    user_b = _quarantine_user(org=org_b)
    record = open_quarantine_record(
        actor=user_a,
        organization=org_a,
        code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
        batch_reference="BATCH-X",
        source=QuarantineSource.MANUAL,
        source_reference="MANUAL-A",
        reason_reference="REASON-A",
    )
    with pytest.raises(PermissionDenied):
        cancel_quarantine_record(actor=user_b, quarantine=record)
    assert (
        list_quarantines_by_batch(organization_id=org_b.id, batch_reference="BATCH-X").count() == 0
    )


@pytest.mark.django_db
@override_settings(QUALITY_QUARANTINE_RELEASE_APPROVED=True)
def test_immutability_of_events_and_resolved_opening_fields() -> None:
    org = make_org(code=f"I{uuid.uuid4().hex[:6].upper()}")
    actor = _quarantine_user(org=org, release=True)
    record = open_quarantine_record(
        actor=actor,
        organization=org,
        code=f"QQ-{uuid.uuid4().hex[:6].upper()}",
        batch_reference="BATCH-IMM",
        source=QuarantineSource.QA_HOLD,
        source_reference="HOLD-IMM",
        reason_reference="REASON-IMM",
    )
    event = events_for_quarantine(organization_id=org.id, quarantine_id=record.id).first()
    assert event is not None
    with pytest.raises(ValidationError):
        event.summary = "tamper"
        event.save()
    with pytest.raises(ValidationError):
        QualityQuarantineEvent.objects.filter(pk=event.pk).update(summary="tamper")
    with pytest.raises(ValidationError):
        event.delete()

    released = release_quarantine_record(
        actor=actor, quarantine=record, resolution_reference="DONE"
    )
    released.batch_reference = "BATCH-TAMPER"
    with pytest.raises(ValidationError):
        released.full_clean()
    released.refresh_from_db()
    assert released.batch_reference == "BATCH-IMM"
    assert released.not_inventory_ledger is True
    released.not_inventory_ledger = False
    released.save()
    released.refresh_from_db()
    assert released.not_inventory_ledger is True
