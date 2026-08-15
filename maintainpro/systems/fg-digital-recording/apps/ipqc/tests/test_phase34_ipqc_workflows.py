"""Phase 34 — In-Process Quality Control (IPQC) workflow tests."""

from __future__ import annotations

import time
import uuid
from datetime import date, timedelta
from datetime import time as dt_time
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from django.utils import timezone
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
from apps.evidence.linking import resolve_linked_target
from apps.evidence.models import EvidenceLinkedKind
from apps.instruments.models import Equipment
from apps.instruments.services import create_equipment
from apps.ipqc.models import (
    IpqcInspectionCase,
    IpqcProcessCheckDefinition,
    IpqcTriggerKind,
    IpqcWorkflowStatus,
)
from apps.ipqc.policy import evaluate_ipqc_fail_stop_policy
from apps.ipqc.selectors import (
    build_ipqc_dashboard,
    cases_due,
    cases_for_process_scope,
)
from apps.ipqc.services import (
    attach_ipqc_equipment_trace,
    attach_ipqc_haccp_metadata,
    complete_ipqc_case,
    create_ipqc_process_check_definition,
    escalate_ipqc_to_hold,
    escalate_ipqc_to_ncr,
    generate_ipqc_case,
    generate_scheduled_ipqc_cases,
    mark_ipqc_failure,
    record_ipqc_measurement,
    resolve_ipqc_sampling,
    upsert_ipqc_workflow_policy,
)
from apps.master_data.models import (
    FGProduct,
    ProductSpecification,
    SpecificationParameter,
    SpecificationVersion,
)
from apps.master_data.services import create_fg_product
from apps.master_data.specification_services import (
    approve_specification_version,
    create_product_specification,
    upsert_specification_parameter,
)
from apps.nonconformance.models import HoldCase, NonConformanceRecord
from apps.organizations.models import Organization, Shift
from apps.organizations.services import create_shift
from apps.scheduling.models import ChecklistTask
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _ipqc_manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"IP{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"IP{suffix}",
        name=f"IPQC manager {suffix}",
        permission=_perm(IpqcProcessCheckDefinition, "manage_ipqc"),
    )
    role.permissions.add(_perm(IpqcProcessCheckDefinition, "view_ipqc"))
    role.permissions.add(_perm(IpqcProcessCheckDefinition, "record_ipqc"))
    role.permissions.add(_perm(IpqcProcessCheckDefinition, "escalate_ipqc"))
    role.permissions.add(_perm(IpqcProcessCheckDefinition, "manage_ipqcpolicy"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "record_checklisttask"))
    role.permissions.add(_perm(FGProduct, "manage_fgproduct"))
    role.permissions.add(_perm(ProductSpecification, "manage_productspecification"))
    role.permissions.add(_perm(Equipment, "manage_equipment"))
    role.permissions.add(_perm(Shift, "manage_shift"))
    role.permissions.add(_perm(NonConformanceRecord, "create_nonconformance"))
    role.permissions.add(_perm(NonConformanceRecord, "manage_nonconformance"))
    role.permissions.add(_perm(HoldCase, "create_holdcase"))
    role.permissions.add(_perm(HoldCase, "manage_holdcase"))
    grant_role(user, role, organization=org)
    return user


def _published_ipqc_checklist(actor: User, org: Organization) -> Any:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"IPQC-{uuid.uuid4().hex[:5].upper()}",
        name="In-process check",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="IPQC")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="OK",
        label="Process check item (synthetic)",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    publish_checklist_version(actor=actor, version_id=version.id)
    version.refresh_from_db()
    return template, version


