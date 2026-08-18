"""Permission-aware training selectors."""

from __future__ import annotations

import datetime
import uuid

from django.core.exceptions import PermissionDenied
from django.db.models import QuerySet

from apps.access_control.services import (
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.training.models import (
    CompetencyScopeKind,
    TrainingCurrency,
    TrainingEnforcementPolicy,
    TrainingRecord,
    TrainingRecordStatus,
    evaluate_training_currency,
    resolve_training_gate_mode,
)
from apps.training.services import (
    MANAGE_TRAINING,
    VIEW_TRAINING,
    training_authorization_scope,
)


def actor_can_view_training(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, VIEW_TRAINING))


def actor_can_manage_training(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, MANAGE_TRAINING))


def get_training_record(actor: User | None, training_record_id: uuid.UUID) -> TrainingRecord | None:
    record = (
        TrainingRecord.objects.select_related(
            "organization",
            "subject_user",
            "checklist_template",
            "equipment",
            "business_role",
            "recorded_by",
        )
        .filter(pk=training_record_id)
        .first()
    )
    if record is None:
        return None
    if not user_has_permission(
        actor,
        VIEW_TRAINING,
        scope=training_authorization_scope(record.organization_id),
    ):
        raise PermissionDenied("Permission denied.")
    return record


def list_training_records(
    actor: User | None,
    *,
    organization: Organization | None = None,
    subject_user: User | None = None,
    competency_scope: str | None = None,
    status: str | None = None,
) -> QuerySet[TrainingRecord]:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return TrainingRecord.objects.none()
    allowed = organization_ids_with_permission(actor, VIEW_TRAINING)
    if not allowed:
        return TrainingRecord.objects.none()
    qs = TrainingRecord.objects.select_related(
        "organization", "subject_user", "recorded_by"
    ).filter(organization_id__in=allowed)
    if organization is not None:
        if organization.id not in allowed:
            return TrainingRecord.objects.none()
        qs = qs.filter(organization=organization)
    if subject_user is not None:
        qs = qs.filter(subject_user=subject_user)
    if competency_scope:
        qs = qs.filter(competency_scope=competency_scope)
    if status:
        qs = qs.filter(status=status)
    return qs.order_by("-trained_on", "-created_at")


def get_training_enforcement_policy(
    actor: User | None,
    organization: Organization,
) -> TrainingEnforcementPolicy | None:
    if not user_has_permission(
        actor,
        VIEW_TRAINING,
        scope=training_authorization_scope(organization.id),
    ):
        raise PermissionDenied("Permission denied.")
    return TrainingEnforcementPolicy.objects.filter(organization=organization).first()


def list_valid_training_for_subject(
    actor: User | None,
    *,
    organization: Organization,
    subject_user: User,
    as_of: datetime.date | None = None,
    competency_scope: str | None = None,
) -> list[TrainingRecord]:
    """Return ACTIVE records that evaluate to VALID as of the given date."""
    qs = list_training_records(
        actor,
        organization=organization,
        subject_user=subject_user,
        competency_scope=competency_scope,
        status=TrainingRecordStatus.ACTIVE,
    )
    return [
        row for row in qs if evaluate_training_currency(row, as_of=as_of) == TrainingCurrency.VALID
    ]


def subject_has_valid_general_training(
    *,
    organization: Organization,
    subject_user: User,
    course_code: str,
    as_of: datetime.date | None = None,
) -> bool:
    """
    Pure competency lookup (no auth) for architectural gate evaluation helpers.

    Does not invent required courses — callers supply an evidenced course_code.
    """
    code = course_code.strip().upper()
    rows = TrainingRecord.objects.filter(
        organization=organization,
        subject_user=subject_user,
        course_code=code,
        competency_scope=CompetencyScopeKind.GENERAL,
        status=TrainingRecordStatus.ACTIVE,
    )
    return any(
        evaluate_training_currency(row, as_of=as_of) == TrainingCurrency.VALID for row in rows
    )


def organization_gate_mode(organization: Organization) -> str:
    return resolve_training_gate_mode(organization.id)
