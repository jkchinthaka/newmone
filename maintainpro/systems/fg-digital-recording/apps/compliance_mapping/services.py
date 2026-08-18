"""Compliance control-mapping services — Phase 46 (ADR-057).

IMPLEMENTED is never COMPLIANT. Gap follow-up is never automatic.
External standard text is not stored or invented.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.capa.services import create_corrective_action
from apps.change_control.services import create_quality_change
from apps.compliance_mapping.models import (
    MAPPING_TRANSITIONS,
    ApplicabilityStatus,
    ComplianceControlMapping,
    ComplianceEvidenceLink,
    ComplianceGap,
    ComplianceGapAction,
    ComplianceMappingEvent,
    ComplianceSource,
    ComplianceSourceEdition,
    ComplianceSourceKind,
    ControlMappingStatus,
    GapActionKind,
    SourceRegisterStatus,
    SystemControlKind,
)
from apps.nonconformance.models import NonConformanceSource
from apps.nonconformance.services import create_nonconformance
from apps.security_audit.services import record_event

PERM_VIEW = "compliance_mapping.view_compliancemapping"
PERM_MANAGE_SOURCE = "compliance_mapping.manage_compliancesource"
PERM_MANAGE_CONTROL = "compliance_mapping.manage_compliancecontrol"
PERM_VERIFY = "compliance_mapping.verify_compliancecontrol"
PERM_LINK_GAP = "compliance_mapping.link_compliance_gap_action"


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User, permission: str, organization_id: uuid.UUID) -> None:
    if not user_has_permission(actor, permission, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")


def _append_event(
    *,
    organization_id: uuid.UUID,
    source: ComplianceSource,
    event_type: str,
    actor: User,
    summary: str,
    edition: ComplianceSourceEdition | None = None,
    mapping: ComplianceControlMapping | None = None,
    gap: ComplianceGap | None = None,
    payload: dict[str, Any] | None = None,
) -> ComplianceMappingEvent:
    return ComplianceMappingEvent.objects.create(
        organization_id=organization_id,
        source=source,
        edition=edition,
        mapping=mapping,
        gap=gap,
        event_type=event_type,
        summary=summary,
        payload=payload or {},
        actor=actor,
    )


def _assert_edition_mutable(edition: ComplianceSourceEdition) -> None:
    if edition.is_locked:
        raise ValidationError(
            {"register_status": "Superseded or withdrawn editions are historically immutable."}
        )


def _transition_mapping(mapping: ComplianceControlMapping, target: str) -> None:
    if target == "COMPLIANT":
        raise ValidationError({"status": "IMPLEMENTED is not COMPLIANT."})
    if target not in ControlMappingStatus.values:
        raise ValidationError({"status": "Unknown mapping status."})
    allowed = MAPPING_TRANSITIONS.get(mapping.status, frozenset())
    if target not in allowed:
        raise ValidationError(
            {"status": f"Cannot transition mapping from {mapping.status} to {target}."}
        )


def _resolve_evidence_object(
    *,
    organization_id: uuid.UUID,
    evidence_kind: str,
    linked_object_id: uuid.UUID,
) -> None:
    if evidence_kind in {
        SystemControlKind.SECURITY_CONTROL,
        SystemControlKind.BACKUP_DR,
        SystemControlKind.OTHER,
    }:
        return
    found = False
    if evidence_kind == SystemControlKind.CHECKLIST_DEFINITION:
        from apps.checklists.models import ChecklistTemplate, ChecklistVersion

        found = (
            ChecklistTemplate.objects.filter(
                pk=linked_object_id, organization_id=organization_id
            ).exists()
            or ChecklistVersion.objects.filter(
                pk=linked_object_id, template__organization_id=organization_id
            ).exists()
        )
    elif evidence_kind == SystemControlKind.HACCP_CONTROL:
        from apps.haccp.models import ControlPoint, HaccpPlan

        found = (
            HaccpPlan.objects.filter(pk=linked_object_id, organization_id=organization_id).exists()
            or ControlPoint.objects.filter(
                pk=linked_object_id,
                plan_version__plan__organization_id=organization_id,
            ).exists()
        )
    elif evidence_kind == SystemControlKind.TRAINING_RECORD:
        from apps.training.models import TrainingRecord

        found = TrainingRecord.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif evidence_kind == SystemControlKind.CALIBRATION:
        from apps.instruments.models import CalibrationRecord

        found = CalibrationRecord.objects.filter(
            pk=linked_object_id, equipment__organization_id=organization_id
        ).exists()
    elif evidence_kind == SystemControlKind.LABORATORY:
        from apps.laboratory.models import LabSample

        found = LabSample.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif evidence_kind == SystemControlKind.NCR:
        from apps.nonconformance.models import NonConformanceRecord

        found = NonConformanceRecord.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif evidence_kind == SystemControlKind.CAPA:
        from apps.capa.models import CorrectiveAction

        found = CorrectiveAction.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif evidence_kind == SystemControlKind.QUALITY_AUDIT:
        from apps.quality_audits.models import QualityAudit

        found = QualityAudit.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif evidence_kind == SystemControlKind.DOCUMENT_VERSION:
        from apps.document_control.models import QualityDocumentVersion

        found = QualityDocumentVersion.objects.filter(
            pk=linked_object_id, document__organization_id=organization_id
        ).exists()
    if not found:
        raise ValidationError(
            {"linked_object_id": "Evidence object was not found in this organization."}
        )


@atomic_fn
def register_compliance_source(
    *,
    actor: User,
    organization_id: uuid.UUID,
    source_code: str,
    kind: str,
    title: str,
    version_edition: str,
    official_source_citation: str = "",
    applicability_status: str = ApplicabilityStatus.NOT_ASSESSED,
    evidence_reference: str = "",
    last_reviewed_on: date | None = None,
    business_owner_reference: str = "",
) -> tuple[ComplianceSource, ComplianceSourceEdition]:
    _require(actor, PERM_MANAGE_SOURCE, organization_id)
    if kind not in ComplianceSourceKind.values:
        raise ValidationError({"kind": "Unknown architectural source kind."})
    if applicability_status not in ApplicabilityStatus.values:
        raise ValidationError({"applicability_status": "Unknown applicability status."})
    code = (source_code or "").strip()
    if ComplianceSource.objects.filter(
        organization_id=organization_id, source_code__iexact=code
    ).exists():
        raise ValidationError({"source_code": "A source with this identifier already exists."})
    source = ComplianceSource(
        organization_id=organization_id,
        source_code=code,
        kind=kind,
        title=(title or "").strip(),
        business_owner_reference=(business_owner_reference or "").strip(),
        created_by=actor,
    )
    source.full_clean()
    source.save()
    edition = ComplianceSourceEdition(
        source=source,
        version_edition=(version_edition or "").strip(),
        official_source_citation=(official_source_citation or "").strip(),
        applicability_status=applicability_status,
        evidence_reference=(evidence_reference or "").strip(),
        last_reviewed_on=last_reviewed_on,
        register_status=SourceRegisterStatus.ACTIVE,
        created_by=actor,
    )
    edition.full_clean()
    edition.save()
    _append_event(
        organization_id=organization_id,
        source=source,
        edition=edition,
        event_type="COMPLIANCE_SOURCE_REGISTERED",
        actor=actor,
        summary="Compliance source registered. Applicability is not a certification claim.",
        payload={
            "source_code": source.source_code,
            "applicability_status": edition.applicability_status,
            "not_a_compliance_claim": True,
        },
    )
    record_event(
        event_type="COMPLIANCE_SOURCE_REGISTERED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "source_id": str(source.id),
            "module": "compliance_mapping",
            "not_a_compliance_claim": True,
        },
    )
    return source, edition


@atomic_fn
def add_source_edition(
    *,
    actor: User,
    source_id: uuid.UUID,
    version_edition: str,
    official_source_citation: str = "",
    applicability_status: str = ApplicabilityStatus.NOT_ASSESSED,
    evidence_reference: str = "",
    last_reviewed_on: date | None = None,
    supersede_edition_id: uuid.UUID | None = None,
) -> ComplianceSourceEdition:
    source = ComplianceSource.objects.select_related("organization").get(pk=source_id)
    _require(actor, PERM_MANAGE_SOURCE, source.organization_id)
    if applicability_status not in ApplicabilityStatus.values:
        raise ValidationError({"applicability_status": "Unknown applicability status."})
    edition = ComplianceSourceEdition(
        source=source,
        version_edition=(version_edition or "").strip(),
        official_source_citation=(official_source_citation or "").strip(),
        applicability_status=applicability_status,
        evidence_reference=(evidence_reference or "").strip(),
        last_reviewed_on=last_reviewed_on,
        register_status=SourceRegisterStatus.ACTIVE,
        created_by=actor,
    )
    edition.full_clean()
    edition.save()
    if supersede_edition_id is not None:
        previous = ComplianceSourceEdition.objects.get(pk=supersede_edition_id, source=source)
        _assert_edition_mutable(previous)
        previous.register_status = SourceRegisterStatus.SUPERSEDED
        previous.save(update_fields=["register_status", "updated_at"])
        _append_event(
            organization_id=source.organization_id,
            source=source,
            edition=previous,
            event_type="COMPLIANCE_EDITION_SUPERSEDED",
            actor=actor,
            summary="Source edition superseded by a newer owner-cited version.",
            payload={"replacement_edition_id": str(edition.id)},
        )
        record_event(
            event_type="COMPLIANCE_EDITION_SUPERSEDED",
            actor=actor,
            metadata={
                "organization_id": str(source.organization_id),
                "edition_id": str(previous.id),
            },
        )
    _append_event(
        organization_id=source.organization_id,
        source=source,
        edition=edition,
        event_type="COMPLIANCE_EDITION_RECORDED",
        actor=actor,
        summary="Source edition recorded. Citation only — no standard text stored.",
        payload={"version_edition": edition.version_edition},
    )
    record_event(
        event_type="COMPLIANCE_EDITION_RECORDED",
        actor=actor,
        metadata={
            "organization_id": str(source.organization_id),
            "edition_id": str(edition.id),
        },
    )
    return edition


@atomic_fn
def update_edition_applicability(
    *,
    actor: User,
    edition_id: uuid.UUID,
    applicability_status: str,
    evidence_reference: str | None = None,
    last_reviewed_on: date | None = None,
) -> ComplianceSourceEdition:
    edition = ComplianceSourceEdition.objects.select_related("source").get(pk=edition_id)
    _require(actor, PERM_MANAGE_SOURCE, edition.source.organization_id)
    _assert_edition_mutable(edition)
    if applicability_status not in ApplicabilityStatus.values:
        raise ValidationError({"applicability_status": "Unknown applicability status."})
    previous = edition.applicability_status
    edition.applicability_status = applicability_status
    if evidence_reference is not None:
        edition.evidence_reference = evidence_reference.strip()
    if last_reviewed_on is not None:
        edition.last_reviewed_on = last_reviewed_on
    edition.full_clean()
    edition.save()
    _append_event(
        organization_id=edition.source.organization_id,
        source=edition.source,
        edition=edition,
        event_type="COMPLIANCE_APPLICABILITY_UPDATED",
        actor=actor,
        summary="Applicability decision updated. Not a legal/certification conclusion.",
        payload={"from": previous, "to": applicability_status, "not_a_compliance_claim": True},
    )
    record_event(
        event_type="COMPLIANCE_APPLICABILITY_UPDATED",
        actor=actor,
        metadata={
            "organization_id": str(edition.source.organization_id),
            "edition_id": str(edition.id),
            "applicability_status": applicability_status,
        },
    )
    return edition


@atomic_fn
def withdraw_source_edition(*, actor: User, edition_id: uuid.UUID) -> ComplianceSourceEdition:
    edition = ComplianceSourceEdition.objects.select_related("source").get(pk=edition_id)
    _require(actor, PERM_MANAGE_SOURCE, edition.source.organization_id)
    _assert_edition_mutable(edition)
    edition.register_status = SourceRegisterStatus.WITHDRAWN
    edition.save(update_fields=["register_status", "updated_at"])
    _append_event(
        organization_id=edition.source.organization_id,
        source=edition.source,
        edition=edition,
        event_type="COMPLIANCE_EDITION_WITHDRAWN",
        actor=actor,
        summary="Source edition withdrawn.",
        payload={},
    )
    record_event(
        event_type="COMPLIANCE_EDITION_WITHDRAWN",
        actor=actor,
        metadata={
            "organization_id": str(edition.source.organization_id),
            "edition_id": str(edition.id),
        },
    )
    return edition


@atomic_fn
def create_control_mapping(
    *,
    actor: User,
    edition_id: uuid.UUID,
    clause_reference: str,
    system_control_kind: str,
    system_control_reference: str,
    requirement_summary: str = "",
    owner_reference: str = "",
    status: str = ControlMappingStatus.NOT_ASSESSED,
) -> ComplianceControlMapping:
    edition = ComplianceSourceEdition.objects.select_related("source").get(pk=edition_id)
    org_id = edition.source.organization_id
    _require(actor, PERM_MANAGE_CONTROL, org_id)
    _assert_edition_mutable(edition)
    if status == "COMPLIANT":
        raise ValidationError({"status": "IMPLEMENTED is not COMPLIANT."})
    if status not in ControlMappingStatus.values:
        raise ValidationError({"status": "Unknown mapping status."})
    if system_control_kind not in SystemControlKind.values:
        raise ValidationError({"system_control_kind": "Unknown system control kind."})
    mapping = ComplianceControlMapping(
        organization_id=org_id,
        edition=edition,
        clause_reference=(clause_reference or "").strip(),
        requirement_summary=requirement_summary or "",
        system_control_kind=system_control_kind,
        system_control_reference=(system_control_reference or "").strip(),
        owner_reference=(owner_reference or "").strip(),
        status=status,
        created_by=actor,
    )
    mapping.full_clean()
    mapping.save()
    _append_event(
        organization_id=org_id,
        source=edition.source,
        edition=edition,
        mapping=mapping,
        event_type="COMPLIANCE_MAPPING_CREATED",
        actor=actor,
        summary="Control mapping created. Implementation is not compliance.",
        payload={"clause_reference": mapping.clause_reference, "not_compliant": True},
    )
    record_event(
        event_type="COMPLIANCE_MAPPING_CREATED",
        actor=actor,
        metadata={
            "organization_id": str(org_id),
            "mapping_id": str(mapping.id),
            "not_a_compliance_claim": True,
        },
    )
    return mapping


@atomic_fn
def transition_mapping_status(
    *, actor: User, mapping_id: uuid.UUID, target_status: str
) -> ComplianceControlMapping:
    mapping = ComplianceControlMapping.objects.select_related("edition", "edition__source").get(
        pk=mapping_id
    )
    org_id = mapping.organization_id
    if target_status == ControlMappingStatus.VERIFIED:
        raise ValidationError({"status": "Verification requires separate authority."})
    _require(actor, PERM_MANAGE_CONTROL, org_id)
    _assert_edition_mutable(mapping.edition)
    _transition_mapping(mapping, target_status)
    previous = mapping.status
    mapping.status = target_status
    mapping.save(update_fields=["status", "updated_at"])
    _append_event(
        organization_id=org_id,
        source=mapping.edition.source,
        edition=mapping.edition,
        mapping=mapping,
        event_type="COMPLIANCE_MAPPING_STATUS_CHANGED",
        actor=actor,
        summary="Mapping status updated. IMPLEMENTED is not COMPLIANT.",
        payload={"from": previous, "to": target_status, "not_compliant": True},
    )
    record_event(
        event_type="COMPLIANCE_MAPPING_STATUS_CHANGED",
        actor=actor,
        metadata={
            "organization_id": str(org_id),
            "mapping_id": str(mapping.id),
            "status": target_status,
        },
    )
    return mapping


@atomic_fn
def verify_control_mapping(*, actor: User, mapping_id: uuid.UUID) -> ComplianceControlMapping:
    mapping = ComplianceControlMapping.objects.select_related("edition", "edition__source").get(
        pk=mapping_id
    )
    _require(actor, PERM_VERIFY, mapping.organization_id)
    _assert_edition_mutable(mapping.edition)
    _transition_mapping(mapping, ControlMappingStatus.VERIFIED)
    previous = mapping.status
    mapping.status = ControlMappingStatus.VERIFIED
    mapping.save(update_fields=["status", "updated_at"])
    _append_event(
        organization_id=mapping.organization_id,
        source=mapping.edition.source,
        edition=mapping.edition,
        mapping=mapping,
        event_type="COMPLIANCE_MAPPING_VERIFIED",
        actor=actor,
        summary="Mapping verification recorded. Not a certification or legal conclusion.",
        payload={"from": previous, "not_a_compliance_claim": True},
    )
    record_event(
        event_type="COMPLIANCE_MAPPING_VERIFIED",
        actor=actor,
        metadata={
            "organization_id": str(mapping.organization_id),
            "mapping_id": str(mapping.id),
            "not_a_compliance_claim": True,
        },
    )
    return mapping


@atomic_fn
def link_mapping_evidence(
    *,
    actor: User,
    mapping_id: uuid.UUID,
    evidence_kind: str,
    citation: str = "",
    linked_object_id: uuid.UUID | None = None,
) -> ComplianceEvidenceLink:
    mapping = ComplianceControlMapping.objects.select_related("edition", "edition__source").get(
        pk=mapping_id
    )
    _require(actor, PERM_MANAGE_CONTROL, mapping.organization_id)
    _assert_edition_mutable(mapping.edition)
    if evidence_kind not in SystemControlKind.values:
        raise ValidationError({"evidence_kind": "Unknown evidence kind."})
    if linked_object_id is not None:
        _resolve_evidence_object(
            organization_id=mapping.organization_id,
            evidence_kind=evidence_kind,
            linked_object_id=linked_object_id,
        )
    link = ComplianceEvidenceLink(
        mapping=mapping,
        evidence_kind=evidence_kind,
        linked_object_id=linked_object_id,
        citation=(citation or "").strip(),
        created_by=actor,
    )
    link.full_clean()
    link.save()
    _append_event(
        organization_id=mapping.organization_id,
        source=mapping.edition.source,
        edition=mapping.edition,
        mapping=mapping,
        event_type="COMPLIANCE_EVIDENCE_LINKED",
        actor=actor,
        summary="Evidence citation linked. Does not prove regulatory compliance.",
        payload={"evidence_kind": evidence_kind, "not_a_compliance_claim": True},
    )
    record_event(
        event_type="COMPLIANCE_EVIDENCE_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(mapping.organization_id),
            "mapping_id": str(mapping.id),
            "evidence_kind": evidence_kind,
        },
    )
    return link


@atomic_fn
def record_compliance_gap(*, actor: User, mapping_id: uuid.UUID, description: str) -> ComplianceGap:
    mapping = ComplianceControlMapping.objects.select_related("edition", "edition__source").get(
        pk=mapping_id
    )
    _require(actor, PERM_MANAGE_CONTROL, mapping.organization_id)
    _assert_edition_mutable(mapping.edition)
    gap = ComplianceGap(
        mapping=mapping,
        description=description,
        status=ComplianceGap.Status.OPEN,
        created_by=actor,
    )
    gap.full_clean()
    gap.save()
    if mapping.status != ControlMappingStatus.GAP_IDENTIFIED:
        _transition_mapping(mapping, ControlMappingStatus.GAP_IDENTIFIED)
        mapping.status = ControlMappingStatus.GAP_IDENTIFIED
        mapping.gap_summary = (description or "").strip()[:2000]
        mapping.save(update_fields=["status", "gap_summary", "updated_at"])
    _append_event(
        organization_id=mapping.organization_id,
        source=mapping.edition.source,
        edition=mapping.edition,
        mapping=mapping,
        gap=gap,
        event_type="COMPLIANCE_GAP_RECORDED",
        actor=actor,
        summary="Compliance gap recorded. Follow-up is not automatic.",
        payload={"auto_created_follow_up": False},
    )
    record_event(
        event_type="COMPLIANCE_GAP_RECORDED",
        actor=actor,
        metadata={
            "organization_id": str(mapping.organization_id),
            "gap_id": str(gap.id),
            "auto_created_follow_up": False,
        },
    )
    return gap


@atomic_fn
def link_gap_action(
    *,
    actor: User,
    gap_id: uuid.UUID,
    explicit_user_action: bool,
    action_kind: str,
    action_summary: str,
    create_follow_up: bool = False,
    create_linked_record: bool | None = None,
    risk_reference: str = "",
    due_date: date | None = None,
    owner: User | None = None,
    ncr_code: str = "",
    capa_code: str = "",
    change_code: str = "",
    existing_ncr_id: uuid.UUID | None = None,
    existing_capa_id: uuid.UUID | None = None,
    existing_change_id: uuid.UUID | None = None,
) -> ComplianceGapAction:
    gap = ComplianceGap.objects.select_related(
        "mapping", "mapping__edition", "mapping__edition__source", "mapping__organization"
    ).get(pk=gap_id)
    org = gap.mapping.organization
    _require(actor, PERM_LINK_GAP, org.id)
    _assert_edition_mutable(gap.mapping.edition)
    if gap.status == ComplianceGap.Status.CLOSED:
        raise ValidationError({"status": "Closed gaps cannot receive new actions."})
    if create_linked_record is not None:
        create_follow_up = create_linked_record
    if not explicit_user_action:
        raise ValidationError(
            {"explicit_user_action": "Gap follow-up requires explicit_user_action=True."}
        )
    kind = (action_kind or "").strip().upper()
    if kind not in GapActionKind.values:
        raise ValidationError({"action_kind": "Unknown gap action kind."})
    action = ComplianceGapAction(
        gap=gap,
        action_kind=kind,
        action_summary=(action_summary or "").strip(),
        due_date=due_date,
        owner=owner,
        created_by=actor,
    )
    if not action.action_summary:
        raise ValidationError({"action_summary": "Action summary is required."})
    if kind == GapActionKind.RISK:
        supplied = (risk_reference or "").strip()
        if not supplied:
            raise ValidationError({"risk_reference": "Owner-supplied risk identifier is required."})
        action.risk_reference = supplied
    elif kind == GapActionKind.NCR:
        if create_follow_up:
            supplied = (ncr_code or "").strip()
            if not supplied:
                raise ValidationError({"ncr_code": "Owner-supplied NCR code is required."})
            action.nonconformance = create_nonconformance(
                actor=actor,
                organization=org,
                code=supplied,
                title=f"Compliance gap {gap.mapping.clause_reference}",
                summary=gap.description[:500],
                source=NonConformanceSource.OTHER,
            )
        elif existing_ncr_id is not None:
            from apps.nonconformance.models import NonConformanceRecord

            found_ncr = NonConformanceRecord.objects.filter(
                pk=existing_ncr_id, organization_id=org.id
            ).first()
            if found_ncr is None:
                raise ValidationError({"existing_ncr_id": "NCR not found in organization."})
            action.nonconformance = found_ncr
        else:
            raise ValidationError(
                {"nonconformance": "Provide create_follow_up or existing_ncr_id."}
            )
    elif kind == GapActionKind.CAPA:
        if create_follow_up:
            supplied = (capa_code or "").strip()
            if not supplied:
                raise ValidationError({"capa_code": "Owner-supplied CAPA code is required."})
            action.corrective_action = create_corrective_action(
                actor=actor,
                organization=org,
                code=supplied,
                title=f"Compliance gap {gap.mapping.clause_reference}",
                summary=gap.description[:500],
            )
        elif existing_capa_id is not None:
            from apps.capa.models import CorrectiveAction

            found_capa = CorrectiveAction.objects.filter(
                pk=existing_capa_id, organization_id=org.id
            ).first()
            if found_capa is None:
                raise ValidationError({"existing_capa_id": "CAPA not found in organization."})
            action.corrective_action = found_capa
        else:
            raise ValidationError(
                {"corrective_action": "Provide create_follow_up or existing_capa_id."}
            )
    elif kind == GapActionKind.CHANGE_REQUEST:
        if create_follow_up:
            supplied = (change_code or "").strip()
            if not supplied:
                raise ValidationError(
                    {"change_code": "Owner-supplied change request code is required."}
                )
            action.change_request = create_quality_change(
                actor=actor,
                organization_id=org.id,
                change_code=supplied,
                title=f"Compliance gap {gap.mapping.clause_reference}",
                description=gap.description,
                reason="Explicit compliance-mapping gap follow-up (not auto-created).",
            )
        elif existing_change_id is not None:
            from apps.change_control.models import QualityChangeRequest

            found = QualityChangeRequest.objects.filter(
                pk=existing_change_id, organization_id=org.id
            ).first()
            if found is None:
                raise ValidationError(
                    {"existing_change_id": "Change request not found in organization."}
                )
            action.change_request = found
        else:
            raise ValidationError(
                {"change_request": "Provide create_follow_up or existing_change_id."}
            )
    action.full_clean()
    action.save()
    _append_event(
        organization_id=org.id,
        source=gap.mapping.edition.source,
        edition=gap.mapping.edition,
        mapping=gap.mapping,
        gap=gap,
        event_type="COMPLIANCE_GAP_ACTION_LINKED",
        actor=actor,
        summary=f"{kind} linked by explicit authorized action.",
        payload={"action_kind": kind, "create_follow_up": create_follow_up},
    )
    record_event(
        event_type="COMPLIANCE_GAP_ACTION_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(org.id),
            "gap_id": str(gap.id),
            "action_kind": kind,
        },
    )
    return action


def set_source_applicability(
    *,
    actor: User,
    edition_id: uuid.UUID,
    applicability_status: str,
    evidence_reference: str | None = None,
    last_reviewed_on: date | None = None,
) -> ComplianceSourceEdition:
    return update_edition_applicability(
        actor=actor,
        edition_id=edition_id,
        applicability_status=applicability_status,
        evidence_reference=evidence_reference,
        last_reviewed_on=last_reviewed_on,
    )


def set_mapping_status(
    *, actor: User, mapping_id: uuid.UUID, status: str
) -> ComplianceControlMapping:
    return transition_mapping_status(actor=actor, mapping_id=mapping_id, target_status=status)


@atomic_fn
def revise_compliance_source(
    *,
    actor: User,
    source_id: uuid.UUID,
    version_edition: str,
    official_source_citation: str = "",
    applicability_status: str = ApplicabilityStatus.NOT_ASSESSED,
    evidence_reference: str = "",
    last_reviewed_on: date | None = None,
) -> ComplianceSourceEdition:
    source = ComplianceSource.objects.get(pk=source_id)
    _require(actor, PERM_MANAGE_SOURCE, source.organization_id)
    previous = (
        ComplianceSourceEdition.objects.filter(
            source=source, register_status=SourceRegisterStatus.ACTIVE
        )
        .order_by("-created_at")
        .first()
    )
    return add_source_edition(
        actor=actor,
        source_id=source_id,
        version_edition=version_edition,
        official_source_citation=official_source_citation,
        applicability_status=applicability_status,
        evidence_reference=evidence_reference,
        last_reviewed_on=last_reviewed_on,
        supersede_edition_id=previous.id if previous is not None else None,
    )


def open_compliance_gap(*, actor: User, mapping_id: uuid.UUID, description: str) -> ComplianceGap:
    return record_compliance_gap(actor=actor, mapping_id=mapping_id, description=description)


@atomic_fn
def close_compliance_gap(*, actor: User, gap_id: uuid.UUID) -> ComplianceGap:
    gap = ComplianceGap.objects.select_related(
        "mapping", "mapping__edition", "mapping__edition__source"
    ).get(pk=gap_id)
    _require(actor, PERM_MANAGE_CONTROL, gap.mapping.organization_id)
    _assert_edition_mutable(gap.mapping.edition)
    if gap.status == ComplianceGap.Status.CLOSED:
        return gap
    gap.status = ComplianceGap.Status.CLOSED
    gap.closed_by = actor
    gap.closed_at = timezone.now()
    gap.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
    _append_event(
        organization_id=gap.mapping.organization_id,
        source=gap.mapping.edition.source,
        edition=gap.mapping.edition,
        mapping=gap.mapping,
        gap=gap,
        event_type="COMPLIANCE_GAP_CLOSED",
        actor=actor,
        summary="Compliance gap closed. Not a certification conclusion.",
        payload={},
    )
    record_event(
        event_type="COMPLIANCE_GAP_CLOSED",
        actor=actor,
        metadata={
            "organization_id": str(gap.mapping.organization_id),
            "gap_id": str(gap.id),
        },
    )
    return gap