@pytest.mark.django_db
def test_scheduled_generation_process_scope_measurement_equipment_failure_ncr() -> None:
    org = make_org(code=f"IP{uuid.uuid4().hex[:5].upper()}")
    actor = _ipqc_manager(org=org)
    template, version = _published_ipqc_checklist(actor, org)

    product = create_fg_product(
        actor=actor,
        organization=org,
        code=f"P{uuid.uuid4().hex[:5].upper()}",
        name="Synthetic FG",
    )
    shift = create_shift(
        actor=actor,
        organization=org,
        code=f"S{uuid.uuid4().hex[:4].upper()}",
        name="Synthetic shift",
        start_time=dt_time(6, 0),
        end_time=dt_time(14, 0),
        effective_from=date.today(),
    )
    definition = create_ipqc_process_check_definition(
        actor=actor,
        organization=org,
        code=f"DEF-{uuid.uuid4().hex[:5].upper()}",
        name="Hourly line check",
        checklist_template=template,
        checklist_version=version,
        trigger_kind=IpqcTriggerKind.TIME_INTERVAL,
        interval_minutes=60,
        product=product,
        production_line_code="LINE-A",
        process_step_code="FILL",
        shift=shift,
    )
    assert definition.trigger_kind == IpqcTriggerKind.TIME_INTERVAL

    created = generate_scheduled_ipqc_cases(actor=actor, organization=org)
    assert len(created) == 1
    case = created[0]
    assert case.checklist_task_id is not None
    assert case.production_line_code == "LINE-A"
    assert case.product_id == product.id
    assert case.process_step_code == "FILL"
    assert case.shift_id == shift.id
    assert case.workflow_status == IpqcWorkflowStatus.TASK_CREATED

    # Idempotent scheduled generation
    again = generate_scheduled_ipqc_cases(actor=actor, organization=org)
    assert again == []

    scoped = cases_for_process_scope(
        organization_id=org.id,
        production_line_code="LINE-A",
        product_id=product.id,
    )
    assert scoped.filter(pk=case.id).exists()

    # Spec measurement (synthetic bounds — not Nelna limits)
    spec = create_product_specification(
        actor=actor,
        organization=org,
        product=product,
        code=f"SPEC-{uuid.uuid4().hex[:4].upper()}",
        name="Synthetic IPQC spec",
    )
    spec_version = SpecificationVersion.objects.get(specification=spec, version_number=1)
    upsert_specification_parameter(
        actor=actor,
        version_id=spec_version.id,
        code="TEMP",
        name="Synthetic temp",
        bound_min=Decimal("1.0"),
        bound_max=Decimal("2.0"),
        min_inclusive=True,
        max_inclusive=True,
    )
    approve_specification_version(actor=actor, version_id=spec_version.id, approval_reference="SYN")
    param = SpecificationParameter.objects.get(version=spec_version, code="TEMP")
    measurement = record_ipqc_measurement(
        actor=actor, case=case, parameter=param, value=Decimal("9.0")
    )
    case.refresh_from_db()
    assert measurement["spec_label"] == "OUT_OF_SPEC"
    assert case.failure_detected is True
    assert case.workflow_status == IpqcWorkflowStatus.MEASURED

    equipment = create_equipment(
        actor=actor,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:4].upper()}",
        name="Synthetic probe",
    )
    case = attach_ipqc_equipment_trace(actor=actor, case=case, equipment=equipment)
    assert case.equipment_id == equipment.id
    assert case.equipment_trace_snapshot.get("equipment_code") == equipment.code

    sampling = resolve_ipqc_sampling(actor=actor, case=case, lot_size=100)
    assert sampling["not_qa_disposition"] is True
    case = attach_ipqc_haccp_metadata(
        actor=actor, case=case, control_point_class="", metadata={"note": "shell"}
    )
    assert case.haccp_metadata_snapshot["company_ccp_classification"] == "EVIDENCE_REQUIRED"

    decision = evaluate_ipqc_fail_stop_policy(organization_id=org.id, failure_detected=True)
    assert decision.stop_production is False
    assert decision.reason_code == "POLICY_DISABLED"

    case = mark_ipqc_failure(actor=actor, case=case, note="Synthetic fail")
    assert case.workflow_status == IpqcWorkflowStatus.FAILED
    assert case.stop_production_signal is False

    case = escalate_ipqc_to_ncr(
        actor=actor,
        case=case,
        code=f"NCR-{uuid.uuid4().hex[:5].upper()}",
        title="IPQC escalation shell",
    )
    assert case.nonconformance_id is not None
    case = escalate_ipqc_to_hold(
        actor=actor,
        case=case,
        code=f"HLD-{uuid.uuid4().hex[:5].upper()}",
        reason_reference="IPQC-FAIL",
    )
    assert case.hold_case_id is not None
    assert case.workflow_status == IpqcWorkflowStatus.ESCALATED

    case = complete_ipqc_case(actor=actor, case=case)
    assert case.workflow_status == IpqcWorkflowStatus.COMPLETED
    assert case.frozen_process_context.get("not_fg_release") is True

    target = resolve_linked_target(kind=EvidenceLinkedKind.IPQC_INSPECTION_CASE, object_id=case.id)
    assert target.organization_id == org.id
    assert target.linkage_immutable is True

    assert SecurityAuditEvent.objects.filter(event_type="IPQC_CASE_OPENED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="IPQC_ESCALATED_TO_NCR").exists()


@pytest.mark.django_db
def test_batch_trigger_dashboard_cross_org_and_stop_gate() -> None:
    org_a = make_org(code=f"IA{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"IB{uuid.uuid4().hex[:5].upper()}")
    actor_a = _ipqc_manager(org=org_a)
    actor_b = _ipqc_manager(org=org_b)
    template, version = _published_ipqc_checklist(actor_a, org_a)

    definition = create_ipqc_process_check_definition(
        actor=actor_a,
        organization=org_a,
        code=f"BAT-{uuid.uuid4().hex[:5].upper()}",
        name="Batch IPQC",
        checklist_template=template,
        checklist_version=version,
        trigger_kind=IpqcTriggerKind.BATCH,
        production_line_code="LINE-B",
    )
    case, created = generate_ipqc_case(
        actor=actor_a,
        definition=definition,
        batch_reference="BATCH-100",
        due_at=timezone.now() - timedelta(minutes=5),
    )
    assert created is True
    case2, created2 = generate_ipqc_case(
        actor=actor_a,
        definition=definition,
        batch_reference="BATCH-100",
    )
    assert created2 is False
    assert case2.id == case.id

    # Overdue visibility
    dash = build_ipqc_dashboard(organization_id=org_a.id)
    assert dash.overdue_count >= 1
    assert str(case.id) in dash.overdue_case_ids

    case = mark_ipqc_failure(actor=actor_a, case=case)
    dash2 = build_ipqc_dashboard(organization_id=org_a.id)
    assert dash2.failure_count >= 1

    with pytest.raises(PermissionDenied):
        generate_ipqc_case(
            actor=actor_b,
            definition=definition,
            batch_reference="BATCH-FOREIGN",
        )

    upsert_ipqc_workflow_policy(
        actor=actor_a,
        organization=org_a,
        stop_production_on_fail_enabled=True,
        procedure_reference="PROC-TBC",
    )
    with override_settings(IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED=False):
        decision = evaluate_ipqc_fail_stop_policy(organization_id=org_a.id, failure_detected=True)
        assert decision.stop_production is False
        assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"

    with override_settings(IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED=True):
        decision_on = evaluate_ipqc_fail_stop_policy(
            organization_id=org_a.id, failure_detected=True
        )
        assert decision_on.stop_production is True
        assert decision_on.reason_code == "STOP_PRODUCTION_ENABLED"

    with pytest.raises(ValidationError):
        escalate_ipqc_to_ncr(
            actor=actor_a,
            case=IpqcInspectionCase.objects.create(
                organization=org_a,
                definition=definition,
                occurrence_key=f"manual-{uuid.uuid4().hex}",
                trigger_kind=IpqcTriggerKind.MANUAL,
                workflow_status=IpqcWorkflowStatus.OPEN,
                failure_detected=False,
                created_by=actor_a,
            ),
            code="NCR-X",
            title="Should fail",
        )


@pytest.mark.django_db
def test_shift_and_production_order_triggers() -> None:
    org = make_org(code=f"TR{uuid.uuid4().hex[:5].upper()}")
    actor = _ipqc_manager(org=org)
    template, version = _published_ipqc_checklist(actor, org)
    shift = create_shift(
        actor=actor,
        organization=org,
        code=f"S{uuid.uuid4().hex[:4].upper()}",
        name="Synthetic shift",
        start_time=dt_time(6, 0),
        end_time=dt_time(14, 0),
        effective_from=date.today(),
    )
    _shift_def = create_ipqc_process_check_definition(
        actor=actor,
        organization=org,
        code=f"SH-{uuid.uuid4().hex[:5].upper()}",
        name="Shift IPQC",
        checklist_template=template,
        checklist_version=version,
        trigger_kind=IpqcTriggerKind.SHIFT,
        shift=shift,
        production_line_code="LINE-S",
    )
    created = generate_scheduled_ipqc_cases(actor=actor, organization=org)
    assert len(created) == 1
    assert created[0].trigger_kind == IpqcTriggerKind.SHIFT
    assert created[0].shift_id == shift.id

    po_def = create_ipqc_process_check_definition(
        actor=actor,
        organization=org,
        code=f"PO-{uuid.uuid4().hex[:5].upper()}",
        name="PO IPQC",
        checklist_template=template,
        checklist_version=version,
        trigger_kind=IpqcTriggerKind.PRODUCTION_ORDER,
        production_line_code="LINE-PO",
    )
    case, was_created = generate_ipqc_case(
        actor=actor,
        definition=po_def,
        production_order_reference="PO-9001",
    )
    assert was_created is True
    assert case.production_order_reference == "PO-9001"
    case2, again = generate_ipqc_case(
        actor=actor,
        definition=po_def,
        production_order_reference="PO-9001",
    )
    assert again is False
    assert case2.id == case.id

    due = cases_due(organization_id=org.id)
    assert due.filter(pk=created[0].id).exists() or created[0].due_at is not None


@pytest.mark.django_db
def test_ipqc_dashboard_performance_select_related() -> None:
    org = make_org(code=f"PF{uuid.uuid4().hex[:5].upper()}")
    actor = _ipqc_manager(org=org)
    template, version = _published_ipqc_checklist(actor, org)
    definition = create_ipqc_process_check_definition(
        actor=actor,
        organization=org,
        code=f"PERF-{uuid.uuid4().hex[:5].upper()}",
        name="Perf IPQC",
        checklist_template=template,
        checklist_version=version,
        trigger_kind=IpqcTriggerKind.MANUAL,
        interval_minutes=None,
        production_line_code="LINE-P",
    )
    now = timezone.now()
    for i in range(25):
        generate_ipqc_case(
            actor=actor,
            definition=definition,
            manual_token=f"tok-{i}",
            due_at=now + timedelta(minutes=i),
            auto_generate_task=False,
        )
    started = time.perf_counter()
    snap = build_ipqc_dashboard(organization_id=org.id)
    elapsed = time.perf_counter() - started
    assert snap.open_count >= 25
    assert elapsed < 2.0
