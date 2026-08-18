"""Quality risk services — Phase 47 (ADR-058).

No invented 1–5 matrix, RAG thresholds, or acceptance criteria.
Scoring text is stored only when an owner-cited policy is enabled.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db.models import Max
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.capa.services import create_corrective_action
from apps.change_control.services import create_quality_change
from apps.quality_risks.models import (
    RISK_TRANSITIONS,
    QualityRisk,
    QualityRiskAssessment,
    QualityRiskCategoryConfig,
    QualityRiskEvent,
    QualityRiskLink,
    QualityRiskLinkKind,
    QualityRiskMitigation,
    QualityRiskMitigationKind,
    QualityRiskReview,
    QualityRiskScoringPolicy,
    QualityRiskStatus,
)
from apps.security_audit.services import record_event

PERM_VIEW = "quality_risks.view_qualityrisk"
PERM_MANAGE = "quality_risks.manage_qualityrisk"
PERM_ASSESS = "quality_risks.assess_qualityrisk"
PERM_ACCEPT = "quality_risks.accept_qualityrisk"
PERM_POLICY = "quality_risks.manage_qualityriskpolicy"


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User, permission: str, organization_id: uuid.UUID) -> None:
    if not user_has_permission(actor, permission, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")


def _append_event(
    *,
    risk: QualityRisk,
    event_type: str,
    actor: User,
    summary: str,
    payload: dict[str, Any] | None = None,
) -> QualityRiskEvent:
    return QualityRiskEvent.objects.create(
        risk=risk,
        event_type=event_type,
        summary=summary,
        payload=payload or {},
        actor=actor,
    )


def _assert_not_terminal(risk: QualityRisk) -> None:
    if risk.is_terminal:
        raise ValidationError({"status": "Closed or cancelled risks are historically immutable."})


def _transition(risk: QualityRisk, target: str) -> None:
    allowed = RISK_TRANSITIONS.get(risk.status, frozenset())
    if target not in allowed:
        raise ValidationError({"status": f"Cannot transition risk from {risk.status} to {target}."})


def get_or_create_scoring_policy(
    *, organization_id: uuid.UUID, actor: User
) -> QualityRiskScoringPolicy:
    policy = QualityRiskScoringPolicy.objects.filter(organization_id=organization_id).first()
    if policy is not None:
        return policy
    return QualityRiskScoringPolicy.objects.create(
        organization_id=organization_id,
        scoring_enabled=False,
        formula_citation="",
        high_rated_codes=[],
        updated_by=actor,
    )


def _resolve_link_object(
    *, organization_id: uuid.UUID, link_kind: str, linked_object_id: uuid.UUID
) -> None:
    if link_kind in {QualityRiskLinkKind.PROCESS, QualityRiskLinkKind.SYSTEM_FEATURE}:
        return
    found = False
    if link_kind == QualityRiskLinkKind.PRODUCT:
        from apps.master_data.models import FGProduct

        found = FGProduct.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == QualityRiskLinkKind.HACCP:
        from apps.haccp.models import ControlPoint, HaccpPlan

        found = (
            HaccpPlan.objects.filter(pk=linked_object_id, organization_id=organization_id).exists()
            or ControlPoint.objects.filter(
                pk=linked_object_id, plan_version__plan__organization_id=organization_id
            ).exists()
        )
    elif link_kind == QualityRiskLinkKind.SUPPLIER:
        from apps.supplier_quality.models import SupplierQualityProfile

        found = SupplierQualityProfile.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == QualityRiskLinkKind.EQUIPMENT:
        from apps.instruments.models import Equipment

        found = Equipment.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == QualityRiskLinkKind.NCR:
        from apps.nonconformance.models import NonConformanceRecord

        found = NonConformanceRecord.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == QualityRiskLinkKind.CAPA:
        from apps.capa.models import CorrectiveAction

        found = CorrectiveAction.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == QualityRiskLinkKind.AUDIT:
        from apps.quality_audits.models import QualityAudit

        found = QualityAudit.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == QualityRiskLinkKind.CHANGE_CONTROL:
        from apps.change_control.models import QualityChangeRequest

        found = QualityChangeRequest.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    if not found:
        raise ValidationError(
            {"linked_object_id": "Linked object was not found in this organization."}
        )


@atomic_fn
def create_quality_risk(
    *,
    actor: User,
    organization_id: uuid.UUID,
    risk_code: str,
    title: str,
    category_code: str = "",
    cause: str = "",
    potential_impact: str = "",
    existing_control: str = "",
    description: str = "",
    owner: User | None = None,
    owner_reference: str = "",
    next_review_date: date | None = None,
) -> QualityRisk:
    _require(actor, PERM_MANAGE, organization_id)
    code = (risk_code or "").strip()
    if QualityRisk.objects.filter(organization_id=organization_id, risk_code__iexact=code).exists():
        raise ValidationError({"risk_code": "A risk with this identifier already exists."})
    category = (category_code or "").strip()
    if (
        category
        and not QualityRiskCategoryConfig.objects.filter(
            organization_id=organization_id, code__iexact=category, is_active=True
        ).exists()
    ):
        raise ValidationError(
            {"category_code": "Category must be an owner-configured active code."}
        )
    risk = QualityRisk(
        organization_id=organization_id,
        risk_code=code,
        title=(title or "").strip(),
        category_code=category,
        cause=cause or "",
        potential_impact=potential_impact or "",
        existing_control=existing_control or "",
        description=description or "",
        owner=owner,
        owner_reference=(owner_reference or "").strip(),
        status=QualityRiskStatus.DRAFT,
        next_review_date=next_review_date,
        created_by=actor,
    )
    risk.full_clean()
    risk.save()
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_CREATED",
        actor=actor,
        summary="Quality risk created. No scoring methodology applied.",
        payload={"risk_code": risk.risk_code, "scoring_applied": False},
    )
    record_event(
        event_type="QUALITY_RISK_CREATED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "risk_id": str(risk.id),
            "module": "quality_risks",
            "no_invented_matrix": True,
        },
    )
    return risk


@atomic_fn
def open_quality_risk(*, actor: User, risk_id: uuid.UUID) -> QualityRisk:
    risk = QualityRisk.objects.select_related("organization").get(pk=risk_id)
    _require(actor, PERM_MANAGE, risk.organization_id)
    _assert_not_terminal(risk)
    _transition(risk, QualityRiskStatus.OPEN)
    risk.status = QualityRiskStatus.OPEN
    risk.save(update_fields=["status", "updated_at"])
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_OPENED",
        actor=actor,
        summary="Quality risk opened.",
        payload={},
    )
    record_event(
        event_type="QUALITY_RISK_OPENED",
        actor=actor,
        metadata={"organization_id": str(risk.organization_id), "risk_id": str(risk.id)},
    )
    return risk


@atomic_fn
def accept_quality_risk(
    *, actor: User, risk_id: uuid.UUID, acceptance_rationale: str
) -> QualityRisk:
    risk = QualityRisk.objects.select_related("organization").get(pk=risk_id)
    _require(actor, PERM_ACCEPT, risk.organization_id)
    _assert_not_terminal(risk)
    rationale = (acceptance_rationale or "").strip()
    if not rationale:
        raise ValidationError({"acceptance_rationale": "Acceptance rationale is required."})
    _transition(risk, QualityRiskStatus.ACCEPTED)
    risk.status = QualityRiskStatus.ACCEPTED
    risk.accepted_by = actor
    risk.accepted_at = timezone.now()
    risk.acceptance_rationale = rationale
    risk.save(
        update_fields=[
            "status",
            "accepted_by",
            "accepted_at",
            "acceptance_rationale",
            "updated_at",
        ]
    )
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_ACCEPTED",
        actor=actor,
        summary="Residual risk accepted under permission control. Not a company matrix claim.",
        payload={"no_invented_acceptance_threshold": True},
    )
    record_event(
        event_type="QUALITY_RISK_ACCEPTED",
        actor=actor,
        metadata={"organization_id": str(risk.organization_id), "risk_id": str(risk.id)},
    )
    return risk


@atomic_fn
def close_quality_risk(*, actor: User, risk_id: uuid.UUID) -> QualityRisk:
    risk = QualityRisk.objects.select_related("organization").get(pk=risk_id)
    _require(actor, PERM_MANAGE, risk.organization_id)
    _assert_not_terminal(risk)
    _transition(risk, QualityRiskStatus.CLOSED)
    risk.status = QualityRiskStatus.CLOSED
    risk.closed_by = actor
    risk.closed_at = timezone.now()
    risk.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_CLOSED",
        actor=actor,
        summary="Quality risk closed.",
        payload={},
    )
    record_event(
        event_type="QUALITY_RISK_CLOSED",
        actor=actor,
        metadata={"organization_id": str(risk.organization_id), "risk_id": str(risk.id)},
    )
    return risk


@atomic_fn
def cancel_quality_risk(*, actor: User, risk_id: uuid.UUID) -> QualityRisk:
    risk = QualityRisk.objects.select_related("organization").get(pk=risk_id)
    _require(actor, PERM_MANAGE, risk.organization_id)
    _assert_not_terminal(risk)
    _transition(risk, QualityRiskStatus.CANCELLED)
    risk.status = QualityRiskStatus.CANCELLED
    risk.closed_by = actor
    risk.closed_at = timezone.now()
    risk.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_CANCELLED",
        actor=actor,
        summary="Quality risk cancelled.",
        payload={},
    )
    record_event(
        event_type="QUALITY_RISK_CANCELLED",
        actor=actor,
        metadata={"organization_id": str(risk.organization_id), "risk_id": str(risk.id)},
    )
    return risk


@atomic_fn
def record_risk_assessment(
    *,
    actor: User,
    risk_id: uuid.UUID,
    likelihood_input: str = "",
    severity_input: str = "",
    detectability_input: str = "",
    exposure_input: str = "",
    residual_risk_input: str = "",
    computed_score_text: str = "",
    notes: str = "",
) -> QualityRiskAssessment:
    risk = QualityRisk.objects.select_related("organization").get(pk=risk_id)
    _require(actor, PERM_ASSESS, risk.organization_id)
    _assert_not_terminal(risk)
    policy = get_or_create_scoring_policy(organization_id=risk.organization_id, actor=actor)
    score_text = (computed_score_text or "").strip()
    if score_text and not policy.scoring_enabled:
        raise ValidationError(
            {
                "computed_score_text": (
                    "Computed score text is refused while scoring is disabled. "
                    "No invented 1–5 or RAG matrix is applied."
                )
            }
        )
    if policy.scoring_enabled and not (policy.formula_citation or "").strip():
        raise ValidationError(
            {
                "formula_citation": (
                    "Scoring is enabled but no owner-cited formula reference is configured."
                )
            }
        )
    next_version = (
        QualityRiskAssessment.objects.filter(risk=risk).aggregate(m=Max("version_number"))["m"] or 0
    ) + 1
    assessment = QualityRiskAssessment(
        risk=risk,
        version_number=next_version,
        likelihood_input=(likelihood_input or "").strip(),
        severity_input=(severity_input or "").strip(),
        detectability_input=(detectability_input or "").strip(),
        exposure_input=(exposure_input or "").strip(),
        residual_risk_input=(residual_risk_input or "").strip(),
        computed_score_text=score_text,
        method_citation=(policy.formula_citation or "").strip(),
        notes=notes or "",
        assessed_by=actor,
    )
    assessment.full_clean()
    assessment.save()
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_ASSESSED",
        actor=actor,
        summary="Historical assessment recorded. Previous assessments were not overwritten.",
        payload={
            "version_number": next_version,
            "scoring_enabled": policy.scoring_enabled,
            "computed": bool(score_text),
        },
    )
    record_event(
        event_type="QUALITY_RISK_ASSESSED",
        actor=actor,
        metadata={
            "organization_id": str(risk.organization_id),
            "risk_id": str(risk.id),
            "version_number": next_version,
        },
    )
    return assessment


@atomic_fn
def record_risk_review(
    *,
    actor: User,
    risk_id: uuid.UUID,
    notes: str,
    next_review_date: date | None = None,
) -> QualityRiskReview:
    risk = QualityRisk.objects.select_related("organization").get(pk=risk_id)
    _require(actor, PERM_MANAGE, risk.organization_id)
    _assert_not_terminal(risk)
    if not (notes or "").strip():
        raise ValidationError({"notes": "Review notes are required."})
    review = QualityRiskReview(
        risk=risk,
        notes=notes,
        next_review_date=next_review_date,
        reviewed_by=actor,
    )
    review.full_clean()
    review.save()
    if next_review_date is not None:
        risk.next_review_date = next_review_date
        risk.save(update_fields=["next_review_date", "updated_at"])
    if risk.status == QualityRiskStatus.OPEN:
        _transition(risk, QualityRiskStatus.UNDER_REVIEW)
        risk.status = QualityRiskStatus.UNDER_REVIEW
        risk.save(update_fields=["status", "updated_at"])
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_REVIEWED",
        actor=actor,
        summary="Periodic review recorded. Assessment history was not overwritten.",
        payload={"next_review_date": str(next_review_date) if next_review_date else ""},
    )
    record_event(
        event_type="QUALITY_RISK_REVIEWED",
        actor=actor,
        metadata={"organization_id": str(risk.organization_id), "risk_id": str(risk.id)},
    )
    return review


@atomic_fn
def link_quality_risk(
    *,
    actor: User,
    risk_id: uuid.UUID,
    link_kind: str,
    citation: str = "",
    linked_object_id: uuid.UUID | None = None,
) -> QualityRiskLink:
    risk = QualityRisk.objects.select_related("organization").get(pk=risk_id)
    _require(actor, PERM_MANAGE, risk.organization_id)
    _assert_not_terminal(risk)
    if link_kind not in QualityRiskLinkKind.values:
        raise ValidationError({"link_kind": "Unknown risk link kind."})
    if linked_object_id is not None:
        _resolve_link_object(
            organization_id=risk.organization_id,
            link_kind=link_kind,
            linked_object_id=linked_object_id,
        )
    link = QualityRiskLink(
        risk=risk,
        link_kind=link_kind,
        linked_object_id=linked_object_id,
        citation=(citation or "").strip(),
        created_by=actor,
    )
    link.full_clean()
    link.save()
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_LINKED",
        actor=actor,
        summary="Risk context link recorded.",
        payload={"link_kind": link_kind},
    )
    record_event(
        event_type="QUALITY_RISK_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(risk.organization_id),
            "risk_id": str(risk.id),
            "link_kind": link_kind,
        },
    )
    return link


@atomic_fn
def add_risk_mitigation(
    *,
    actor: User,
    risk_id: uuid.UUID,
    mitigation_kind: str,
    summary: str,
    citation: str = "",
    due_date: date | None = None,
    owner: User | None = None,
    create_follow_up: bool = False,
    capa_code: str = "",
    change_code: str = "",
    existing_capa_id: uuid.UUID | None = None,
    existing_change_id: uuid.UUID | None = None,
    existing_training_id: uuid.UUID | None = None,
    existing_document_version_id: uuid.UUID | None = None,
) -> QualityRiskMitigation:
    risk = QualityRisk.objects.select_related("organization").get(pk=risk_id)
    _require(actor, PERM_MANAGE, risk.organization_id)
    _assert_not_terminal(risk)
    kind = (mitigation_kind or "").strip().upper()
    if kind not in QualityRiskMitigationKind.values:
        raise ValidationError({"mitigation_kind": "Unknown mitigation kind."})
    mitigation = QualityRiskMitigation(
        risk=risk,
        mitigation_kind=kind,
        summary=(summary or "").strip(),
        citation=(citation or "").strip(),
        due_date=due_date,
        owner=owner,
        created_by=actor,
    )
    org = risk.organization
    if kind == QualityRiskMitigationKind.CAPA:
        if create_follow_up:
            supplied = (capa_code or "").strip()
            if not supplied:
                raise ValidationError({"capa_code": "Owner-supplied CAPA code is required."})
            mitigation.corrective_action = create_corrective_action(
                actor=actor,
                organization=org,
                code=supplied,
                title=f"Risk {risk.risk_code}",
                summary=mitigation.summary[:500],
            )
        elif existing_capa_id is not None:
            from apps.capa.models import CorrectiveAction

            found_capa = CorrectiveAction.objects.filter(
                pk=existing_capa_id, organization_id=org.id
            ).first()
            if found_capa is None:
                raise ValidationError({"existing_capa_id": "CAPA not found in organization."})
            mitigation.corrective_action = found_capa
        elif not mitigation.citation:
            raise ValidationError(
                {"citation": "Provide create_follow_up, existing_capa_id, or citation."}
            )
    elif kind == QualityRiskMitigationKind.CHANGE_REQUEST:
        if create_follow_up:
            supplied = (change_code or "").strip()
            if not supplied:
                raise ValidationError({"change_code": "Owner-supplied change code is required."})
            mitigation.change_request = create_quality_change(
                actor=actor,
                organization_id=org.id,
                change_code=supplied,
                title=f"Risk {risk.risk_code}",
                description=mitigation.summary,
                reason="Explicit quality-risk mitigation (not auto-created).",
            )
        elif existing_change_id is not None:
            from apps.change_control.models import QualityChangeRequest

            found_change = QualityChangeRequest.objects.filter(
                pk=existing_change_id, organization_id=org.id
            ).first()
            if found_change is None:
                raise ValidationError({"existing_change_id": "Change request not found."})
            mitigation.change_request = found_change
        elif not mitigation.citation:
            raise ValidationError(
                {"citation": "Provide create_follow_up, existing_change_id, or citation."}
            )
    elif kind == QualityRiskMitigationKind.TRAINING:
        if existing_training_id is not None:
            from apps.training.models import TrainingRecord

            found_training = TrainingRecord.objects.filter(
                pk=existing_training_id, organization_id=org.id
            ).first()
            if found_training is None:
                raise ValidationError({"existing_training_id": "Training record not found."})
            mitigation.training_record = found_training
        elif not mitigation.citation:
            raise ValidationError({"citation": "Provide existing_training_id or citation."})
    elif kind == QualityRiskMitigationKind.DOCUMENT:
        if existing_document_version_id is not None:
            from apps.document_control.models import QualityDocumentVersion

            found_doc = QualityDocumentVersion.objects.filter(
                pk=existing_document_version_id, document__organization_id=org.id
            ).first()
            if found_doc is None:
                raise ValidationError(
                    {"existing_document_version_id": "Document version not found."}
                )
            mitigation.document_version = found_doc
        elif not mitigation.citation:
            raise ValidationError({"citation": "Provide existing_document_version_id or citation."})
    elif kind == QualityRiskMitigationKind.CONTROL and not mitigation.citation:
        raise ValidationError({"citation": "Control mitigation requires an owner-cited control."})
    mitigation.full_clean()
    mitigation.save()
    if risk.status in {
        QualityRiskStatus.OPEN,
        QualityRiskStatus.UNDER_REVIEW,
        QualityRiskStatus.ACCEPTED,
    }:
        _transition(risk, QualityRiskStatus.MITIGATING)
        risk.status = QualityRiskStatus.MITIGATING
        risk.save(update_fields=["status", "updated_at"])
    _append_event(
        risk=risk,
        event_type="QUALITY_RISK_MITIGATION_ADDED",
        actor=actor,
        summary=f"{kind} mitigation recorded.",
        payload={"mitigation_kind": kind, "create_follow_up": create_follow_up},
    )
    record_event(
        event_type="QUALITY_RISK_MITIGATION_ADDED",
        actor=actor,
        metadata={
            "organization_id": str(org.id),
            "risk_id": str(risk.id),
            "mitigation_kind": kind,
        },
    )
    return mitigation


@atomic_fn
def upsert_risk_category(
    *, actor: User, organization_id: uuid.UUID, code: str, label: str, is_active: bool = True
) -> QualityRiskCategoryConfig:
    _require(actor, PERM_POLICY, organization_id)
    normalized = (code or "").strip()
    if not normalized:
        raise ValidationError({"code": "Category code is required."})
    config, _created = QualityRiskCategoryConfig.objects.get_or_create(
        organization_id=organization_id,
        code=normalized,
        defaults={
            "label": (label or "").strip() or normalized,
            "is_active": is_active,
            "created_by": actor,
        },
    )
    config.label = (label or "").strip() or normalized
    config.is_active = is_active
    config.save()
    record_event(
        event_type="QUALITY_RISK_CATEGORY_UPSERTED",
        actor=actor,
        metadata={"organization_id": str(organization_id), "code": normalized},
    )
    return config


@atomic_fn
def configure_scoring_policy(
    *,
    actor: User,
    organization_id: uuid.UUID,
    scoring_enabled: bool,
    formula_citation: str = "",
    high_rated_codes: list[str] | None = None,
) -> QualityRiskScoringPolicy:
    _require(actor, PERM_POLICY, organization_id)
    citation = (formula_citation or "").strip()
    if scoring_enabled and not citation:
        raise ValidationError(
            {
                "formula_citation": (
                    "Enabling scoring requires an owner-cited company method. "
                    "No 1–5 or RAG matrix is invented."
                )
            }
        )
    codes = list(high_rated_codes or [])
    policy = get_or_create_scoring_policy(organization_id=organization_id, actor=actor)
    policy.scoring_enabled = scoring_enabled
    policy.formula_citation = citation
    policy.high_rated_codes = codes
    policy.updated_by = actor
    policy.save()
    record_event(
        event_type="QUALITY_RISK_SCORING_POLICY_UPDATED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "scoring_enabled": scoring_enabled,
            "no_invented_matrix": True,
        },
    )
    return policy
