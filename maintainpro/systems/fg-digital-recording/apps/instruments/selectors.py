"""Permission-aware equipment selectors."""

from __future__ import annotations

import uuid
from typing import Literal

from django.core.exceptions import PermissionDenied
from django.db.models import Q, QuerySet

from apps.access_control.services import (
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.instruments.models import CalibrationRecord, Equipment, evaluate_calibration_fitness
from apps.instruments.services import (
    MANAGE_EQUIPMENT,
    VIEW_EQUIPMENT,
    equipment_authorization_scope,
)
from apps.organizations.models import Organization

StatusFilter = Literal["all", "active", "inactive"]


def actor_can_view_equipment(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, VIEW_EQUIPMENT))


def actor_can_manage_equipment(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, MANAGE_EQUIPMENT))


def actor_can_manage_equipment_asset(actor: User | None, equipment: Equipment) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return user_has_permission(
        actor, MANAGE_EQUIPMENT, scope=equipment_authorization_scope(equipment)
    )


def get_equipment(actor: User | None, equipment_id: uuid.UUID) -> Equipment | None:
    equipment = (
        Equipment.objects.select_related("organization", "site").filter(pk=equipment_id).first()
    )
    if equipment is None:
        return None
    if not user_has_permission(
        actor, VIEW_EQUIPMENT, scope=equipment_authorization_scope(equipment)
    ):
        raise PermissionDenied("Permission denied.")
    return equipment


def list_equipment(
    actor: User | None,
    *,
    organization: Organization | None = None,
    status: StatusFilter = "all",
    search: str | None = None,
    equipment_type: str | None = None,
) -> QuerySet[Equipment]:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return Equipment.objects.none()
    allowed = organization_ids_with_permission(actor, VIEW_EQUIPMENT)
    if not allowed:
        return Equipment.objects.none()
    qs = Equipment.objects.select_related("organization", "site").filter(
        organization_id__in=allowed
    )
    if organization is not None:
        if organization.id not in allowed:
            return Equipment.objects.none()
        qs = qs.filter(organization=organization)
    if status == "active":
        qs = qs.filter(is_active=True)
    elif status == "inactive":
        qs = qs.filter(is_active=False)
    if equipment_type:
        qs = qs.filter(equipment_type=equipment_type)
    if search:
        term = search.strip()
        if term:
            qs = qs.filter(
                Q(code__icontains=term) | Q(name__icontains=term) | Q(serial_number__icontains=term)
            )
    return qs.order_by("organization__code", "code")


def list_calibration_records(
    actor: User | None,
    *,
    equipment: Equipment,
) -> QuerySet[CalibrationRecord]:
    if not user_has_permission(
        actor, VIEW_EQUIPMENT, scope=equipment_authorization_scope(equipment)
    ):
        raise PermissionDenied("Permission denied.")
    return CalibrationRecord.objects.filter(equipment=equipment).select_related(
        "recorded_by", "equipment"
    )


def equipment_fitness_label(equipment: Equipment) -> str:
    return evaluate_calibration_fitness(equipment)
