"""Phase 33 — IQC incoming inspection workflow tests."""

from __future__ import annotations

import uuid
from decimal import Decimal
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
from apps.evidence.linking import resolve_linked_target
from apps.evidence.models import EvidenceLinkedKind
from apps.integrations.errors import IntegrationError
from apps.iqc.models import IncomingReceiptEvent, IqcWorkflowStatus
from apps.iqc.policy import evaluate_iqc_erp_outbound
from apps.iqc.selectors import cases_for_supplier_lot
from apps.iqc.services import (
    attach_iqc_review,
    attempt_case_erp_outbound,
    complete_iqc_disposition,
    generate_iqc_task,
    ingest_incoming_receipt_event,
    link_iqc_lab_sample,
    open_iqc_case_for_receipt,
    resolve_iqc_sampling,
    upsert_iqc_workflow_policy,
)
from apps.laboratory.models import LabSample
from apps.organizations.models import Organization
from apps.receiving.models import MaterialReference, ReceiptQualityState
from apps.receiving.services import create_material_reference, create_receipt_quality_record
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.reviews.models import SupervisorReviewDecision
from apps.reviews.services import create_supervisor_review
from apps.scheduling.models import ChecklistTask
from apps.security_audit.models import SecurityAuditEvent
from apps.supplier_quality.models import SupplierQualityProfile
from apps.supplier_quality.services import create_supplier_quality_profile


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _iqc_manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"IQ{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"IQ{suffix}",
        name=f"IQC manager {suffix}",
        permission=_perm(IncomingReceiptEvent, "manage_iqc"),
    )
    role.permissions.add(_perm(IncomingReceiptEvent, "view_iqc"))
    role.permissions.add(_perm(IncomingReceiptEvent, "disposition_iqc"))
    role.permissions.add(_perm(IncomingReceiptEvent, "manage_iqcpolicy"))
    role.permissions.add(_perm(MaterialReference, "manage_materialreference"))
    role.permissions.add(_perm(MaterialReference, "manage_receiptquality"))
    role.permissions.add(_perm(MaterialReference, "disposition_receiptquality"))
    role.permissions.add(_perm(MaterialReference, "view_receiptquality"))
    role.permissions.add(_perm(SupplierQualityProfile, "manage_supplierquality_qa"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "record_checklisttask"))
    role.permissions.add(_perm(LabSample, "register_labsample"))
    role.permissions.add(_perm(LabSample, "view_laboratory"))
    grant_role(user, role, organization=org)
    return user


def _supervisor(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"SV{suffix}", is_staff=True)
    from apps.reviews.models import SupervisorReview

    role = make_role_with_permission(
        code=f"SV{suffix}",
        name=f"Supervisor {suffix}",
        permission=_perm(SupervisorReview, "review_checklistsubmission"),
    )
    grant_role(user, role, organization=org)
    return user


def _published_iqc_checklist(actor: User, org: Organization) -> Any:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"IQC-{uuid.uuid4().hex[:5].upper()}",
        name="Incoming inspection",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="IQC")
    item = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="OK",
        label="Acceptable?",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return template, published, item


@pytest.mark.django_db
def test_receipt_mapping_task_sampling_lab_review_disposition() -> None:
    org = make_org(code=f"I{uuid.uuid4().hex[:6].upper()}")
    manager = _iqc_manager(org=org)
    supervisor = _supervisor(org=org)
    template, version, item = _published_iqc_checklist(manager, org)
    supplier = create_supplier_quality_profile(
        actor=manager,
        organization=org,
        erp_supplier_reference=f"SUP-{uuid.uuid4().hex[:5].upper()}",
    )
    material = create_material_reference(
        actor=manager,
        organization=org,
        erp_material_reference=f"MAT-{uuid.uuid4().hex[:5].upper()}",
        uom_reference="KG",
    )
    receipt = create_receipt_quality_record(
        actor=manager,
        organization=org,
        erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:5].upper()}",
        supplier_profile=supplier,
        supplier_lot="LOT-IQC-001",
        material=material,
        quantity=Decimal("50"),
        uom="KG",
        inspection_checklist_template=template,
        inspection_checklist_version=version,
    )
    case = open_iqc_case_for_receipt(actor=manager, receipt=receipt)
    case = generate_iqc_task(actor=manager, case=case)
    assert case.checklist_task_id is not None
    assert case.workflow_status == IqcWorkflowStatus.TASK_CREATED

    sampling = resolve_iqc_sampling(actor=manager, case=case)
    assert sampling["not_qa_disposition"] is True
    case.refresh_from_db()
    assert "reason_code" in case.sampling_snapshot

    lab = link_iqc_lab_sample(
        actor=manager, case=case, sample_code=f"S-{uuid.uuid4().hex[:5].upper()}"
    )
    assert lab["lab_sample_id"]

    record = start_checklist_recording(actor=manager, task_id=case.checklist_task_id)
    save_checklist_draft_responses(
        actor=manager,
        record_id=record.id,
        answers={(item.id, 1): "YES"},
    )
    submission = submit_checklist_record(actor=manager, record_id=record.id)
    review = create_supervisor_review(
        actor=supervisor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="OK",
    )
    case = attach_iqc_review(
        actor=manager,
        case=case,
        checklist_submission=submission,
        supervisor_review=review,
    )
    case = complete_iqc_disposition(
        actor=manager, case=case, quality_state="ACCEPTED", disposition_notes="Local accept"
    )
    case.refresh_from_db()
    assert case.workflow_status == IqcWorkflowStatus.DISPOSITIONED
    assert case.receipt.quality_state == ReceiptQualityState.ACCEPTED
    frozen = case.frozen_traceability_context
    assert frozen["supplier_lot"] == "LOT-IQC-001"
    assert frozen["erp_inventory_not_updated"] is True
    assert (
        cases_for_supplier_lot(organization_id=org.id, supplier_lot="LOT-IQC-001")
        .filter(pk=case.id)
        .exists()
    )
    target = resolve_linked_target(kind=EvidenceLinkedKind.IQC_INSPECTION_CASE, object_id=case.id)
    assert target.organization_id == org.id

    # Separate receipt: disposition blocked without review when required
    receipt2 = create_receipt_quality_record(
        actor=manager,
        organization=org,
        erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:5].upper()}",
        supplier_profile=supplier,
        supplier_lot="LOT-IQC-002",
        material=material,
        quantity=Decimal("5"),
        inspection_checklist_template=template,
        inspection_checklist_version=version,
    )
    case2 = open_iqc_case_for_receipt(actor=manager, receipt=receipt2)
    assert case2.review_required is True
    with pytest.raises(ValidationError):
        complete_iqc_disposition(actor=manager, case=case2, quality_state="ACCEPTED")


