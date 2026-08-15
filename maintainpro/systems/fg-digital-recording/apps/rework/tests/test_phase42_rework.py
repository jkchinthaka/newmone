"""Phase 42 — controlled rework management tests."""

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
from apps.batch_genealogy.models import (
    GenealogyEdge,
    GenealogyNode,
    GenealogyNodeKind,
    GenealogyRelationKind,
)
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.nonconformance.models import HoldCase, NonConformanceRecord
from apps.organizations.models import Organization
from apps.rework.models import ReworkCase, ReworkCaseEvent, ReworkPolicyStub
from apps.rework.policy import (
    evaluate_rework_erp_stock_movement,
    get_policy_value,
    rework_erp_stock_movement_approved,
)
from apps.rework.selectors import (
    get_case_for_org,
    list_cases_for_org,
    list_cases_for_source_batch,
    list_events_for_case,
)
from apps.rework.services import (
    assert_quantity_conservation,
    attempt_rework_erp_stock_movement,
    authorize_rework_case,
    cancel_rework_case,
    complete_rework_case,
    create_rework_case,
    open_rework_reinspection,
    reject_does_not_create_rework,
    start_rework_case,
    upsert_rework_policy,
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


def _rework_user(
    *,
    org: Organization,
    create: bool = True,
    authorize: bool = True,
    execute: bool = True,
    policy: bool = True,
    view: bool = True,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"RW{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RW{suffix}",
        name=f"Rework {suffix}",
        permission=_perm(ReworkCase, "view_reworkcase"),
    )
    if not view:
        role.permissions.remove(_perm(ReworkCase, "view_reworkcase"))
    if create:
        role.permissions.add(_perm(ReworkCase, "create_reworkcase"))
    if authorize:
        role.permissions.add(_perm(ReworkCase, "authorize_reworkcase"))
    if execute:
        role.permissions.add(_perm(ReworkCase, "execute_reworkcase"))
    if policy:
        role.permissions.add(_perm(ReworkCase, "manage_reworkpolicystub"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(GenealogyNode, "ingest_batchgenealogy"))
    grant_role(user, role, organization=org)
    return user


def _published_rework_checklist(actor: User, org: Organization) -> Any:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"RW-{uuid.uuid4().hex[:6].upper()}",
        name="Synthetic rework reinspection",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Rework inspection")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="REWORK-CHECK",
        label="Synthetic rework check",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    return template, publish_checklist_version(actor=actor, version_id=version.id)


def _seed_original_quality(org: Organization, actor: User, batch_ref: str) -> Any:
    ncr = NonConformanceRecord.objects.create(
        organization=org,
        code=f"NCR-{uuid.uuid4().hex[:6].upper()}",
        title="Original NCR must remain",
        batch_reference=batch_ref,
        created_by=actor,
        status="OPEN",
    )
    hold = HoldCase.objects.create(
        organization=org,
        code=f"HLD-{uuid.uuid4().hex[:6].upper()}",
        reason_reference="ORIGINAL-HOLD",
        batch_reference=batch_ref,
        opened_by=actor,
        status="OPEN",
    )
    return ncr, hold


def _run_to_authorized(actor: User, org: Organization, **kwargs: Any) -> ReworkCase:
    defaults: dict[str, Any] = {
        "execution_key": f"RW-EX-{uuid.uuid4().hex[:8].upper()}",
        "source_batch_reference": "BATCH-SRC",
        "source_quantity_reference": "10",
        "source_uom_reference": "KG",
        "reason_reference": "REASON-OPAQUE",
        "instruction_reference": "SOP-REWORK-TBC",
    }
    defaults.update(kwargs)
    case = create_rework_case(actor=actor, organization=org, **defaults)
    return authorize_rework_case(actor=actor, case=case)


@pytest.mark.django_db
def test_reject_does_not_automatically_create_rework() -> None:
    org = make_org(code=f"J{uuid.uuid4().hex[:6].upper()}")
    reject_does_not_create_rework()
    assert ReworkCase.objects.filter(organization=org).count() == 0
    # Creating a REJECT-labelled reason still requires explicit create + authorize.
    viewer = _rework_user(org=org, create=False, authorize=False, execute=False, policy=False)
    with pytest.raises(PermissionDenied):
        create_rework_case(
            actor=viewer,
            organization=org,
            execution_key="AUTO-FROM-REJECT",
            source_batch_reference="BATCH-REJ",
            source_quantity_reference="1",
            source_uom_reference="CS",
            reason_reference="QA-REJECT",
        )


@pytest.mark.django_db
def test_full_and_partial_rework_genealogy_and_quantity_conservation() -> None:
    org = make_org(code=f"F{uuid.uuid4().hex[:6].upper()}")
    actor = _rework_user(org=org)
    ncr, hold = _seed_original_quality(org, actor, "BATCH-FULL")
    ncr_updated = ncr.updated_at
    hold_updated = hold.updated_at
    hold_status = hold.status
    ncr_status = ncr.status

    full = _run_to_authorized(
        actor,
        org,
        execution_key="FULL-1",
        source_batch_reference="BATCH-FULL",
        source_quantity_reference="10",
        source_ncr=ncr,
        source_hold_case=hold,
    )
    full = start_rework_case(actor=actor, case=full)
    with pytest.raises(ValidationError):
        complete_rework_case(
            actor=actor,
            case=full,
            resulting_batch_reference="BATCH-FULL-RW",
            resulting_quantity_reference="7",
            remaining_source_quantity_reference="2",
        )
    full = complete_rework_case(
        actor=actor,
        case=full,
        resulting_batch_reference="BATCH-FULL-RW",
        resulting_quantity_reference="10",
        remaining_source_quantity_reference="0",
    )
    assert full.status == ReworkCase.Status.COMPLETED
    assert full.remaining_source_quantity_reference == "0"
    assert full.started_at is not None
    assert full.completed_at is not None

    partial = _run_to_authorized(
        actor,
        org,
        execution_key="PART-1",
        source_batch_reference="BATCH-PART",
        source_quantity_reference="10",
    )
    partial = start_rework_case(actor=actor, case=partial)
    partial = complete_rework_case(
        actor=actor,
        case=partial,
        resulting_batch_reference="BATCH-PART-RW",
        resulting_quantity_reference="4",
        remaining_source_quantity_reference="6",
    )
    assert partial.resulting_quantity_reference == "4"
    assert partial.remaining_source_quantity_reference == "6"

    edge = GenealogyEdge.objects.get(
        organization=org,
        source_system="nelna.rework",
        source_event_id=f"rework:{full.id}",
    )
    assert edge.relation == GenealogyRelationKind.REWORKED_FROM
    assert edge.from_node.kind == GenealogyNodeKind.FG_BATCH
    assert edge.from_node.external_key == "BATCH-FULL"
    assert edge.to_node.kind == GenealogyNodeKind.REWORK_BATCH
    assert edge.to_node.external_key == "BATCH-FULL-RW"

    ncr.refresh_from_db()
    hold.refresh_from_db()
    assert ncr.status == ncr_status
    assert hold.status == hold_status
    assert ncr.updated_at == ncr_updated
    assert hold.updated_at == hold_updated
    assert (
        list_cases_for_source_batch(organization_id=org.id, source_batch_reference="BATCH-FULL")
        .filter(pk=full.id)
        .exists()
    )
    assert (
        list_events_for_case(organization_id=org.id, case_id=full.id)
        .filter(event_type=ReworkCaseEvent.EventType.GENEALOGY_RECORDED)
        .exists()
    )
    assert SecurityAuditEvent.objects.filter(event_type="REWORK_CASE_COMPLETED").exists()


@pytest.mark.django_db
def test_new_inspection_does_not_reuse_source_release() -> None:
    org = make_org(code=f"I{uuid.uuid4().hex[:6].upper()}")
    actor = _rework_user(org=org)
    template, version = _published_rework_checklist(actor, org)
    case = _run_to_authorized(actor, org, source_batch_reference="BATCH-REL")
    case = start_rework_case(actor=actor, case=case)
    case = complete_rework_case(
        actor=actor,
        case=case,
        resulting_batch_reference="BATCH-REL-RW",
        resulting_quantity_reference="10",
        remaining_source_quantity_reference="0",
    )
    case = open_rework_reinspection(
        actor=actor,
        case=case,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
    )
    assert case.inspection_task_id is not None
    assert case.inspection_task is not None
    assert case.inspection_task.batch_reference == "BATCH-REL-RW"
    assert case.inspection_task.batch_reference != case.source_batch_reference
    again = open_rework_reinspection(
        actor=actor,
        case=case,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
    )
    assert again.inspection_task_id == case.inspection_task_id


@pytest.mark.django_db
def test_authorization_required_and_cross_org_denied() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    creator = _rework_user(org=org_a, authorize=False, execute=False)
    authorizer = _rework_user(org=org_a, create=False, execute=False)
    executor = _rework_user(org=org_a, create=False, authorize=False)
    other = _rework_user(org=org_b)
    case = create_rework_case(
        actor=creator,
        organization=org_a,
        execution_key="AUTH-1",
        source_batch_reference="BATCH-A",
        source_quantity_reference="5",
        source_uom_reference="KG",
        reason_reference="REASON",
    )
    with pytest.raises(PermissionDenied):
        authorize_rework_case(actor=creator, case=case)
    with pytest.raises(PermissionDenied):
        authorize_rework_case(actor=other, case=case)
    case = authorize_rework_case(actor=authorizer, case=case)
    with pytest.raises(PermissionDenied):
        start_rework_case(actor=authorizer, case=case)
    case = start_rework_case(actor=executor, case=case)
    with pytest.raises(PermissionDenied):
        complete_rework_case(
            actor=other,
            case=case,
            resulting_batch_reference="BATCH-A-RW",
            resulting_quantity_reference="5",
            remaining_source_quantity_reference="0",
        )


@pytest.mark.django_db
def test_duplicate_execution_is_idempotent_or_rejected() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    actor = _rework_user(org=org)
    first = create_rework_case(
        actor=actor,
        organization=org,
        execution_key="DUP-KEY",
        source_batch_reference="BATCH-D",
        source_quantity_reference="8",
        source_uom_reference="KG",
        reason_reference="REASON-D",
    )
    same = create_rework_case(
        actor=actor,
        organization=org,
        execution_key="DUP-KEY",
        source_batch_reference="BATCH-D",
        source_quantity_reference="8",
        source_uom_reference="KG",
        reason_reference="REASON-D",
    )
    assert same.id == first.id
    with pytest.raises(ValidationError):
        create_rework_case(
            actor=actor,
            organization=org,
            execution_key="DUP-KEY",
            source_batch_reference="BATCH-OTHER",
            source_quantity_reference="8",
            source_uom_reference="KG",
            reason_reference="REASON-D",
        )
    authorized = authorize_rework_case(actor=actor, case=first)
    assert authorize_rework_case(actor=actor, case=authorized).id == authorized.id
    started = start_rework_case(actor=actor, case=authorized)
    assert start_rework_case(actor=actor, case=started).started_at == started.started_at
    completed = complete_rework_case(
        actor=actor,
        case=started,
        resulting_batch_reference="BATCH-D-RW",
        resulting_quantity_reference="8",
        remaining_source_quantity_reference="0",
    )
    again = complete_rework_case(
        actor=actor,
        case=completed,
        resulting_batch_reference="BATCH-D-RW",
        resulting_quantity_reference="8",
        remaining_source_quantity_reference="0",
    )
    assert again.id == completed.id
    with pytest.raises(ValidationError):
        complete_rework_case(
            actor=actor,
            case=completed,
            resulting_batch_reference="BATCH-D-OTHER",
            resulting_quantity_reference="8",
            remaining_source_quantity_reference="0",
        )


@pytest.mark.django_db
@override_settings(REWORK_ERP_STOCK_MOVEMENT_APPROVED=False)
def test_erp_quantity_status_updates_remain_gated() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    actor = _rework_user(org=org)
    assert rework_erp_stock_movement_approved() is False
    upsert_rework_policy(
        actor=actor,
        organization=org,
        policy_key="erp-stock",
        policy_value_reference="OFF",
        erp_stock_movement_enabled=True,
    )
    case = _run_to_authorized(actor, org)
    decision = evaluate_rework_erp_stock_movement(organization_id=org.id)
    assert decision.allowed is False
    with pytest.raises(IntegrationError) as exc:
        attempt_rework_erp_stock_movement(actor=actor, case=case, correlation_id="corr-rw")
    assert exc.value.error_class == IntegrationErrorClass.OUTBOUND_NOT_APPROVED
    assert SecurityAuditEvent.objects.filter(
        event_type="REWORK_ERP_STOCK_MOVEMENT_BLOCKED"
    ).exists()
    cancelled = cancel_rework_case(actor=actor, case=case, detail_reference="STOP")
    assert cancelled.status == ReworkCase.Status.CANCELLED
    assert cancel_rework_case(actor=actor, case=cancelled).status == ReworkCase.Status.CANCELLED
    assert get_policy_value(organization_id=org.id, policy_key="erp-stock") == "OFF"
    assert ReworkPolicyStub.objects.filter(organization=org, policy_key="erp-stock").exists()


@pytest.mark.django_db
@override_settings(REWORK_ERP_STOCK_MOVEMENT_APPROVED=True)
def test_erp_adapter_remains_fail_closed_when_dual_gate_on() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    actor = _rework_user(org=org)
    missing = evaluate_rework_erp_stock_movement(organization_id=org.id)
    assert missing.allowed is False
    assert missing.reason_code == "ORG_POLICY_DISABLED"
    upsert_rework_policy(
        actor=actor,
        organization=org,
        policy_key="erp-stock-on",
        policy_value_reference="PROC-TBC",
        erp_stock_movement_enabled=True,
    )
    decision = evaluate_rework_erp_stock_movement(organization_id=org.id)
    assert decision.allowed is True
    case = create_rework_case(
        actor=actor,
        organization=org,
        execution_key="ERP-ON",
        source_batch_reference="BATCH-E2",
        source_quantity_reference="1",
        source_uom_reference="CS",
        reason_reference="REASON",
    )
    with pytest.raises(IntegrationError) as exc:
        attempt_rework_erp_stock_movement(actor=actor, case=case, correlation_id="corr-on")
    assert exc.value.error_class == IntegrationErrorClass.OUTBOUND_NOT_APPROVED


@pytest.mark.django_db
def test_quantity_conservation_opaque_and_invalid_paths() -> None:
    assert_quantity_conservation(
        source_quantity_reference="QTY-OPAQUE-SRC",
        resulting_quantity_reference="QTY-OPAQUE-RES",
        remaining_source_quantity_reference="QTY-OPAQUE-REM",
    )
    with pytest.raises(ValidationError):
        assert_quantity_conservation(
            source_quantity_reference="10",
            resulting_quantity_reference="QTY-OPAQUE",
            remaining_source_quantity_reference="0",
        )
    with pytest.raises(ValidationError):
        assert_quantity_conservation(
            source_quantity_reference="QTY-OPAQUE-SRC",
            resulting_quantity_reference="",
            remaining_source_quantity_reference="QTY-OPAQUE-REM",
        )
    with pytest.raises(ValidationError):
        assert_quantity_conservation(
            source_quantity_reference="10",
            resulting_quantity_reference="-1",
            remaining_source_quantity_reference="11",
        )
    with pytest.raises(ValidationError):
        assert_quantity_conservation(
            source_quantity_reference="10",
            resulting_quantity_reference="0",
            remaining_source_quantity_reference="10",
        )


@pytest.mark.django_db
def test_lifecycle_guards_and_selectors() -> None:
    org = make_org(code=f"G{uuid.uuid4().hex[:6].upper()}")
    actor = _rework_user(org=org)
    with pytest.raises(ValidationError):
        create_rework_case(
            actor=actor,
            organization=org,
            execution_key="   ",
            source_batch_reference="BATCH-G",
            source_quantity_reference="2",
            source_uom_reference="CS",
            reason_reference="REASON",
        )
    case = create_rework_case(
        actor=actor,
        organization=org,
        execution_key="GUARD-1",
        source_batch_reference="BATCH-G",
        source_quantity_reference="2",
        source_uom_reference="CS",
        reason_reference="REASON",
    )
    with pytest.raises(ValidationError):
        start_rework_case(actor=actor, case=case)
    with pytest.raises(ValidationError):
        open_rework_reinspection(
            actor=actor,
            case=case,
            checklist_template_id=uuid.uuid4(),
            checklist_version_id=uuid.uuid4(),
        )
    case = authorize_rework_case(actor=actor, case=case)
    case = start_rework_case(actor=actor, case=case)
    with pytest.raises(ValidationError):
        complete_rework_case(
            actor=actor,
            case=case,
            resulting_batch_reference="BATCH-G",
            resulting_quantity_reference="2",
            remaining_source_quantity_reference="0",
        )
    case = complete_rework_case(
        actor=actor,
        case=case,
        resulting_batch_reference="BATCH-G-RW",
        resulting_quantity_reference="2",
        remaining_source_quantity_reference="0",
    )
    with pytest.raises(ValidationError):
        cancel_rework_case(actor=actor, case=case)
    loaded = get_case_for_org(organization_id=org.id, case_id=case.id)
    assert loaded.id == case.id
    assert list_cases_for_org(organization_id=org.id).filter(pk=case.id).exists()
    with pytest.raises(PermissionDenied):
        create_rework_case(
            actor=None,
            organization=org,
            execution_key="NO-AUTH",
            source_batch_reference="BATCH-G",
            source_quantity_reference="1",
            source_uom_reference="CS",
            reason_reference="REASON",
        )


@pytest.mark.django_db
def test_policy_stub_helper_and_execute_denied() -> None:
    from apps.rework.policy import upsert_policy_stub

    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    actor = _rework_user(org=org)
    viewer = _rework_user(org=org, create=False, authorize=False, execute=False, policy=False)
    stub = upsert_policy_stub(
        organization=org,
        policy_key="helper",
        policy_value_reference="VAL",
        actor=actor,
    )
    assert stub.policy_value_reference == "VAL"
    assert str(stub)
    case = create_rework_case(
        actor=actor,
        organization=org,
        execution_key="DENY-1",
        source_batch_reference="BATCH-H",
        source_quantity_reference="1",
        source_uom_reference="CS",
        reason_reference="REASON",
    )
    assert str(case)
    with pytest.raises(PermissionDenied):
        attempt_rework_erp_stock_movement(actor=viewer, case=case)
    started = start_rework_case(actor=actor, case=authorize_rework_case(actor=actor, case=case))
    with pytest.raises(ValidationError):
        complete_rework_case(
            actor=actor,
            case=started,
            resulting_batch_reference="",
            resulting_quantity_reference="1",
            remaining_source_quantity_reference="0",
        )
    assert_quantity_conservation(
        source_quantity_reference="not-a-decimal-qty",
        resulting_quantity_reference="also-opaque",
        remaining_source_quantity_reference="still-opaque",
    )
    decision = evaluate_rework_erp_stock_movement(organization_id=org.id)
    assert decision.as_dict()["allowed"] is False
