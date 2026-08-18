"""Training / competency domain services — no invented matrices; no recording blocks."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError

from apps.access_control.models import Role
from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate
from apps.core.persistence import atomic_fn, lock_queryset, locked_get
from apps.instruments.models import Equipment
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code, normalize_name
from apps.security_audit.services import record_event
from apps.training.historical_safety import (
    refuse_hard_delete_training_policy,
    refuse_hard_delete_training_record,
)
from apps.training.models import (
    CompetencyScopeKind,
    TrainingCurrency,
    TrainingEnforcementPolicy,
    TrainingGateMode,
    TrainingRecord,
    TrainingRecordStatus,
    evaluate_training_currency,
    resolve_training_gate_mode,
)

VIEW_TRAINING = "training.view_trainingrecord"
MANAGE_TRAINING = "training.manage_trainingrecord"

_UNSET: Any = object()


class RecordingGateRecommendation:
    """
    Architectural recommendation labels for a future recording gate.

    Phase 05E never applies these to recording flows.
    """

    ALLOW = "ALLOW"
    WARN = "WARN"
    BLOCK = "BLOCK"


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def training_authorization_scope(organization_id: uuid.UUID) -> Scope:
    # Organization-scoped administration — site-only operator grants do not escalate.
    return Scope(organization_id=organization_id)


def _training_metadata(
    record: TrainingRecord,
    *,
    changed_fields: list[str] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "training_record_id": str(record.id),
        "organization_id": str(record.organization_id),
        "subject_user_id": str(record.subject_user_id),
        "course_code": record.course_code,
        "competency_scope": record.competency_scope,
        "trained_on": record.trained_on.isoformat(),
        "expires_on": record.expires_on.isoformat() if record.expires_on else None,
        "status": record.status,
        "recorded_by_id": str(record.recorded_by_id),
    }
    if record.checklist_template_id:
        meta["checklist_template_id"] = str(record.checklist_template_id)
    if record.process_reference:
        meta["process_reference"] = record.process_reference
    if record.equipment_id:
        meta["equipment_id"] = str(record.equipment_id)
    if record.business_role_id:
        meta["business_role_id"] = str(record.business_role_id)
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return meta


def _policy_metadata(policy: TrainingEnforcementPolicy) -> dict[str, Any]:
    return {
        "training_enforcement_policy_id": str(policy.id),
        "organization_id": str(policy.organization_id),
        "gate_mode": policy.gate_mode,
        "updated_by_id": str(policy.updated_by_id),
    }


def _validate_scope_associations(
    *,
    organization: Organization,
    competency_scope: str,
    checklist_template: ChecklistTemplate | None,
    process_reference: str,
    equipment: Equipment | None,
    business_role: Role | None,
) -> None:
    if competency_scope not in CompetencyScopeKind.values:
        raise ValidationError({"competency_scope": "Unknown competency scope."})
    if competency_scope == CompetencyScopeKind.CHECKLIST:
        if checklist_template is None:
            raise ValidationError(
                {
                    "checklist_template": (
                        "checklist_template is required when competency_scope=CHECKLIST."
                    )
                }
            )
        if checklist_template.organization_id != organization.id:
            raise ValidationError(
                {
                    "checklist_template": (
                        "Checklist template must belong to the selected organization."
                    )
                }
            )
    elif checklist_template is not None:
        raise ValidationError(
            {"checklist_template": "checklist_template is only applicable for CHECKLIST scope."}
        )

    if competency_scope == CompetencyScopeKind.PROCESS:
        if not (process_reference or "").strip():
            raise ValidationError(
                {
                    "process_reference": (
                        "process_reference is required when competency_scope=PROCESS."
                    )
                }
            )
    elif (process_reference or "").strip():
        raise ValidationError(
            {"process_reference": "process_reference is only applicable for PROCESS scope."}
        )

    if competency_scope == CompetencyScopeKind.EQUIPMENT:
        if equipment is None:
            raise ValidationError(
                {"equipment": "equipment is required when competency_scope=EQUIPMENT."}
            )
        if equipment.organization_id != organization.id:
            raise ValidationError(
                {"equipment": "Equipment must belong to the selected organization."}
            )
    elif equipment is not None:
        raise ValidationError({"equipment": "equipment is only applicable for EQUIPMENT scope."})

    if competency_scope == CompetencyScopeKind.BUSINESS_ROLE:
        if business_role is None:
            raise ValidationError(
                {
                    "business_role": (
                        "business_role is required when competency_scope=BUSINESS_ROLE."
                    )
                }
            )
    elif business_role is not None:
        raise ValidationError(
            {"business_role": "business_role is only applicable for BUSINESS_ROLE scope."}
        )


@atomic_fn
def create_training_record(
    *,
    actor: User | None,
    organization: Organization,
    subject_user: User,
    course_code: str,
    trained_on: datetime.date,
    course_name: str = "",
    competency_scope: str = CompetencyScopeKind.GENERAL,
    checklist_template: ChecklistTemplate | None = None,
    process_reference: str = "",
    equipment: Equipment | None = None,
    business_role: Role | None = None,
    expires_on: datetime.date | None = None,
    trainer_reference: str = "",
    evidence_reference: str = "",
    status: str = TrainingRecordStatus.ACTIVE,
    notes: str = "",
) -> TrainingRecord:
    user = _require_authenticated_actor(actor)
    require_permission(
        user,
        MANAGE_TRAINING,
        scope=training_authorization_scope(organization.id),
    )
    normalized_code = normalize_code(course_code)
    if not normalized_code:
        raise ValidationError({"course_code": "Course / training reference is required."})
    if status not in TrainingRecordStatus.values:
        raise ValidationError({"status": "Unknown training record status."})
    if expires_on is not None and expires_on < trained_on:
        raise ValidationError({"expires_on": "expires_on cannot be earlier than trained_on."})
    process_ref = (process_reference or "").strip()
    _validate_scope_associations(
        organization=organization,
        competency_scope=competency_scope,
        checklist_template=checklist_template,
        process_reference=process_ref,
        equipment=equipment,
        business_role=business_role,
    )

    record = TrainingRecord(
        organization=organization,
        subject_user=subject_user,
        course_code=normalized_code,
        course_name=normalize_name(course_name),
        competency_scope=competency_scope,
        checklist_template=checklist_template,
        process_reference=process_ref,
        equipment=equipment,
        business_role=business_role,
        trained_on=trained_on,
        expires_on=expires_on,
        trainer_reference=(trainer_reference or "").strip(),
        evidence_reference=(evidence_reference or "").strip(),
        status=status,
        recorded_by=user,
        notes=(notes or "").strip(),
    )
    record.full_clean()
    record.save()
    record_event(
        event_type="TRAINING_RECORD_CREATED",
        actor=user,
        metadata=_training_metadata(record),
    )
    return record


@atomic_fn
def update_training_record(
    *,
    actor: User | None,
    training_record_id: uuid.UUID,
    course_code: str | None = None,
    course_name: Any = _UNSET,
    trained_on: datetime.date | None = None,
    expires_on: Any = _UNSET,
    trainer_reference: Any = _UNSET,
    evidence_reference: Any = _UNSET,
    notes: Any = _UNSET,
) -> TrainingRecord:
    """
    Update non-scope identity / evidence metadata.

    Scope associations are immutable after create (re-record + SUPERSEDE instead).
    """
    user = _require_authenticated_actor(actor)
    record = lock_queryset(
        TrainingRecord.objects.select_related("organization").filter(pk=training_record_id)
    ).first()
    if record is None:
        raise ValidationError({"training": "Training record not found."})
    require_permission(
        user,
        MANAGE_TRAINING,
        scope=training_authorization_scope(record.organization_id),
    )

    next_trained = trained_on if trained_on is not None else record.trained_on
    next_expires = record.expires_on if expires_on is _UNSET else expires_on
    if next_expires is not None and next_expires < next_trained:
        raise ValidationError({"expires_on": "expires_on cannot be earlier than trained_on."})

    field_map: dict[str, Any] = {
        "course_code": (
            normalize_code(course_code) if course_code is not None else record.course_code
        ),
        "course_name": (
            record.course_name if course_name is _UNSET else normalize_name(course_name or "")
        ),
        "trained_on": next_trained,
        "expires_on": next_expires,
        "trainer_reference": (
            record.trainer_reference
            if trainer_reference is _UNSET
            else (trainer_reference or "").strip()
        ),
        "evidence_reference": (
            record.evidence_reference
            if evidence_reference is _UNSET
            else (evidence_reference or "").strip()
        ),
        "notes": record.notes if notes is _UNSET else (notes or "").strip(),
    }
    if not field_map["course_code"]:
        raise ValidationError({"course_code": "Course / training reference is required."})

    changed: list[str] = []
    for field, value in field_map.items():
        if getattr(record, field) != value:
            setattr(record, field, value)
            changed.append(field)
    if not changed:
        return record
    record.full_clean()
    record.save()
    record_event(
        event_type="TRAINING_RECORD_UPDATED",
        actor=user,
        metadata=_training_metadata(record, changed_fields=changed),
    )
    return record


@atomic_fn
def set_training_record_status(
    *,
    actor: User | None,
    training_record_id: uuid.UUID,
    status: str,
) -> TrainingRecord:
    user = _require_authenticated_actor(actor)
    record = locked_get(TrainingRecord, pk=training_record_id)
    if record is None:
        raise ValidationError({"training": "Training record not found."})
    require_permission(
        user,
        MANAGE_TRAINING,
        scope=training_authorization_scope(record.organization_id),
    )
    if status not in TrainingRecordStatus.values:
        raise ValidationError({"status": "Unknown training record status."})
    if record.status == status:
        return record
    before = record.status
    record.status = status
    record.save(update_fields=["status", "updated_at"])
    record_event(
        event_type="TRAINING_RECORD_STATUS_CHANGED",
        actor=user,
        metadata={
            **_training_metadata(record),
            "status_before": before,
            "status_after": status,
        },
    )
    return record


@atomic_fn
def set_training_enforcement_policy(
    *,
    actor: User | None,
    organization: Organization,
    gate_mode: str,
    notes: str = "",
) -> TrainingEnforcementPolicy:
    """
    Configure future WARN/BLOCK mode storage.

    Does **not** wire recording to enforce the mode. Production enablement needs APR.
    """
    user = _require_authenticated_actor(actor)
    require_permission(
        user,
        MANAGE_TRAINING,
        scope=training_authorization_scope(organization.id),
    )
    if gate_mode not in TrainingGateMode.values:
        raise ValidationError({"gate_mode": "Unknown training gate mode."})

    policy = lock_queryset(
        TrainingEnforcementPolicy.objects.filter(organization=organization)
    ).first()
    created = False
    before_mode: str | None = None
    if policy is None:
        policy = TrainingEnforcementPolicy(
            organization=organization,
            gate_mode=gate_mode,
            notes=(notes or "").strip(),
            updated_by=user,
        )
        created = True
    else:
        before_mode = policy.gate_mode
        if policy.gate_mode == gate_mode and policy.notes == (notes or "").strip():
            return policy
        policy.gate_mode = gate_mode
        policy.notes = (notes or "").strip()
        policy.updated_by = user
    policy.full_clean()
    policy.save()
    record_event(
        event_type=(
            "TRAINING_ENFORCEMENT_POLICY_CREATED"
            if created
            else "TRAINING_ENFORCEMENT_POLICY_UPDATED"
        ),
        actor=user,
        metadata={
            **_policy_metadata(policy),
            "gate_mode_before": before_mode,
        },
    )
    return policy


def get_training_currency(
    record: TrainingRecord,
    *,
    as_of: datetime.date | None = None,
) -> str:
    return evaluate_training_currency(record, as_of=as_of)


def recommend_recording_gate_action(
    *,
    currency: str,
    gate_mode: str | None = None,
    organization_id: uuid.UUID | None = None,
) -> str:
    """
    Map currency + configured mode → ALLOW / WARN / BLOCK recommendation.

    Never called by recording services in Phase 05E. Competency that is VALID
    always yields ALLOW. Missing / expired / future / inactive yields the
    configured mode (WARN/BLOCK) or ALLOW when mode is OFF / unset.
    """
    mode = gate_mode or resolve_training_gate_mode(organization_id)
    if currency == TrainingCurrency.VALID:
        return RecordingGateRecommendation.ALLOW
    if mode == TrainingGateMode.WARN:
        return RecordingGateRecommendation.WARN
    if mode == TrainingGateMode.BLOCK:
        return RecordingGateRecommendation.BLOCK
    return RecordingGateRecommendation.ALLOW


def delete_training_record(record: TrainingRecord) -> None:
    refuse_hard_delete_training_record(record)


def delete_training_enforcement_policy(policy: TrainingEnforcementPolicy) -> None:
    refuse_hard_delete_training_policy(policy)
