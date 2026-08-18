"""Quality risk selectors and dashboard queries — Phase 47."""

from __future__ import annotations

import uuid
from datetime import date

from django.core.exceptions import PermissionDenied
from django.db.models import Max, QuerySet
from django.utils import timezone

from apps.access_control.services import user_has_permission
from apps.accounts.models import User
from apps.quality_risks.models import (
    QualityRisk,
    QualityRiskAssessment,
    QualityRiskEvent,
    QualityRiskStatus,
)
from apps.quality_risks.services import PERM_VIEW, _scope


def list_quality_risks(
    *, actor: User, organization_id: uuid.UUID, status: str | None = None
) -> QuerySet[QualityRisk]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    qs = QualityRisk.objects.filter(organization_id=organization_id)
    if status:
        qs = qs.filter(status=status)
    return qs.order_by("-created_at")


def get_quality_risk_for_org(
    *, actor: User, organization_id: uuid.UUID, risk_id: uuid.UUID
) -> QualityRisk:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return QualityRisk.objects.get(pk=risk_id, organization_id=organization_id)


def list_risk_assessments(*, risk: QualityRisk) -> QuerySet[QualityRiskAssessment]:
    return risk.assessments.all()


def list_risk_events(*, risk: QualityRisk) -> QuerySet[QualityRiskEvent]:
    return risk.events.all()


def report_open_risks(*, actor: User, organization_id: uuid.UUID) -> QuerySet[QualityRisk]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return QualityRisk.objects.filter(
        organization_id=organization_id,
        status__in={
            QualityRiskStatus.OPEN,
            QualityRiskStatus.UNDER_REVIEW,
            QualityRiskStatus.ACCEPTED,
            QualityRiskStatus.MITIGATING,
        },
    ).order_by("next_review_date", "created_at")


def report_overdue_reviews(
    *, actor: User, organization_id: uuid.UUID, as_of: date | None = None
) -> QuerySet[QualityRisk]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    today = as_of or timezone.localdate()
    return (
        QualityRisk.objects.filter(
            organization_id=organization_id,
            next_review_date__lt=today,
        )
        .exclude(status__in={QualityRiskStatus.CLOSED, QualityRiskStatus.CANCELLED})
        .order_by("next_review_date")
    )


def report_high_rated_risks(*, actor: User, organization_id: uuid.UUID) -> QuerySet[QualityRisk]:
    """High-rated only when an owner-configured policy is enabled and codes exist."""
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    # Actor is required for policy create-on-read fallback; view-only users must not mutate.
    policy = QualityRiskScoringPolicyView(organization_id)
    if not policy.scoring_enabled or not policy.high_rated_codes:
        return QualityRisk.objects.none()
    latest = (
        QualityRiskAssessment.objects.filter(risk__organization_id=organization_id)
        .values("risk_id")
        .annotate(latest_version=Max("version_number"))
    )
    latest_ids = []
    for row in latest:
        assessment = QualityRiskAssessment.objects.filter(
            risk_id=row["risk_id"], version_number=row["latest_version"]
        ).first()
        if assessment is not None and assessment.residual_risk_input in policy.high_rated_codes:
            latest_ids.append(assessment.risk_id)
    return QualityRisk.objects.filter(pk__in=latest_ids).exclude(
        status__in={QualityRiskStatus.CLOSED, QualityRiskStatus.CANCELLED}
    )


class QualityRiskScoringPolicyView:
    def __init__(self, organization_id: uuid.UUID) -> None:
        from apps.quality_risks.models import QualityRiskScoringPolicy

        policy = QualityRiskScoringPolicy.objects.filter(organization_id=organization_id).first()
        self.scoring_enabled = bool(policy and policy.scoring_enabled)
        self.high_rated_codes = list(policy.high_rated_codes) if policy else []
