"""Phase 40 returned-product quality workflow tests (synthetic data only)."""

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
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.organizations.models import Organization
from apps.product_returns.models import (
    ReturnDisposition,
    ReturnQualityPolicy,
    ReturnQualityRecord,
    ReturnQualityStatus,
    ReturnQuarantineState,
)
from apps.product_returns.policy import evaluate_return_erp_stock_movement
from apps.product_returns.selectors import (
    return_quality_records_for_erp_return,
    return_quality_records_for_original_batch,
)
from apps.product_returns.services import (
    apply_return_disposition,
    attempt_return_erp_stock_movement,
    create_return_quality_record,
    mark_return_ready_for_disposition,
    start_return_inspection,
    update_return_quantity,
    upsert_return_quality_policy,
)
from apps.scheduling.models import ChecklistTask
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    content_type = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _return_manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"RT{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RT{suffix}",
        name=f"Synthetic return manager {suffix}",
        permission=_perm(ReturnQualityRecord, "manage_returnquality"),
    )
    for codename in ("view_returnquality", "inspect_returnquality", "disposition_returnquality"):
        role.permissions.add(_perm(ReturnQualityRecord, codename))
    role.permissions.add(_perm(ReturnQualityPolicy, "manage_returnpolicystub"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def _published_return_checklist(actor: User, org: Organization) -> Any:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"RET-{uuid.uuid4().hex[:6].upper()}",
        name="Synthetic returned-product inspection",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(
        actor=actor, version_id=version.id, title="Synthetic inspection"
    )
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="SYNTHETIC-CHECK",
        label="Synthetic test response",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    return template, publish_checklist_version(actor=actor, version_id=version.id)


@pytest.mark.django_db
def test_return_mapping_quantity_inspection_quarantine_and_disposition() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    manager = _return_manager(org=org)
    template, version = _published_return_checklist(manager, org)
    record = create_return_quality_record(
        actor=manager,
        organization=org,
        erp_return_reference="RET-SYNTHETIC-001",
        erp_return_line_reference="LINE-01",
        product_reference="PRODUCT-OPAQUE",
        original_batch_reference="BATCH-OPAQUE",
        quantity_reference="QTY-ORIGINAL",
        uom_reference="UOM-OPAQUE",
        erp_customer_reference="CUSTOMER-OPAQUE",
        reason_reference="REASON-OPAQUE",
        condition_reference="CONDITION-OPAQUE",
        temperature_reference="TEMP-OPAQUE",
    )
    assert record.status == ReturnQualityStatus.RECEIVED
    assert record.quarantine_state == ReturnQuarantineState.QUARANTINED
    assert record.not_saleable_via_app is True
    assert (
        return_quality_records_for_erp_return(
            organization_id=org.id, erp_return_reference="RET-SYNTHETIC-001"
        )
        .filter(pk=record.id)
        .exists()
    )
    assert (
        return_quality_records_for_original_batch(
            organization_id=org.id, original_batch_reference="BATCH-OPAQUE"
        )
        .filter(pk=record.id)
        .exists()
    )

    record = update_return_quantity(
        actor=manager,
        record=record,
        quantity_reference="QTY-CORRECTED",
        uom_reference="UOM-CORRECTED",
    )
    assert record.quantity_reference == "QTY-CORRECTED"
    record = start_return_inspection(
        actor=manager,
        record=record,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
    )
    assert record.status == ReturnQualityStatus.INSPECTION_IN_PROGRESS
    assert record.checklist_task is not None
    assert record.checklist_task.batch_reference == "BATCH-OPAQUE"

    record = mark_return_ready_for_disposition(actor=manager, record=record)
    upsert_return_quality_policy(
        actor=manager,
        organization=org,
        allowed_disposition_codes=[ReturnDisposition.RELEASE, ReturnDisposition.HOLD],
    )
    record = apply_return_disposition(
        actor=manager,
        record=record,
        disposition=ReturnDisposition.RELEASE,
        disposition_note="Synthetic local quality decision",
    )
    assert record.status == ReturnQualityStatus.DISPOSITIONED
    assert record.disposition == ReturnDisposition.RELEASE
    assert record.quarantine_state == ReturnQuarantineState.QUARANTINED
    assert record.not_saleable_via_app is True
    record.not_saleable_via_app = False
    record.save()
    record.refresh_from_db()
    assert record.not_saleable_via_app is True
    with pytest.raises(ValidationError):
        update_return_quantity(actor=manager, record=record, quantity_reference="QTY-LATE")


@pytest.mark.django_db
@override_settings(PRODUCT_RETURNS_ERP_STOCK_MOVEMENT_APPROVED=False)
def test_return_erp_movement_is_dual_gate_disabled_and_audited() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _return_manager(org=org)
    template, version = _published_return_checklist(manager, org)
    upsert_return_quality_policy(
        actor=manager,
        organization=org,
        erp_stock_movement_enabled=True,
        allowed_disposition_codes=[ReturnDisposition.HOLD],
        procedure_reference="EVIDENCE-REQUIRED-SYNTHETIC",
    )
    decision = evaluate_return_erp_stock_movement(organization_id=org.id)
    assert decision.allowed is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"
    record = create_return_quality_record(
        actor=manager,
        organization=org,
        erp_return_reference="RET-ERP-SYNTHETIC",
        product_reference="PRODUCT-OPAQUE",
        original_batch_reference="BATCH-ERP-OPAQUE",
    )
    record = start_return_inspection(
        actor=manager,
        record=record,
        checklist_template=template,
        checklist_version=version,
    )
    record = mark_return_ready_for_disposition(actor=manager, record=record)
    record = apply_return_disposition(
        actor=manager, record=record, disposition=ReturnDisposition.HOLD
    )
    with pytest.raises(IntegrationError) as exc:
        attempt_return_erp_stock_movement(actor=manager, record=record)
    assert exc.value.error_class == IntegrationErrorClass.OUTBOUND_NOT_APPROVED
    assert SecurityAuditEvent.objects.filter(
        event_type="RETURN_ERP_STOCK_MOVEMENT_BLOCKED",
        metadata__return_quality_record_id=str(record.id),
    ).exists()


@pytest.mark.django_db
def test_return_workflow_denies_cross_organization_access() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    manager_a = _return_manager(org=org_a)
    manager_b = _return_manager(org=org_b)
    template_a, version_a = _published_return_checklist(manager_a, org_a)
    record = create_return_quality_record(
        actor=manager_a,
        organization=org_a,
        erp_return_reference="RET-CROSS-ORG",
        product_reference="PRODUCT-OPAQUE",
        original_batch_reference="BATCH-CROSS-ORG",
    )
    with pytest.raises(PermissionDenied):
        update_return_quantity(actor=manager_b, record=record, quantity_reference="DENIED")
    with pytest.raises(PermissionDenied):
        start_return_inspection(
            actor=manager_b,
            record=record,
            checklist_template=template_a,
            checklist_version=version_a,
        )
    with pytest.raises(PermissionDenied):
        upsert_return_quality_policy(
            actor=manager_b,
            organization=org_a,
            allowed_disposition_codes=[ReturnDisposition.REJECT],
        )


@pytest.mark.django_db
def test_disposition_policy_allowlist_and_reject_path() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    manager = _return_manager(org=org)
    template, version = _published_return_checklist(manager, org)
    upsert_return_quality_policy(
        actor=manager,
        organization=org,
        allowed_disposition_codes=[ReturnDisposition.REJECT, ReturnDisposition.REWORK],
    )
    record = create_return_quality_record(
        actor=manager,
        organization=org,
        erp_return_reference="RET-DISP-SYNTHETIC",
        product_reference="PRODUCT-OPAQUE",
        original_batch_reference="BATCH-DISP",
    )
    record = start_return_inspection(
        actor=manager,
        record=record,
        checklist_template=template,
        checklist_version=version,
    )
    record = mark_return_ready_for_disposition(actor=manager, record=record)
    with pytest.raises(ValidationError):
        apply_return_disposition(
            actor=manager, record=record, disposition=ReturnDisposition.RELEASE
        )
    record = apply_return_disposition(
        actor=manager, record=record, disposition=ReturnDisposition.REJECT
    )
    assert record.disposition == ReturnDisposition.REJECT
    assert record.quarantine_state == ReturnQuarantineState.REJECTED
    assert record.not_saleable_via_app is True