@pytest.mark.django_db
def test_duplicate_receipt_event_and_cross_org() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    mgr_a = _iqc_manager(org=org_a)
    mgr_b = _iqc_manager(org=org_b)
    template, version, _ = _published_iqc_checklist(mgr_a, org_a)
    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    event1, case1, dup1 = ingest_incoming_receipt_event(
        actor=mgr_a,
        organization=org_a,
        source_system="ERP-MOCK",
        source_event_id=event_id,
        erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:5].upper()}",
        supplier_lot="LOT-DUP",
        erp_material_reference=f"MAT-{uuid.uuid4().hex[:5].upper()}",
        erp_supplier_reference=f"SUP-{uuid.uuid4().hex[:5].upper()}",
        quantity=Decimal("10"),
        checklist_template=template,
        checklist_version=version,
        auto_generate_task=True,
    )
    assert dup1 is False
    assert case1 is not None
    assert case1.checklist_task_id is not None
    event2, case2, dup2 = ingest_incoming_receipt_event(
        actor=mgr_a,
        organization=org_a,
        source_system="ERP-MOCK",
        source_event_id=event_id,
        erp_receipt_reference=event1.erp_receipt_reference,
        supplier_lot="LOT-DUP",
        erp_material_reference=event1.erp_material_reference,
        auto_generate_task=False,
    )
    assert dup2 is True
    assert event2.id == event1.id
    assert case2 is not None and case2.id == case1.id
    assert SecurityAuditEvent.objects.filter(event_type="IQC_RECEIPT_EVENT_DUPLICATE").exists()

    with pytest.raises(PermissionDenied):
        ingest_incoming_receipt_event(
            actor=mgr_b,
            organization=org_a,
            source_system="ERP-MOCK",
            source_event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            erp_receipt_reference="GRN-X",
            supplier_lot="LOT-X",
            erp_material_reference="MAT-X",
        )


@pytest.mark.django_db
@override_settings(IQC_ERP_OUTBOUND_APPROVED=False)
def test_erp_outbound_blocked_and_authorization() -> None:
    org = make_org(code=f"I{uuid.uuid4().hex[:6].upper()}")
    manager = _iqc_manager(org=org)
    upsert_iqc_workflow_policy(
        actor=manager,
        organization=org,
        review_required=False,
        erp_outbound_enabled=True,
        procedure_reference="SOP-OPAQUE",
    )
    decision = evaluate_iqc_erp_outbound(organization_id=org.id)
    assert decision.allowed is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"

    template, version, _ = _published_iqc_checklist(manager, org)
    supplier = create_supplier_quality_profile(
        actor=manager,
        organization=org,
        erp_supplier_reference=f"SUP-{uuid.uuid4().hex[:5].upper()}",
    )
    material = create_material_reference(
        actor=manager,
        organization=org,
        erp_material_reference=f"MAT-{uuid.uuid4().hex[:5].upper()}",
    )
    receipt = create_receipt_quality_record(
        actor=manager,
        organization=org,
        erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:5].upper()}",
        supplier_profile=supplier,
        supplier_lot="LOT-ERP",
        material=material,
        inspection_checklist_template=template,
        inspection_checklist_version=version,
    )
    case = open_iqc_case_for_receipt(actor=manager, receipt=receipt)
    # review_required from policy is False for new cases only if opened after policy
    case.review_required = False
    case.save(update_fields=["review_required", "updated_at"])
    case = complete_iqc_disposition(actor=manager, case=case, quality_state="HOLD")
    with pytest.raises(IntegrationError):
        attempt_case_erp_outbound(actor=manager, case=case)
    assert SecurityAuditEvent.objects.filter(event_type="IQC_ERP_OUTBOUND_BLOCKED").exists()

    outsider = make_user(employee_code=f"XX{uuid.uuid4().hex[:6].upper()}")
    with pytest.raises(PermissionDenied):
        generate_iqc_task(actor=outsider, case=case)
