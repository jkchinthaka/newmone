"""Receiving quality services — Phase 31.

ERP owns inventory. Local quality states do not update ERP stock.
Does not invent material catalogues or specification limits.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate, ChecklistVersion
from apps.laboratory.models import LabSample
from apps.laboratory.services import register_lab_sample
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code
from apps.receiving.erp_boundary import (
    prepare_receipt_quality_outbound,
    send_receipt_quality_to_erp,
)
from apps.receiving.models import (
    MaterialReference,
    MaterialSpecification,
    MaterialSpecificationParameter,
    MaterialSpecificationVersion,
    MaterialSpecStatus,
    ReceiptLabSampleLink,
    ReceiptQualityRecord,
    ReceiptQualityState,
    ReceivingHistoryEntry,
)
from apps.receiving.snapshots import build_frozen_receipt_context
from apps.security_audit.services import record_event
from apps.supplier_quality.models import SupplierQualityProfile

MANAGE_MATERIAL = "receiving.manage_materialreference"
MANAGE_RECEIPT = "receiving.manage_receiptquality"
DISPOSITION = "receiving.disposition_receiptquality"
VIEW = "receiving.view_receiptquality"
MANAGE_SPEC = "receiving.manage_materialspecification"
APPROVE_SPEC = "receiving.approve_materialspecification"


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _org_scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _history(
    *,
    organization_id: uuid.UUID,
    actor: User,
    event_type: str,
    receipt: ReceiptQualityRecord | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> ReceivingHistoryEntry:
    return ReceivingHistoryEntry.objects.create(
        organization_id=organization_id,
        receipt=receipt,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _parse_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({"quantity": "Invalid quantity."}) from exc


@transaction.atomic
def create_material_reference(
    *,
    actor: User | None,
    organization: Organization,
    erp_material_reference: str,
    display_name: str = "",
    uom_reference: str = "",
    notes: str = "",
) -> MaterialReference:
    user = _require_actor(actor)
    require_permission(user, MANAGE_MATERIAL, scope=_org_scope(organization.id))
    erp_ref = (erp_material_reference or "").strip()
    if not erp_ref:
        raise ValidationError({"erp_material_reference": "ERP material reference is required."})
    try:
        material = MaterialReference.objects.create(
            organization=organization,
            erp_material_reference=erp_ref,
            display_name=(display_name or "").strip()[:255],
            uom_reference=(uom_reference or "").strip()[:32],
            notes=(notes or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError(
            {"erp_material_reference": "Material ERP reference already exists."}
        ) from exc
    record_event(
        event_type="RECEIVING_MATERIAL_REFERENCE_CREATED",
        actor=user,
        metadata={
            "material_id": str(material.id),
            "erp_material_reference": material.erp_material_reference,
        },
    )
    return material


@transaction.atomic
def create_material_specification(
    *,
    actor: User | None,
    organization: Organization,
    material: MaterialReference,
    code: str,
    title: str,
    description: str = "",
) -> MaterialSpecification:
    user = _require_actor(actor)
    require_permission(user, MANAGE_SPEC, scope=_org_scope(organization.id))
    if material.organization_id != organization.id:
        raise ValidationError({"material": "Material must belong to the organization."})
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Specification code and title are required."})
    try:
        spec = MaterialSpecification.objects.create(
            organization=organization,
            material=material,
            code=normalized,
            title=title.strip(),
            description=(description or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Specification code already exists."}) from exc
    MaterialSpecificationVersion.objects.create(
        specification=spec,
        version_number=1,
        status=MaterialSpecStatus.DRAFT,
        change_summary="Initial draft",
        created_by=user,
    )
    return spec


@transaction.atomic
def add_material_specification_parameter(
    *,
    actor: User | None,
    version: MaterialSpecificationVersion,
    code: str,
    name: str,
    unit: str = "",
    bound_min: Any = None,
    bound_max: Any = None,
    notes: str = "",
) -> MaterialSpecificationParameter:
    user = _require_actor(actor)
    org_id = version.specification.organization_id
    require_permission(user, MANAGE_SPEC, scope=_org_scope(org_id))
    if version.is_immutable:
        raise ValidationError({"status": "Approved/retired versions are immutable."})
    normalized = normalize_code(code)
    if not normalized or not (name or "").strip():
        raise ValidationError({"code": "Parameter code and name are required."})
    param = MaterialSpecificationParameter(
        version=version,
        code=normalized,
        name=name.strip(),
        unit=(unit or "").strip()[:32],
        bound_min=_parse_decimal(bound_min),
        bound_max=_parse_decimal(bound_max),
        notes=(notes or "").strip(),
    )
    param.full_clean()
    try:
        param.save()
    except IntegrityError as exc:
        raise ValidationError({"code": "Parameter code already exists."}) from exc
    return param


@transaction.atomic
def approve_material_specification_version(
    *,
    actor: User | None,
    version: MaterialSpecificationVersion,
    approval_reference: str = "",
) -> MaterialSpecificationVersion:
    user = _require_actor(actor)
    org_id = version.specification.organization_id
    require_permission(user, APPROVE_SPEC, scope=_org_scope(org_id))
    if version.status != MaterialSpecStatus.DRAFT:
        raise ValidationError({"status": "Only draft versions can be approved."})
    if approval_reference:
        version.approval_reference = approval_reference.strip()[:255]
    version.status = MaterialSpecStatus.APPROVED
    version.approved_by = user
    version.approved_at = timezone.now()
    version.full_clean()
    version.save()
    record_event(
        event_type="RECEIVING_MATERIAL_SPEC_APPROVED",
        actor=user,
        metadata={"material_spec_version_id": str(version.id)},
    )
    return version


@transaction.atomic
def create_receipt_quality_record(
    *,
    actor: User | None,
    organization: Organization,
    erp_receipt_reference: str,
    supplier_profile: SupplierQualityProfile,
    supplier_lot: str,
    material: MaterialReference,
    quantity: Any = None,
    uom: str = "",
    received_date: date | None = None,
    inspection_checklist_template: ChecklistTemplate | None = None,
    inspection_checklist_version: ChecklistVersion | None = None,
    material_specification_version: MaterialSpecificationVersion | None = None,
    evidence_object_key: str = "",
    evidence_file_name: str = "",
) -> ReceiptQualityRecord:
    user = _require_actor(actor)
    require_permission(user, MANAGE_RECEIPT, scope=_org_scope(organization.id))
    if supplier_profile.organization_id != organization.id:
        raise ValidationError({"supplier_profile": "Supplier must belong to the organization."})
    if material.organization_id != organization.id:
        raise ValidationError({"material": "Material must belong to the organization."})
    if inspection_checklist_template is not None:
        if inspection_checklist_template.organization_id != organization.id:
            raise ValidationError(
                {"inspection_checklist_template": "Checklist must match organization."}
            )
    if inspection_checklist_version is not None:
        if inspection_checklist_template is None:
            raise ValidationError(
                {
                    "inspection_checklist_version": (
                        "Checklist version requires a checklist template."
                    )
                }
            )
        if inspection_checklist_version.template_id != inspection_checklist_template.id:
            raise ValidationError(
                {
                    "inspection_checklist_version": (
                        "Checklist version must belong to the selected template."
                    )
                }
            )
    if material_specification_version is not None:
        spec = material_specification_version.specification
        if spec.organization_id != organization.id:
            raise ValidationError(
                {"material_specification_version": "Spec must match organization."}
            )
        if material_specification_version.status != MaterialSpecStatus.APPROVED:
            raise ValidationError(
                {
                    "material_specification_version": (
                        "Only APPROVED material specification versions may be linked."
                    )
                }
            )
        if spec.material_id != material.id:
            raise ValidationError(
                {
                    "material_specification_version": (
                        "Specification must belong to the receipt material."
                    )
                }
            )

    record = ReceiptQualityRecord(
        organization=organization,
        erp_receipt_reference=(erp_receipt_reference or "").strip()[:128],
        supplier_profile=supplier_profile,
        supplier_lot=(supplier_lot or "").strip()[:128],
        material=material,
        quantity=_parse_decimal(quantity),
        uom=(uom or material.uom_reference or "").strip()[:32],
        received_date=received_date or timezone.localdate(),
        quality_state=ReceiptQualityState.PENDING_INSPECTION,
        inspection_checklist_template=inspection_checklist_template,
        inspection_checklist_version=inspection_checklist_version,
        material_specification_version=material_specification_version,
        evidence_object_key=(evidence_object_key or "").strip()[:512],
        evidence_file_name=(evidence_file_name or "").strip()[:255],
        recorded_by=user,
    )
    record.full_clean()
    try:
        record.save()
    except IntegrityError as exc:
        raise ValidationError(
            {"erp_receipt_reference": ("Receipt/GRN + supplier lot + material already recorded.")}
        ) from exc
    record.frozen_receipt_context = build_frozen_receipt_context(record)
    record.save(update_fields=["frozen_receipt_context", "updated_at"])
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="RECEIPT_QUALITY_CREATED",
        receipt=record,
    )
    record_event(
        event_type="RECEIVING_RECEIPT_QUALITY_CREATED",
        actor=user,
        metadata={
            "receipt_quality_id": str(record.id),
            "erp_receipt_reference": record.erp_receipt_reference,
            "supplier_lot": record.supplier_lot,
            "erp_material_reference": material.erp_material_reference,
            "quality_state": record.quality_state,
            "erp_inventory_not_updated": True,
        },
    )
    return record


@transaction.atomic
def set_receipt_quality_disposition(
    *,
    actor: User | None,
    receipt: ReceiptQualityRecord,
    quality_state: str,
    disposition_notes: str = "",
) -> ReceiptQualityRecord:
    """
    Set local quality disposition. Does not update ERP stock.

    Allowed: ACCEPTED / HOLD / REJECTED (from PENDING_INSPECTION or prior local state).
    """
    user = _require_actor(actor)
    require_permission(user, DISPOSITION, scope=_org_scope(receipt.organization_id))
    target = (quality_state or "").strip().upper()
    if target not in {
        ReceiptQualityState.ACCEPTED,
        ReceiptQualityState.HOLD,
        ReceiptQualityState.REJECTED,
    }:
        raise ValidationError(
            {
                "quality_state": (
                    "Disposition must be ACCEPTED, HOLD, or REJECTED "
                    "(local quality only — not ERP stock)."
                )
            }
        )
    receipt.quality_state = target
    receipt.disposition_notes = (disposition_notes or "").strip()
    receipt.dispositioned_by = user
    receipt.dispositioned_at = timezone.now()
    frozen = build_frozen_receipt_context(receipt)
    frozen["disposition_local_only"] = True
    receipt.frozen_receipt_context = frozen
    receipt.save()
    _history(
        organization_id=receipt.organization_id,
        actor=user,
        event_type="RECEIPT_QUALITY_DISPOSITIONED",
        receipt=receipt,
        metadata={"quality_state": target, "erp_inventory_not_updated": True},
    )
    record_event(
        event_type="RECEIVING_RECEIPT_QUALITY_DISPOSITIONED",
        actor=user,
        metadata={
            "receipt_quality_id": str(receipt.id),
            "quality_state": target,
            "erp_inventory_not_updated": True,
            "not_qa_disposition_to_erp": True,
        },
    )
    return receipt


@transaction.atomic
def link_lab_sample_to_receipt(
    *,
    actor: User | None,
    receipt: ReceiptQualityRecord,
    lab_sample: LabSample,
    notes: str = "",
) -> ReceiptLabSampleLink:
    user = _require_actor(actor)
    require_permission(user, MANAGE_RECEIPT, scope=_org_scope(receipt.organization_id))
    if lab_sample.organization_id != receipt.organization_id:
        raise ValidationError({"lab_sample": "Lab sample must belong to the same organization."})
    try:
        link = ReceiptLabSampleLink.objects.create(
            receipt=receipt,
            lab_sample=lab_sample,
            notes=(notes or "").strip()[:255],
            linked_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"lab_sample": "Lab sample already linked to this receipt."}) from exc
    record_event(
        event_type="RECEIVING_LAB_SAMPLE_LINKED",
        actor=user,
        metadata={
            "receipt_quality_id": str(receipt.id),
            "lab_sample_id": str(lab_sample.id),
        },
    )
    return link


@transaction.atomic
def register_incoming_lab_sample(
    *,
    actor: User | None,
    receipt: ReceiptQualityRecord,
    sample_code: str,
    notes: str = "",
) -> tuple[LabSample, ReceiptLabSampleLink]:
    """Register a Phase 22 lab sample and link it to the receipt."""
    user = _require_actor(actor)
    require_permission(user, MANAGE_RECEIPT, scope=_org_scope(receipt.organization_id))
    sample = register_lab_sample(
        actor=user,
        organization=receipt.organization,
        code=sample_code,
        batch_reference=receipt.erp_receipt_reference,
        sub_lot_reference=receipt.supplier_lot,
        provenance_note=(
            f"Incoming receipt quality {receipt.id}; "
            f"material={receipt.material.erp_material_reference}"
        ),
    )
    link = link_lab_sample_to_receipt(actor=user, receipt=receipt, lab_sample=sample, notes=notes)
    return sample, link


def attempt_erp_outbound_for_receipt(
    *,
    actor: User | None,
    receipt: ReceiptQualityRecord,
) -> None:
    """Prepare then refuse ERP outbound — documents Phase 17 boundary."""
    user = _require_actor(actor)
    org_scope = _org_scope(receipt.organization_id)
    if not (
        user_has_permission(user, DISPOSITION, scope=org_scope)
        or user_has_permission(user, MANAGE_RECEIPT, scope=org_scope)
    ):
        raise PermissionDenied("Permission denied.")
    command = prepare_receipt_quality_outbound(receipt=receipt)
    send_receipt_quality_to_erp(command)
