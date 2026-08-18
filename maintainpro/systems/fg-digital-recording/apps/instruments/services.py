"""Equipment and calibration domain services — no invented intervals; no seed assets."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from apps.core.persistence import atomic_fn, lock_queryset, locked_get

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.instruments.historical_safety import (
    refuse_hard_delete_calibration,
    refuse_hard_delete_equipment,
)
from apps.instruments.models import (
    CalibrationRecord,
    Equipment,
    EquipmentOperationalStatus,
    EquipmentType,
    evaluate_calibration_fitness,
)
from apps.organizations.models import Organization, Site
from apps.organizations.services import normalize_code, normalize_name
from apps.security_audit.services import record_event

VIEW_EQUIPMENT = "instruments.view_equipment"
MANAGE_EQUIPMENT = "instruments.manage_equipment"

_UNSET: Any = object()


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def equipment_authorization_scope(equipment: Equipment) -> Scope:
    # Organization-scoped administration — site-only grants do not escalate.
    return Scope(organization_id=equipment.organization_id)


def _equipment_metadata(
    equipment: Equipment,
    *,
    changed_fields: list[str] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "equipment_id": str(equipment.id),
        "equipment_code": equipment.code,
        "organization_id": str(equipment.organization_id),
        "equipment_type": equipment.equipment_type,
        "operational_status": equipment.operational_status,
        "is_active": equipment.is_active,
    }
    if equipment.site_id:
        meta["site_id"] = str(equipment.site_id)
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return meta


def _calibration_metadata(record: CalibrationRecord) -> dict[str, Any]:
    return {
        "calibration_record_id": str(record.id),
        "equipment_id": str(record.equipment_id),
        "calibrated_on": record.calibrated_on.isoformat(),
        "next_due_on": record.next_due_on.isoformat() if record.next_due_on else None,
        "certificate_reference": record.certificate_reference or None,
        "provider_reference": record.provider_reference or None,
        "status": record.status,
        "recorded_by_id": str(record.recorded_by_id),
    }


def _validate_site(organization: Organization, site: Site | None) -> None:
    if site is not None and site.organization_id != organization.id:
        raise ValidationError({"site": "Site must belong to the selected organization."})


def _reraise_equipment_unique(exc: Exception) -> None:
    if isinstance(exc, ValidationError):
        messages = " ".join(str(m) for m in exc.messages)
        if "inst_equipment_org_code_ci_uniq" in messages or "unique" in messages.lower():
            raise ValidationError(
                {"code": "Equipment with this code already exists in the organization."}
            ) from exc
        raise
    if isinstance(exc, IntegrityError):
        raise ValidationError(
            {"code": "Equipment with this code already exists in the organization."}
        ) from exc
    raise


@atomic_fn
def create_equipment(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    equipment_type: str = EquipmentType.OTHER,
    site: Site | None = None,
    serial_number: str = "",
    location_label: str = "",
    manufacturer: str = "",
    model_name: str = "",
    operational_status: str = EquipmentOperationalStatus.IN_SERVICE,
    is_active: bool = True,
    notes: str = "",
) -> Equipment:
    user = _require_authenticated_actor(actor)
    require_permission(
        user,
        MANAGE_EQUIPMENT,
        scope=Scope(organization_id=organization.id),
    )
    _validate_site(organization, site)
    normalized_code = normalize_code(code)
    normalized_name = normalize_name(name)
    if not normalized_code:
        raise ValidationError({"code": "Equipment code is required."})
    if not normalized_name:
        raise ValidationError({"name": "Equipment name is required."})
    if equipment_type not in EquipmentType.values:
        raise ValidationError({"equipment_type": "Unknown equipment type."})
    if operational_status not in EquipmentOperationalStatus.values:
        raise ValidationError({"operational_status": "Unknown operational status."})

    equipment = Equipment(
        organization=organization,
        site=site,
        code=normalized_code,
        name=normalized_name,
        equipment_type=equipment_type,
        serial_number=(serial_number or "").strip(),
        location_label=(location_label or "").strip(),
        manufacturer=(manufacturer or "").strip(),
        model_name=(model_name or "").strip(),
        operational_status=operational_status,
        is_active=is_active,
        notes=(notes or "").strip(),
    )
    try:
        equipment.full_clean()
        equipment.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_equipment_unique(exc)

    record_event(
        event_type="EQUIPMENT_CREATED",
        actor=user,
        metadata=_equipment_metadata(equipment),
    )
    return equipment


@atomic_fn
def update_equipment(
    *,
    actor: User | None,
    equipment_id: uuid.UUID,
    code: str | None = None,
    name: str | None = None,
    equipment_type: str | None = None,
    site: Any = _UNSET,
    serial_number: Any = _UNSET,
    location_label: Any = _UNSET,
    manufacturer: Any = _UNSET,
    model_name: Any = _UNSET,
    notes: Any = _UNSET,
) -> Equipment:
    user = _require_authenticated_actor(actor)
    equipment = (
        lock_queryset(
        Equipment.objects.select_related("organization", "site").filter(pk=equipment_id)
        ).first()
    )
    if equipment is None:
        raise ValidationError({"equipment": "Equipment not found."})
    require_permission(user, MANAGE_EQUIPMENT, scope=equipment_authorization_scope(equipment))

    next_site: Site | None = equipment.site if site is _UNSET else site
    _validate_site(equipment.organization, next_site)

    field_map: dict[str, Any] = {
        "code": normalize_code(code) if code is not None else equipment.code,
        "name": normalize_name(name) if name is not None else equipment.name,
        "equipment_type": (
            equipment_type if equipment_type is not None else equipment.equipment_type
        ),
        "site": next_site,
        "serial_number": (
            equipment.serial_number if serial_number is _UNSET else (serial_number or "").strip()
        ),
        "location_label": (
            equipment.location_label if location_label is _UNSET else (location_label or "").strip()
        ),
        "manufacturer": (
            equipment.manufacturer if manufacturer is _UNSET else (manufacturer or "").strip()
        ),
        "model_name": (
            equipment.model_name if model_name is _UNSET else (model_name or "").strip()
        ),
        "notes": equipment.notes if notes is _UNSET else (notes or "").strip(),
    }
    if not field_map["code"]:
        raise ValidationError({"code": "Equipment code is required."})
    if not field_map["name"]:
        raise ValidationError({"name": "Equipment name is required."})
    if field_map["equipment_type"] not in EquipmentType.values:
        raise ValidationError({"equipment_type": "Unknown equipment type."})

    changed: list[str] = []
    for field, value in field_map.items():
        if getattr(equipment, field) != value:
            setattr(equipment, field, value)
            changed.append(field)
    if not changed:
        return equipment
    try:
        equipment.full_clean()
        equipment.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_equipment_unique(exc)
    record_event(
        event_type="EQUIPMENT_UPDATED",
        actor=user,
        metadata=_equipment_metadata(equipment, changed_fields=changed),
    )
    return equipment


@atomic_fn
def set_equipment_operational_status(
    *,
    actor: User | None,
    equipment_id: uuid.UUID,
    operational_status: str,
) -> Equipment:
    user = _require_authenticated_actor(actor)
    equipment = locked_get(Equipment, pk=equipment_id)
    if equipment is None:
        raise ValidationError({"equipment": "Equipment not found."})
    require_permission(user, MANAGE_EQUIPMENT, scope=equipment_authorization_scope(equipment))
    if operational_status not in EquipmentOperationalStatus.values:
        raise ValidationError({"operational_status": "Unknown operational status."})
    if equipment.operational_status == operational_status:
        return equipment
    before = equipment.operational_status
    equipment.operational_status = operational_status
    equipment.save(update_fields=["operational_status", "updated_at"])
    record_event(
        event_type="EQUIPMENT_STATUS_CHANGED",
        actor=user,
        metadata={
            **_equipment_metadata(equipment),
            "operational_status_before": before,
            "operational_status_after": operational_status,
        },
    )
    return equipment


@atomic_fn
def activate_equipment(*, actor: User | None, equipment_id: uuid.UUID) -> Equipment:
    user = _require_authenticated_actor(actor)
    equipment = locked_get(Equipment, pk=equipment_id)
    if equipment is None:
        raise ValidationError({"equipment": "Equipment not found."})
    require_permission(user, MANAGE_EQUIPMENT, scope=equipment_authorization_scope(equipment))
    if equipment.is_active:
        return equipment
    equipment.is_active = True
    equipment.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="EQUIPMENT_ACTIVATED",
        actor=user,
        metadata=_equipment_metadata(equipment),
    )
    return equipment


@atomic_fn
def deactivate_equipment(*, actor: User | None, equipment_id: uuid.UUID) -> Equipment:
    user = _require_authenticated_actor(actor)
    equipment = locked_get(Equipment, pk=equipment_id)
    if equipment is None:
        raise ValidationError({"equipment": "Equipment not found."})
    require_permission(user, MANAGE_EQUIPMENT, scope=equipment_authorization_scope(equipment))
    if not equipment.is_active:
        return equipment
    equipment.is_active = False
    equipment.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="EQUIPMENT_DEACTIVATED",
        actor=user,
        metadata=_equipment_metadata(equipment),
    )
    return equipment


@atomic_fn
def create_calibration_record(
    *,
    actor: User | None,
    equipment_id: uuid.UUID,
    calibrated_on: datetime.date,
    next_due_on: datetime.date | None = None,
    certificate_reference: str = "",
    provider_reference: str = "",
    notes: str = "",
) -> CalibrationRecord:
    """
    Record an explicit calibration event.

    next_due_on must be supplied by evidence when known — never invent a frequency.
    """
    user = _require_authenticated_actor(actor)
    equipment = (
        Equipment.objects.select_related("organization", "site").filter(pk=equipment_id).first()
    )
    if equipment is None:
        raise ValidationError({"equipment": "Equipment not found."})
    require_permission(user, MANAGE_EQUIPMENT, scope=equipment_authorization_scope(equipment))
    if next_due_on is not None and next_due_on < calibrated_on:
        raise ValidationError({"next_due_on": "next_due_on cannot be earlier than calibrated_on."})

    record = CalibrationRecord(
        equipment=equipment,
        calibrated_on=calibrated_on,
        next_due_on=next_due_on,
        certificate_reference=(certificate_reference or "").strip(),
        provider_reference=(provider_reference or "").strip(),
        recorded_by=user,
        notes=(notes or "").strip(),
    )
    record.full_clean()
    record.save()
    record_event(
        event_type="CALIBRATION_RECORD_CREATED",
        actor=user,
        metadata=_calibration_metadata(record),
    )
    return record


@atomic_fn
def update_calibration_certificate_metadata(
    *,
    actor: User | None,
    calibration_record_id: uuid.UUID,
    certificate_reference: str | None = None,
    provider_reference: str | None = None,
    notes: Any = _UNSET,
) -> CalibrationRecord:
    user = _require_authenticated_actor(actor)
    record = (
        lock_queryset(
        CalibrationRecord.objects.select_related("equipment", "equipment__organization", "equipment__site").filter(pk=calibration_record_id)
        ).first()
    )
    if record is None:
        raise ValidationError({"calibration": "Calibration record not found."})
    require_permission(
        user, MANAGE_EQUIPMENT, scope=equipment_authorization_scope(record.equipment)
    )
    before = {
        "certificate_reference": record.certificate_reference,
        "provider_reference": record.provider_reference,
        "notes": record.notes,
    }
    changed: list[str] = []
    if certificate_reference is not None:
        value = certificate_reference.strip()
        if record.certificate_reference != value:
            record.certificate_reference = value
            changed.append("certificate_reference")
    if provider_reference is not None:
        value = provider_reference.strip()
        if record.provider_reference != value:
            record.provider_reference = value
            changed.append("provider_reference")
    if notes is not _UNSET:
        value = (notes or "").strip()
        if record.notes != value:
            record.notes = value
            changed.append("notes")
    if not changed:
        return record
    record.save()
    record_event(
        event_type="CALIBRATION_CERTIFICATE_METADATA_UPDATED",
        actor=user,
        metadata={
            **_calibration_metadata(record),
            "changed_fields": changed,
            "before": before,
        },
    )
    return record


def get_equipment_calibration_fitness(
    equipment: Equipment,
    *,
    as_of: datetime.date | None = None,
) -> str:
    return evaluate_calibration_fitness(equipment, as_of=as_of)


def delete_equipment(equipment: Equipment) -> None:
    refuse_hard_delete_equipment(equipment)


def delete_calibration_record(record: CalibrationRecord) -> None:
    refuse_hard_delete_calibration(record)
