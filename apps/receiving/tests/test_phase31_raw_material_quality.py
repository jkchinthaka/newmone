"""Phase 31 — raw material receiving quality foundation tests."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
)
from apps.evidence.linking import resolve_linked_target
from apps.evidence.models import EvidenceLinkedKind
from apps.integrations.errors import IntegrationError
from apps.laboratory.models import LabSample
from apps.organizations.models import Organization
from apps.receiving.erp_boundary import prepare_receipt_quality_outbound
from apps.receiving.models import MaterialReference, ReceiptQualityState
from apps.receiving.selectors import receipts_for_erp_grn, receipts_for_supplier_lot
from apps.receiving.services import (
    approve_material_specification_version,
    attempt_erp_outbound_for_receipt,
    create_material_reference,
    create_material_specification,
    create_receipt_quality_record,
    link_lab_sample_to_receipt,
    register_incoming_lab_sample,
    set_receipt_quality_disposition,
)
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


def _qa(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"RQ{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RQ{suffix}",
        name=f"Receiving QA {suffix}",
        permission=_perm(MaterialReference, "manage_receiptquality"),
    )
    role.permissions.add(_perm(MaterialReference, "view_receiptquality"))
    role.permissions.add(_perm(MaterialReference, "manage_materialreference"))
    role.permissions.add(_perm(MaterialReference, "manage_materialspecification"))
    role.permissions.add(_perm(MaterialReference, "approve_materialspecification"))
    role.permissions.add(_perm(MaterialReference, "disposition_receiptquality"))
    role.permissions.add(_perm(SupplierQualityProfile, "manage_supplierquality_qa"))
    role.permissions.add(_perm(LabSample, "register_labsample"))
    role.permissions.add(_perm(LabSample, "view_laboratory"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _inspector_only(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"IN{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"IN{suffix}",
        name=f"Inspector {suffix}",
        permission=_perm(MaterialReference, "manage_receiptquality"),
    )
    role.permissions.add(_perm(MaterialReference, "view_receiptquality"))
    grant_role(user, role, organization=org)
    return user


def _checklist(actor: User, org: Organization) -> Any:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"CL-{uuid.uuid4().hex[:5].upper()}",
        name="Incoming inspection shell",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Insp")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="INSP",
        label="Inspect",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    return template, version


@pytest.mark.django_db
def test_supplier_lot_material_mapping_inspection_lab_and_state() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    qa = _qa(org=org)
    supplier = create_supplier_quality_profile(
        actor=qa,
        organization=org,
        erp_supplier_reference=f"SUP-{uuid.uuid4().hex[:6].upper()}",
        display_name="Supplier shell",
    )
    material = create_material_reference(
        actor=qa,
        organization=org,
        erp_material_reference=f"MAT-{uuid.uuid4().hex[:6].upper()}",
        display_name="Material shell",
        uom_reference="KG",
    )
    spec = create_material_specification(
        actor=qa,
        organization=org,
        material=material,
        code=f"MS-{uuid.uuid4().hex[:5].upper()}",
        title="Material spec shell",
    )
    version = spec.versions.get(version_number=1)
    approve_material_specification_version(
        actor=qa, version=version, approval_reference="APR-OPAQUE"
    )
    version.refresh_from_db()
    template, cl_version = _checklist(qa, org)

    receipt = create_receipt_quality_record(
        actor=qa,
        organization=org,
        erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:6].upper()}",
        supplier_profile=supplier,
        supplier_lot="LOT-OPAQUE-001",
        material=material,
        quantity=Decimal("100.5"),
        uom="KG",
        inspection_checklist_template=template,
        inspection_checklist_version=cl_version,
        material_specification_version=version,
        evidence_object_key="private/receiving/coa.pdf",
    )
    assert receipt.quality_state == ReceiptQualityState.PENDING_INSPECTION
    assert receipt.frozen_receipt_context["erp_inventory_not_updated"] is True
    assert receipt.frozen_receipt_context["supplier_lot"] == "LOT-OPAQUE-001"
    assert (
        receipts_for_supplier_lot(organization_id=org.id, supplier_lot="LOT-OPAQUE-001")
        .filter(pk=receipt.id)
        .exists()
    )
    assert (
        receipts_for_erp_grn(
            organization_id=org.id, erp_receipt_reference=receipt.erp_receipt_reference
        )
        .filter(pk=receipt.id)
        .exists()
    )

    sample, link = register_incoming_lab_sample(
        actor=qa, receipt=receipt, sample_code=f"S-{uuid.uuid4().hex[:5].upper()}"
    )
    assert link.lab_sample_id == sample.id
    assert sample.batch_reference == receipt.erp_receipt_reference
    assert sample.sub_lot_reference == "LOT-OPAQUE-001"

    set_receipt_quality_disposition(
        actor=qa,
        receipt=receipt,
        quality_state="HOLD",
        disposition_notes="Local hold only",
    )
    receipt.refresh_from_db()
    assert receipt.quality_state == ReceiptQualityState.HOLD
    frozen = dict(receipt.frozen_receipt_context)
    receipt.supplier_lot = "LOT-RENAMED-LATER"
    receipt.save(update_fields=["supplier_lot", "updated_at"])
    receipt.refresh_from_db()
    assert receipt.frozen_receipt_context["supplier_lot"] == frozen["supplier_lot"]

    target = resolve_linked_target(
        kind=EvidenceLinkedKind.RECEIPT_QUALITY_RECORD, object_id=receipt.id
    )
    assert target.organization_id == org.id
    assert SecurityAuditEvent.objects.filter(
        event_type="RECEIVING_RECEIPT_QUALITY_CREATED"
    ).exists()
    assert SecurityAuditEvent.objects.filter(event_type="RECEIVING_LAB_SAMPLE_LINKED").exists()


@pytest.mark.django_db
def test_authorization_cross_org_and_erp_boundary() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    qa_a = _qa(org=org_a)
    qa_b = _qa(org=org_b)
    inspector = _inspector_only(org=org_a)
    supplier_a = create_supplier_quality_profile(
        actor=qa_a,
        organization=org_a,
        erp_supplier_reference=f"SUP-{uuid.uuid4().hex[:5].upper()}",
    )
    material_a = create_material_reference(
        actor=qa_a,
        organization=org_a,
        erp_material_reference=f"MAT-{uuid.uuid4().hex[:5].upper()}",
    )
    material_b = create_material_reference(
        actor=qa_b,
        organization=org_b,
        erp_material_reference=f"MAT-{uuid.uuid4().hex[:5].upper()}",
    )
    with pytest.raises(ValidationError):
        create_receipt_quality_record(
            actor=qa_a,
            organization=org_a,
            erp_receipt_reference="GRN-X",
            supplier_profile=supplier_a,
            supplier_lot="LOT-X",
            material=material_b,
        )
    with pytest.raises(PermissionDenied):
        create_receipt_quality_record(
            actor=qa_b,
            organization=org_a,
            erp_receipt_reference="GRN-Y",
            supplier_profile=supplier_a,
            supplier_lot="LOT-Y",
            material=material_a,
        )
    receipt = create_receipt_quality_record(
        actor=qa_a,
        organization=org_a,
        erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:5].upper()}",
        supplier_profile=supplier_a,
        supplier_lot="LOT-AUTH",
        material=material_a,
    )
    with pytest.raises(PermissionDenied):
        set_receipt_quality_disposition(actor=inspector, receipt=receipt, quality_state="ACCEPTED")
    set_receipt_quality_disposition(actor=qa_a, receipt=receipt, quality_state="ACCEPTED")
    cmd = prepare_receipt_quality_outbound(receipt=receipt)
    assert cmd.quality_state == ReceiptQualityState.ACCEPTED
    with pytest.raises(IntegrationError):
        attempt_erp_outbound_for_receipt(actor=qa_a, receipt=receipt)
    assert SecurityAuditEvent.objects.filter(event_type="RECEIVING_ERP_OUTBOUND_BLOCKED").exists()


@pytest.mark.django_db
def test_draft_spec_cannot_link_and_lab_link_requires_same_org() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    qa = _qa(org=org)
    supplier = create_supplier_quality_profile(
        actor=qa,
        organization=org,
        erp_supplier_reference=f"SUP-{uuid.uuid4().hex[:5].upper()}",
    )
    material = create_material_reference(
        actor=qa,
        organization=org,
        erp_material_reference=f"MAT-{uuid.uuid4().hex[:5].upper()}",
    )
    spec = create_material_specification(
        actor=qa,
        organization=org,
        material=material,
        code=f"MS-{uuid.uuid4().hex[:5].upper()}",
        title="Draft only",
    )
    draft = spec.versions.get(version_number=1)
    with pytest.raises(ValidationError):
        create_receipt_quality_record(
            actor=qa,
            organization=org,
            erp_receipt_reference="GRN-DRAFT",
            supplier_profile=supplier,
            supplier_lot="LOT-D",
            material=material,
            material_specification_version=draft,
        )
    receipt = create_receipt_quality_record(
        actor=qa,
        organization=org,
        erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:5].upper()}",
        supplier_profile=supplier,
        supplier_lot="LOT-LINK",
        material=material,
    )
    sample, _ = register_incoming_lab_sample(
        actor=qa, receipt=receipt, sample_code=f"S-{uuid.uuid4().hex[:5].upper()}"
    )
    with pytest.raises(ValidationError):
        link_lab_sample_to_receipt(actor=qa, receipt=receipt, lab_sample=sample)


@pytest.mark.django_db
def test_spec_parameters_selectors_and_rejected_state() -> None:
    from django.contrib.admin.sites import AdminSite

    from apps.receiving.admin import SoftRetentionAdmin
    from apps.receiving.selectors import (
        materials_for_organization,
        receipts_for_organization,
    )
    from apps.receiving.services import add_material_specification_parameter

    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    qa = _qa(org=org)
    supplier = create_supplier_quality_profile(
        actor=qa,
        organization=org,
        erp_supplier_reference=f"SUP-{uuid.uuid4().hex[:5].upper()}",
    )
    material = create_material_reference(
        actor=qa,
        organization=org,
        erp_material_reference=f"MAT-{uuid.uuid4().hex[:5].upper()}",
        display_name="Param shell",
    )
    assert materials_for_organization(org.id).filter(pk=material.id).exists()

    with pytest.raises(ValidationError):
        create_material_reference(
            actor=qa,
            organization=org,
            erp_material_reference="",
        )

    spec = create_material_specification(
        actor=qa,
        organization=org,
        material=material,
        code=f"MS-{uuid.uuid4().hex[:5].upper()}",
        title="Spec with optional bounds shell",
    )
    draft = spec.versions.get(version_number=1)
    param = add_material_specification_parameter(
        actor=qa,
        version=draft,
        code="P1",
        name="Opaque parameter",
        unit="%",
        bound_min=None,  # no invented limit
        bound_max=None,
        notes="Bounds EVIDENCE REQUIRED",
    )
    assert param.bound_min is None
    assert param.bound_max is None
    with pytest.raises(ValidationError):
        add_material_specification_parameter(actor=qa, version=draft, code="", name="")
    approve_material_specification_version(actor=qa, version=draft)
    draft.refresh_from_db()
    with pytest.raises(ValidationError):
        add_material_specification_parameter(
            actor=qa,
            version=draft,
            code="P2",
            name="After approve",
        )
    with pytest.raises(ValidationError):
        approve_material_specification_version(actor=qa, version=draft)

    receipt = create_receipt_quality_record(
        actor=qa,
        organization=org,
        erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:5].upper()}",
        supplier_profile=supplier,
        supplier_lot="LOT-REJ",
        material=material,
        quantity="12.25",
        uom="KG",
        material_specification_version=draft,
    )
    assert receipts_for_organization(org.id).filter(pk=receipt.id).exists()
    with pytest.raises(ValidationError):
        create_receipt_quality_record(
            actor=qa,
            organization=org,
            erp_receipt_reference=f"GRN-{uuid.uuid4().hex[:5].upper()}",
            supplier_profile=supplier,
            supplier_lot="LOT-BADQTY",
            material=material,
            quantity="not-a-number",
        )
    with pytest.raises(ValidationError):
        create_receipt_quality_record(
            actor=qa,
            organization=org,
            erp_receipt_reference=receipt.erp_receipt_reference,
            supplier_profile=supplier,
            supplier_lot="LOT-REJ",
            material=material,
        )

    set_receipt_quality_disposition(
        actor=qa,
        receipt=receipt,
        quality_state="REJECTED",
        disposition_notes="Local reject only — ERP stock unchanged",
    )
    receipt.refresh_from_db()
    assert receipt.quality_state == ReceiptQualityState.REJECTED
    assert receipt.frozen_receipt_context["erp_inventory_not_updated"] is True
    assert SecurityAuditEvent.objects.filter(
        event_type="RECEIVING_RECEIPT_QUALITY_DISPOSITIONED"
    ).exists()
    assert SecurityAuditEvent.objects.filter(event_type="RECEIVING_MATERIAL_SPEC_APPROVED").exists()
    assert SecurityAuditEvent.objects.filter(
        event_type="RECEIVING_MATERIAL_REFERENCE_CREATED"
    ).exists()

    with pytest.raises(ValidationError):
        set_receipt_quality_disposition(
            actor=qa, receipt=receipt, quality_state="PENDING_INSPECTION"
        )

    admin = SoftRetentionAdmin(MaterialReference, AdminSite())
    assert admin.has_delete_permission(request=None) is False
    assert str(material)
    assert str(receipt)
