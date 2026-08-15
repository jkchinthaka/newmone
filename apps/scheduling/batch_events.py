"""Phase 07F — external batch event → ChecklistTask adapter boundary.

Flow: External Batch → Organization/Product(/Site/Shift) mapping → Applicability
→ Effective Version → ChecklistTask.

No live ERP/Bileeta connector, webhooks, credentials, or invented endpoints.
Future adapters call ``process_external_batch_event`` / integration port only.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.effective_version import (
    EffectiveVersionOutcome,
    resolve_effective_checklist_version,
)
from apps.core.persistence import lock_queryset
from apps.scheduling.applicability import resolve_checklist_applicability
from apps.scheduling.models import (
    ApplicabilityMatchOutcome,
    ExternalBatchEvent,
    ExternalBatchEventStatus,
    ExternalBatchMapping,
    ExternalBatchMappingKind,
)
from apps.scheduling.services import (
    MANAGE_CHECKLIST_TASK,
    create_batch_checklist_task,
    normalize_batch_reference,
)
from apps.security_audit.services import record_event

MANAGE_EXTERNAL_BATCH_MAPPING = "scheduling.manage_externalbatchmapping"

_RETRYABLE_STATUSES = frozenset(
    {
        ExternalBatchEventStatus.RECEIVED,
        ExternalBatchEventStatus.MAPPING_FAILED,
        ExternalBatchEventStatus.APPLICABILITY_FAILED,
        ExternalBatchEventStatus.VERSION_FAILED,
    }
)


@dataclass(frozen=True, slots=True)
class ExternalBatchEventInput:
    """Technical inbound batch event — safe identifiers only (no secrets)."""

    source_system: str
    source_event_id: str
    external_batch_id: str
    external_organization_key: str
    external_product_key: str = ""
    external_site_key: str = ""
    external_shift_key: str = ""
    external_line_key: str = ""
    as_of: datetime | None = None


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _norm(value: str | None) -> str:
    return (value or "").strip()


def _safe_event_metadata(event: ExternalBatchEvent, **extra: Any) -> dict[str, Any]:
    """Audit/log metadata — identifiers only; never tokens/secrets/payload dumps."""
    meta: dict[str, Any] = {
        "external_batch_event_id": str(event.id),
        "source_system": event.source_system,
        "source_event_id": event.source_event_id,
        "external_batch_id": event.external_batch_id,
        "status": event.status,
        "failure_code": event.failure_code or "",
        "organization_id": str(event.organization_id) if event.organization_id else None,
        "product_id": str(event.product_id) if event.product_id else None,
        "site_id": str(event.site_id) if event.site_id else None,
        "shift_id": str(event.shift_id) if event.shift_id else None,
        "checklist_task_id": str(event.checklist_task_id) if event.checklist_task_id else None,
        "attempt_count": event.attempt_count,
        "has_external_line_key": bool(event.external_line_key),
        "live_contract_required": True,
    }
    meta.update(extra)
    return meta


def _fail_event(
    event: ExternalBatchEvent,
    *,
    actor: User,
    status: str,
    failure_code: str,
    failure_message: str,
    audit_event: str,
) -> ExternalBatchEvent:
    event.status = status
    event.failure_code = failure_code[:64]
    event.failure_message = failure_message[:512]
    event.checklist_task = None
    event.processed_at = timezone.now()
    event.save(
        update_fields=[
            "status",
            "failure_code",
            "failure_message",
            "organization",
            "product",
            "site",
            "shift",
            "checklist_task",
            "processed_at",
            "attempt_count",
            "updated_at",
        ]
    )
    record_event(
        event_type=audit_event,
        actor=actor,
        metadata=_safe_event_metadata(event),
    )
    return event


def upsert_external_batch_mapping(
    *,
    actor: User | None,
    source_system: str,
    mapping_kind: str,
    external_key: str,
    organization_id: uuid.UUID,
    product_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    shift_id: uuid.UUID | None = None,
    is_active: bool = True,
    notes: str = "",
) -> ExternalBatchMapping:
    """Create or update a configurable external identity mapping."""
    user = _require_authenticated_actor(actor)
    require_permission(
        user,
        MANAGE_EXTERNAL_BATCH_MAPPING,
        scope=Scope(organization_id=organization_id),
    )
    source_system = _norm(source_system)
    external_key = _norm(external_key)
    if not source_system or not external_key:
        raise ValidationError({"source_system": "Source system and external key are required."})

    lookup: dict[str, Any] = {
        "source_system": source_system,
        "mapping_kind": mapping_kind,
        "external_key": external_key,
    }
    if mapping_kind != ExternalBatchMappingKind.ORGANIZATION:
        lookup["organization_id"] = organization_id

    existing = ExternalBatchMapping.objects.filter(**lookup).first()
    if existing is None:
        mapping = ExternalBatchMapping(
            source_system=source_system,
            mapping_kind=mapping_kind,
            external_key=external_key,
            organization_id=organization_id,
            product_id=product_id,
            site_id=site_id,
            shift_id=shift_id,
            is_active=is_active,
            notes=_norm(notes),
        )
    else:
        mapping = existing
        mapping.organization_id = organization_id
        mapping.product_id = product_id
        mapping.site_id = site_id
        mapping.shift_id = shift_id
        mapping.is_active = is_active
        mapping.notes = _norm(notes)

    mapping.full_clean()
    mapping.save()
    record_event(
        event_type="EXTERNAL_BATCH_MAPPING_UPSERTED",
        actor=user,
        metadata={
            "mapping_id": str(mapping.id),
            "source_system": mapping.source_system,
            "mapping_kind": mapping.mapping_kind,
            "external_key": mapping.external_key,
            "organization_id": str(mapping.organization_id),
            "product_id": str(mapping.product_id) if mapping.product_id else None,
            "site_id": str(mapping.site_id) if mapping.site_id else None,
            "shift_id": str(mapping.shift_id) if mapping.shift_id else None,
            "is_active": mapping.is_active,
        },
    )
    return mapping


def _resolve_org_mapping(
    *, source_system: str, external_organization_key: str
) -> ExternalBatchMapping | None:
    return (
        ExternalBatchMapping.objects.select_related("organization")
        .filter(
            source_system=source_system,
            mapping_kind=ExternalBatchMappingKind.ORGANIZATION,
            external_key=external_organization_key,
            is_active=True,
        )
        .first()
    )


def _resolve_scoped_mapping(
    *,
    source_system: str,
    mapping_kind: str,
    organization_id: uuid.UUID,
    external_key: str,
) -> ExternalBatchMapping | None:
    return (
        ExternalBatchMapping.objects.select_related("product", "site", "shift", "organization")
        .filter(
            source_system=source_system,
            mapping_kind=mapping_kind,
            organization_id=organization_id,
            external_key=external_key,
            is_active=True,
        )
        .first()
    )


def _get_or_create_receipt(
    *,
    payload: ExternalBatchEventInput,
) -> tuple[ExternalBatchEvent, bool]:
    """Return (event, created). Race-safe on unique (source_system, source_event_id)."""
    existing = ExternalBatchEvent.objects.filter(
        source_system=payload.source_system,
        source_event_id=payload.source_event_id,
    ).first()
    if existing is not None:
        return existing, False

    defaults = {
        "external_batch_id": payload.external_batch_id,
        "external_organization_key": payload.external_organization_key,
        "external_product_key": payload.external_product_key,
        "external_site_key": payload.external_site_key,
        "external_shift_key": payload.external_shift_key,
        "external_line_key": payload.external_line_key,
        "status": ExternalBatchEventStatus.RECEIVED,
    }
    try:
        with transaction.atomic():
            event = ExternalBatchEvent(
                source_system=payload.source_system,
                source_event_id=payload.source_event_id,
                **defaults,
            )
            # DB unique constraint + IntegrityError path handle races; skip ORM unique
            # validation so retries of existing (source_system, source_event_id) work.
            event.full_clean(validate_unique=False)
            event.save()
            return event, True
    except IntegrityError:
        pass
    except ValidationError:
        # Unexpected validation — re-raise unless a concurrent insert won the race.
        raced = ExternalBatchEvent.objects.filter(
            source_system=payload.source_system,
            source_event_id=payload.source_event_id,
        ).first()
        if raced is None:
            raise
        return raced, False

    event = ExternalBatchEvent.objects.get(
        source_system=payload.source_system,
        source_event_id=payload.source_event_id,
    )
    return event, False


def process_external_batch_event(
    *,
    actor: User | None,
    event: ExternalBatchEventInput,
) -> ExternalBatchEvent:
    """
    Convert a valid external batch event into a ChecklistTask (or explicit failure).

    Idempotent on (source_system, source_event_id). Never creates a partial task.
    Safe to retry after mapping/applicability/version configuration is corrected.
    """
    user = _require_authenticated_actor(actor)

    payload = ExternalBatchEventInput(
        source_system=_norm(event.source_system),
        source_event_id=_norm(event.source_event_id),
        external_batch_id=normalize_batch_reference(event.external_batch_id),
        external_organization_key=_norm(event.external_organization_key),
        external_product_key=_norm(event.external_product_key),
        external_site_key=_norm(event.external_site_key),
        external_shift_key=_norm(event.external_shift_key),
        external_line_key=_norm(event.external_line_key),
        as_of=event.as_of,
    )
    if not payload.source_system:
        raise ValidationError({"source_system": "Source system cannot be blank."})
    if not payload.source_event_id:
        raise ValidationError({"source_event_id": "Source event id cannot be blank."})
    if not payload.external_organization_key:
        raise ValidationError(
            {"external_organization_key": "External organization key cannot be blank."}
        )

    receipt, created = _get_or_create_receipt(payload=payload)

    with transaction.atomic():
        locked = lock_queryset(
            ExternalBatchEvent.objects.select_related("checklist_task", "organization").filter(
                pk=receipt.id
            ),
            of=("self",),
        ).get()

        if locked.status == ExternalBatchEventStatus.COMPLETED and locked.checklist_task_id:
            record_event(
                event_type="EXTERNAL_BATCH_EVENT_DUPLICATE",
                actor=user,
                metadata=_safe_event_metadata(locked, duplicate=True, created=created),
            )
            return locked

        if locked.status == ExternalBatchEventStatus.REJECTED:
            return locked

        if (
            locked.status not in _RETRYABLE_STATUSES
            and locked.status != ExternalBatchEventStatus.COMPLETED
        ):
            return locked

        locked.external_batch_id = payload.external_batch_id
        locked.external_organization_key = payload.external_organization_key
        locked.external_product_key = payload.external_product_key
        locked.external_site_key = payload.external_site_key
        locked.external_shift_key = payload.external_shift_key
        locked.external_line_key = payload.external_line_key
        locked.attempt_count = int(locked.attempt_count or 0) + 1
        locked.organization = None
        locked.product = None
        locked.site = None
        locked.shift = None
        locked.checklist_task = None
        locked.failure_code = ""
        locked.failure_message = ""
        locked.status = ExternalBatchEventStatus.RECEIVED
        locked.save(
            update_fields=[
                "external_batch_id",
                "external_organization_key",
                "external_product_key",
                "external_site_key",
                "external_shift_key",
                "external_line_key",
                "attempt_count",
                "organization",
                "product",
                "site",
                "shift",
                "checklist_task",
                "failure_code",
                "failure_message",
                "status",
                "updated_at",
            ]
        )

        if created or locked.attempt_count == 1:
            record_event(
                event_type="EXTERNAL_BATCH_EVENT_RECEIVED",
                actor=user,
                metadata=_safe_event_metadata(locked, created=created),
            )

        org_map = _resolve_org_mapping(
            source_system=payload.source_system,
            external_organization_key=payload.external_organization_key,
        )
        if org_map is None:
            return _fail_event(
                locked,
                actor=user,
                status=ExternalBatchEventStatus.MAPPING_FAILED,
                failure_code="ORG_MAPPING_NOT_FOUND",
                failure_message="No active organization mapping for source/external key.",
                audit_event="EXTERNAL_BATCH_EVENT_MAPPING_FAILED",
            )
        locked.organization = org_map.organization
        event_organization_id = locked.organization_id
        if event_organization_id is None:
            raise ValidationError(
                {"organization": "Organization mapping did not set organization."}
            )
        require_permission(
            user,
            MANAGE_CHECKLIST_TASK,
            scope=Scope(organization_id=event_organization_id),
        )

        if payload.external_product_key:
            product_map = _resolve_scoped_mapping(
                source_system=payload.source_system,
                mapping_kind=ExternalBatchMappingKind.PRODUCT,
                organization_id=event_organization_id,
                external_key=payload.external_product_key,
            )
            if product_map is None or product_map.product_id is None:
                return _fail_event(
                    locked,
                    actor=user,
                    status=ExternalBatchEventStatus.MAPPING_FAILED,
                    failure_code="PRODUCT_MAPPING_NOT_FOUND",
                    failure_message=(
                        "No active product mapping for source/organization/external key."
                    ),
                    audit_event="EXTERNAL_BATCH_EVENT_MAPPING_FAILED",
                )
            locked.product = product_map.product

        if payload.external_site_key:
            site_map = _resolve_scoped_mapping(
                source_system=payload.source_system,
                mapping_kind=ExternalBatchMappingKind.SITE,
                organization_id=event_organization_id,
                external_key=payload.external_site_key,
            )
            if site_map is None or site_map.site_id is None:
                return _fail_event(
                    locked,
                    actor=user,
                    status=ExternalBatchEventStatus.MAPPING_FAILED,
                    failure_code="SITE_MAPPING_NOT_FOUND",
                    failure_message=(
                        "No active site mapping for source/organization/external key."
                    ),
                    audit_event="EXTERNAL_BATCH_EVENT_MAPPING_FAILED",
                )
            locked.site = site_map.site

        if payload.external_shift_key:
            shift_map = _resolve_scoped_mapping(
                source_system=payload.source_system,
                mapping_kind=ExternalBatchMappingKind.SHIFT,
                organization_id=event_organization_id,
                external_key=payload.external_shift_key,
            )
            if shift_map is None or shift_map.shift_id is None:
                return _fail_event(
                    locked,
                    actor=user,
                    status=ExternalBatchEventStatus.MAPPING_FAILED,
                    failure_code="SHIFT_MAPPING_NOT_FOUND",
                    failure_message=(
                        "No active shift mapping for source/organization/external key."
                    ),
                    audit_event="EXTERNAL_BATCH_EVENT_MAPPING_FAILED",
                )
            locked.shift = shift_map.shift

        locked.save(update_fields=["organization", "product", "site", "shift", "updated_at"])

        resolution = resolve_checklist_applicability(
            organization_id=event_organization_id,
            product_id=locked.product_id,
            site_id=locked.site_id,
            shift_id=locked.shift_id,
            as_of=(payload.as_of.date() if isinstance(payload.as_of, datetime) else None),
        )
        if resolution.outcome != ApplicabilityMatchOutcome.ONE_MATCH:
            return _fail_event(
                locked,
                actor=user,
                status=ExternalBatchEventStatus.APPLICABILITY_FAILED,
                failure_code=str(resolution.outcome),
                failure_message=(
                    resolution.message or "Applicability did not resolve to one rule."
                ),
                audit_event="EXTERNAL_BATCH_EVENT_APPLICABILITY_FAILED",
            )
        if resolution.selected_rule is None:
            raise ValidationError(
                {"applicability": "Applicability resolved without a selected rule."}
            )
        template_id = resolution.selected_rule.checklist_template_id

        version_resolution = resolve_effective_checklist_version(
            template_id=template_id,
            as_of=payload.as_of,
        )
        if version_resolution.outcome != EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION:
            return _fail_event(
                locked,
                actor=user,
                status=ExternalBatchEventStatus.VERSION_FAILED,
                failure_code=str(version_resolution.outcome),
                failure_message=(
                    version_resolution.message or "Effective version resolution blocked."
                ),
                audit_event="EXTERNAL_BATCH_EVENT_VERSION_FAILED",
            )
        if version_resolution.selected_version is None:
            raise ValidationError(
                {"checklist_version": "Effective version resolution missing selected version."}
            )

        try:
            task = create_batch_checklist_task(
                actor=user,
                organization_id=event_organization_id,
                checklist_template_id=template_id,
                checklist_version_id=version_resolution.selected_version.id,
                batch_reference=payload.external_batch_id,
            )
        except ValidationError as exc:
            msg = (
                "; ".join(f"{k}: {v}" for k, v in exc.message_dict.items())
                if hasattr(exc, "message_dict")
                else str(exc)
            )
            code = "TASK_CREATE_REJECTED"
            if "checklist_version" in getattr(exc, "message_dict", {}):
                code = "VERSION_CONFLICT"
            return _fail_event(
                locked,
                actor=user,
                status=(
                    ExternalBatchEventStatus.VERSION_FAILED
                    if code == "VERSION_CONFLICT"
                    else ExternalBatchEventStatus.REJECTED
                ),
                failure_code=code,
                failure_message=msg[:512],
                audit_event=(
                    "EXTERNAL_BATCH_EVENT_VERSION_FAILED"
                    if code == "VERSION_CONFLICT"
                    else "EXTERNAL_BATCH_EVENT_REJECTED"
                ),
            )

        locked.status = ExternalBatchEventStatus.COMPLETED
        locked.failure_code = ""
        locked.failure_message = ""
        locked.checklist_task = task
        locked.processed_at = timezone.now()
        locked.save(
            update_fields=[
                "status",
                "failure_code",
                "failure_message",
                "checklist_task",
                "processed_at",
                "updated_at",
            ]
        )
        record_event(
            event_type="EXTERNAL_BATCH_EVENT_PROCESSED",
            actor=user,
            metadata=_safe_event_metadata(
                locked,
                checklist_template_id=str(template_id),
                checklist_version_id=str(task.checklist_version_id),
            ),
        )
        return locked


def accept_external_batch_event(
    *,
    actor: User | None,
    source_system: str,
    source_event_id: str,
    external_batch_id: str,
    external_organization_key: str,
    external_product_key: str = "",
    external_site_key: str = "",
    external_shift_key: str = "",
    external_line_key: str = "",
    as_of: datetime | None = None,
) -> ExternalBatchEvent:
    """Convenience kwargs wrapper for the Phase 07F adapter boundary."""
    return process_external_batch_event(
        actor=actor,
        event=ExternalBatchEventInput(
            source_system=source_system,
            source_event_id=source_event_id,
            external_batch_id=external_batch_id,
            external_organization_key=external_organization_key,
            external_product_key=external_product_key,
            external_site_key=external_site_key,
            external_shift_key=external_shift_key,
            external_line_key=external_line_key,
            as_of=as_of,
        ),
    )
