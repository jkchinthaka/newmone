"""Process FMEA services — Phase 48 (ADR-059).

No invented RPN thresholds or Action Priority tables.
S×O×D is calculated only after an owner-cited scoring model is enabled.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.capa.services import create_corrective_action
from apps.change_control.services import create_quality_change
from apps.process_fmea.models import (
    CurrentControl,
    FailureEffect,
    FailureMode,
    FailureModeAssessment,
    FmeaScoringFormulaKind,
    PotentialCause,
    ProcessFmea,
    ProcessFmeaActionKind,
    ProcessFmeaEvent,
    ProcessFmeaLink,
    ProcessFmeaLinkKind,
    ProcessFmeaScoringPolicy,
    ProcessFmeaVersion,
    ProcessFmeaVersionStatus,
    ProcessStep,
    RecommendedAction,
)
from apps.security_audit.services import record_event

PERM_VIEW = "process_fmea.view_processfmea"
PERM_MANAGE = "process_fmea.manage_processfmea"
PERM_APPROVE = "process_fmea.approve_processfmea"
PERM_POLICY = "process_fmea.configure_processfmeascoring"
PERM_ACTION = "process_fmea.link_processfmea_action"


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User, permission: str, organization_id: uuid.UUID) -> None:
    if not user_has_permission(actor, permission, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")


def _append_event(
    *,
    fmea: ProcessFmea,
    event_type: str,
    actor: User,
    summary: str,
    version: ProcessFmeaVersion | None = None,
    payload: dict[str, Any] | None = None,
) -> ProcessFmeaEvent:
    return ProcessFmeaEvent.objects.create(
        fmea=fmea,
        version=version,
        event_type=event_type,
        summary=summary,
        payload=payload or {},
        actor=actor,
    )


def _assert_draft(version: ProcessFmeaVersion) -> None:
    if version.is_historically_locked:
        raise ValidationError(
            {
                "status": (
                    "Approved, superseded, or withdrawn FMEA versions are historically immutable."
                )
            }
        )
    if version.status != ProcessFmeaVersionStatus.DRAFT:
        raise ValidationError({"status": "Only draft FMEA versions may be edited."})


def _parse_positive_int(value: str, field: str) -> int:
    raw = (value or "").strip()
    if not raw.isdigit():
        raise ValidationError({field: "Configured S×O×D calculation requires a positive integer."})
    number = int(raw)
    if number < 1:
        raise ValidationError({field: "Configured S×O×D calculation requires a positive integer."})
    return number


def calculate_configured_sod_product(
    *, severity_input: str, occurrence_input: str, detection_input: str
) -> str:
    """Mathematical S×O×D only. No scale, threshold, or Action Priority is applied."""
    severity = _parse_positive_int(severity_input, "severity_input")
    occurrence = _parse_positive_int(occurrence_input, "occurrence_input")
    detection = _parse_positive_int(detection_input, "detection_input")
    return str(severity * occurrence * detection)


def get_or_create_scoring_policy(
    *, organization_id: uuid.UUID, actor: User
) -> ProcessFmeaScoringPolicy:
    policy = ProcessFmeaScoringPolicy.objects.filter(organization_id=organization_id).first()
    if policy is not None:
        return policy
    return ProcessFmeaScoringPolicy.objects.create(
        organization_id=organization_id,
        scoring_enabled=False,
        formula_kind=FmeaScoringFormulaKind.NONE,
        formula_citation="",
        updated_by=actor,
    )


def _resolve_link_object(
    *, organization_id: uuid.UUID, link_kind: str, linked_object_id: uuid.UUID
) -> None:
    if link_kind == ProcessFmeaLinkKind.PROCESS:
        return
    found = False
    if link_kind == ProcessFmeaLinkKind.HACCP:
        from apps.haccp.models import ControlPoint, HaccpPlan

        found = (
            HaccpPlan.objects.filter(pk=linked_object_id, organization_id=organization_id).exists()
            or ControlPoint.objects.filter(
                pk=linked_object_id, plan_version__plan__organization_id=organization_id
            ).exists()
        )
    elif link_kind == ProcessFmeaLinkKind.CHECKLIST:
        from apps.checklists.models import ChecklistTemplate, ChecklistVersion

        found = (
            ChecklistTemplate.objects.filter(
                pk=linked_object_id, organization_id=organization_id
            ).exists()
            or ChecklistVersion.objects.filter(
                pk=linked_object_id, template__organization_id=organization_id
            ).exists()
        )
    elif link_kind == ProcessFmeaLinkKind.RISK:
        from apps.quality_risks.models import QualityRisk

        found = QualityRisk.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == ProcessFmeaLinkKind.NCR:
        from apps.nonconformance.models import NonConformanceRecord

        found = NonConformanceRecord.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == ProcessFmeaLinkKind.CAPA:
        from apps.capa.models import CorrectiveAction

        found = CorrectiveAction.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif link_kind == ProcessFmeaLinkKind.CHANGE_CONTROL:
        from apps.change_control.models import QualityChangeRequest

        found = QualityChangeRequest.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    if not found:
        raise ValidationError(
            {"linked_object_id": "Linked object was not found in this organization."}
        )


@transaction.atomic
def create_process_fmea(
    *,
    actor: User,
    organization_id: uuid.UUID,
    fmea_code: str,
    title: str,
    process_reference: str = "",
    description: str = "",
) -> ProcessFmea:
    _require(actor, PERM_MANAGE, organization_id)
    code = (fmea_code or "").strip()
    if ProcessFmea.objects.filter(organization_id=organization_id, fmea_code__iexact=code).exists():
        raise ValidationError({"fmea_code": "An FMEA with this identifier already exists."})
    fmea = ProcessFmea(
        organization_id=organization_id,
        fmea_code=code,
        title=(title or "").strip(),
        process_reference=(process_reference or "").strip(),
        description=description or "",
        created_by=actor,
    )
    fmea.full_clean()
    fmea.save()
    policy = get_or_create_scoring_policy(organization_id=organization_id, actor=actor)
    version = ProcessFmeaVersion.objects.create(
        fmea=fmea,
        version_number=1,
        status=ProcessFmeaVersionStatus.DRAFT,
        scoring_enabled=policy.scoring_enabled,
        formula_kind=policy.formula_kind,
        formula_citation=policy.formula_citation,
        created_by=actor,
    )
    _append_event(
        fmea=fmea,
        version=version,
        event_type="PROCESS_FMEA_CREATED",
        actor=actor,
        summary="Process FMEA created. No RPN or Action Priority policy applied.",
        payload={"fmea_code": fmea.fmea_code, "scoring_enabled": version.scoring_enabled},
    )
    record_event(
        event_type="PROCESS_FMEA_CREATED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "fmea_id": str(fmea.id),
            "module": "process_fmea",
            "no_invented_rpn_policy": True,
        },
    )
    return fmea


@transaction.atomic
def add_process_step(
    *,
    actor: User,
    version_id: uuid.UUID,
    step_code: str,
    description: str,
    sequence: int = 1,
) -> ProcessStep:
    version = ProcessFmeaVersion.objects.select_related("fmea").get(pk=version_id)
    _require(actor, PERM_MANAGE, version.fmea.organization_id)
    _assert_draft(version)
    step = ProcessStep(
        version=version,
        step_code=(step_code or "").strip(),
        sequence=sequence,
        description=description or "",
        created_by=actor,
    )
    step.full_clean()
    step.save()
    _append_event(
        fmea=version.fmea,
        version=version,
        event_type="PROCESS_FMEA_STEP_ADDED",
        actor=actor,
        summary="Process step recorded.",
        payload={"step_code": step.step_code},
    )
    record_event(
        event_type="PROCESS_FMEA_STEP_ADDED",
        actor=actor,
        metadata={
            "organization_id": str(version.fmea.organization_id),
            "version_id": str(version.id),
        },
    )
    return step


@transaction.atomic
def add_failure_mode(
    *, actor: User, step_id: uuid.UUID, mode_code: str, description: str
) -> FailureMode:
    step = ProcessStep.objects.select_related("version", "version__fmea").get(pk=step_id)
    _require(actor, PERM_MANAGE, step.version.fmea.organization_id)
    _assert_draft(step.version)
    mode = FailureMode(
        process_step=step,
        mode_code=(mode_code or "").strip(),
        description=description or "",
        created_by=actor,
    )
    mode.full_clean()
    mode.save()
    _append_event(
        fmea=step.version.fmea,
        version=step.version,
        event_type="PROCESS_FMEA_FAILURE_MODE_ADDED",
        actor=actor,
        summary="Failure mode recorded.",
        payload={"mode_code": mode.mode_code},
    )
    record_event(
        event_type="PROCESS_FMEA_FAILURE_MODE_ADDED",
        actor=actor,
        metadata={
            "organization_id": str(step.version.fmea.organization_id),
            "failure_mode_id": str(mode.id),
        },
    )
    return mode


@transaction.atomic
def add_failure_effect(
    *, actor: User, failure_mode_id: uuid.UUID, description: str
) -> FailureEffect:
    mode = FailureMode.objects.select_related("process_step__version__fmea").get(pk=failure_mode_id)
    _require(actor, PERM_MANAGE, mode.process_step.version.fmea.organization_id)
    _assert_draft(mode.process_step.version)
    effect = FailureEffect(failure_mode=mode, description=description or "", created_by=actor)
    effect.full_clean()
    effect.save()
    return effect


@transaction.atomic
def add_potential_cause(
    *, actor: User, failure_mode_id: uuid.UUID, description: str
) -> PotentialCause:
    mode = FailureMode.objects.select_related("process_step__version__fmea").get(pk=failure_mode_id)
    _require(actor, PERM_MANAGE, mode.process_step.version.fmea.organization_id)
    _assert_draft(mode.process_step.version)
    cause = PotentialCause(failure_mode=mode, description=description or "", created_by=actor)
    cause.full_clean()
    cause.save()
    return cause


@transaction.atomic
def add_current_control(
    *,
    actor: User,
    failure_mode_id: uuid.UUID,
    description: str,
    control_reference: str = "",
) -> CurrentControl:
    mode = FailureMode.objects.select_related("process_step__version__fmea").get(pk=failure_mode_id)
    _require(actor, PERM_MANAGE, mode.process_step.version.fmea.organization_id)
    _assert_draft(mode.process_step.version)
    control = CurrentControl(
        failure_mode=mode,
        description=description or "",
        control_reference=(control_reference or "").strip(),
        created_by=actor,
    )
    control.full_clean()
    control.save()
    return control


@transaction.atomic
def record_failure_mode_assessment(
    *,
    actor: User,
    failure_mode_id: uuid.UUID,
    severity_input: str = "",
    occurrence_input: str = "",
    detection_input: str = "",
    computed_score_text: str = "",
    notes: str = "",
) -> FailureModeAssessment:
    mode = FailureMode.objects.select_related("process_step__version__fmea").get(pk=failure_mode_id)
    version = mode.process_step.version
    _require(actor, PERM_MANAGE, version.fmea.organization_id)
    _assert_draft(version)
    score_text = (computed_score_text or "").strip()
    if version.scoring_enabled and version.formula_kind == FmeaScoringFormulaKind.SOD_PRODUCT:
        if not (version.formula_citation or "").strip():
            raise ValidationError(
                {
                    "formula_citation": (
                        "Scoring is enabled but no owner-cited formula reference is configured."
                    )
                }
            )
        if score_text:
            raise ValidationError(
                {
                    "computed_score_text": (
                        "S×O×D product is calculated after configuration. "
                        "Do not supply a score while SOD_PRODUCT is enabled."
                    )
                }
            )
        score_text = calculate_configured_sod_product(
            severity_input=severity_input,
            occurrence_input=occurrence_input,
            detection_input=detection_input,
        )
    elif version.scoring_enabled and version.formula_kind == FmeaScoringFormulaKind.OWNER_SUPPLIED:
        if not (version.formula_citation or "").strip():
            raise ValidationError(
                {"formula_citation": "Owner-supplied scoring requires an owner-cited method."}
            )
        if not score_text:
            raise ValidationError(
                {"computed_score_text": "Owner-supplied score text is required for this model."}
            )
    elif score_text:
        raise ValidationError(
            {
                "computed_score_text": (
                    "Computed score text is refused while scoring is disabled. "
                    "No invented RPN or Action Priority policy is applied."
                )
            }
        )
    next_number = (
        FailureModeAssessment.objects.filter(failure_mode=mode).aggregate(m=Max("snapshot_number"))[
            "m"
        ]
        or 0
    ) + 1
    assessment = FailureModeAssessment(
        failure_mode=mode,
        snapshot_number=next_number,
        severity_input=(severity_input or "").strip(),
        occurrence_input=(occurrence_input or "").strip(),
        detection_input=(detection_input or "").strip(),
        computed_score_text=score_text,
        method_citation=(version.formula_citation or "").strip(),
        notes=notes or "",
        assessed_by=actor,
    )
    assessment.full_clean()
    assessment.save()
    _append_event(
        fmea=version.fmea,
        version=version,
        event_type="PROCESS_FMEA_ASSESSED",
        actor=actor,
        summary="Failure-mode assessment recorded. No risk threshold applied.",
        payload={
            "scoring_enabled": version.scoring_enabled,
            "formula_kind": version.formula_kind,
            "computed": bool(score_text),
        },
    )
    record_event(
        event_type="PROCESS_FMEA_ASSESSED",
        actor=actor,
        metadata={
            "organization_id": str(version.fmea.organization_id),
            "failure_mode_id": str(mode.id),
        },
    )
    return assessment


@transaction.atomic
def add_recommended_action(
    *,
    actor: User,
    failure_mode_id: uuid.UUID,
    summary: str,
    action_kind: str = ProcessFmeaActionKind.ACTION,
    citation: str = "",
    explicit_user_action: bool = False,
    create_follow_up: bool = False,
    capa_code: str = "",
    change_code: str = "",
    existing_capa_id: uuid.UUID | None = None,
    existing_change_id: uuid.UUID | None = None,
) -> RecommendedAction:
    mode = FailureMode.objects.select_related("process_step__version__fmea").get(pk=failure_mode_id)
    version = mode.process_step.version
    org = version.fmea.organization
    kind = (action_kind or "").strip().upper()
    if kind not in ProcessFmeaActionKind.values:
        raise ValidationError({"action_kind": "Unknown recommended-action kind."})
    if kind in {ProcessFmeaActionKind.CAPA, ProcessFmeaActionKind.CHANGE_REQUEST}:
        _require(actor, PERM_ACTION, org.id)
        if not explicit_user_action:
            raise ValidationError(
                {
                    "explicit_user_action": (
                        "CAPA or change request requires "
                        "explicit_user_action=True. Never automatic."
                    )
                }
            )
    else:
        _require(actor, PERM_MANAGE, org.id)
    _assert_draft(version)
    action = RecommendedAction(
        failure_mode=mode,
        summary=(summary or "").strip(),
        action_kind=kind,
        citation=(citation or "").strip(),
        created_by=actor,
    )
    if kind == ProcessFmeaActionKind.CAPA:
        if create_follow_up:
            supplied = (capa_code or "").strip()
            if not supplied:
                raise ValidationError({"capa_code": "Owner-supplied CAPA code is required."})
            action.corrective_action = create_corrective_action(
                actor=actor,
                organization=org,
                code=supplied,
                title=f"FMEA {version.fmea.fmea_code}",
                summary=action.summary[:500],
            )
        elif existing_capa_id is not None:
            from apps.capa.models import CorrectiveAction

            found_capa = CorrectiveAction.objects.filter(
                pk=existing_capa_id, organization_id=org.id
            ).first()
            if found_capa is None:
                raise ValidationError({"existing_capa_id": "CAPA not found in organization."})
            action.corrective_action = found_capa
        elif not action.citation:
            raise ValidationError(
                {"citation": "Provide create_follow_up, existing_capa_id, or citation."}
            )
    elif kind == ProcessFmeaActionKind.CHANGE_REQUEST:
        if create_follow_up:
            supplied = (change_code or "").strip()
            if not supplied:
                raise ValidationError({"change_code": "Owner-supplied change code is required."})
            action.change_request = create_quality_change(
                actor=actor,
                organization_id=org.id,
                change_code=supplied,
                title=f"FMEA {version.fmea.fmea_code}",
                description=action.summary,
                reason="Explicit process-FMEA recommended action (not auto-created).",
            )
        elif existing_change_id is not None:
            from apps.change_control.models import QualityChangeRequest

            found_change = QualityChangeRequest.objects.filter(
                pk=existing_change_id, organization_id=org.id
            ).first()
            if found_change is None:
                raise ValidationError({"existing_change_id": "Change request not found."})
            action.change_request = found_change
        elif not action.citation:
            raise ValidationError(
                {"citation": "Provide create_follow_up, existing_change_id, or citation."}
            )
    action.full_clean()
    action.save()
    _append_event(
        fmea=version.fmea,
        version=version,
        event_type="PROCESS_FMEA_ACTION_RECORDED",
        actor=actor,
        summary=f"{kind} recommended action recorded.",
        payload={"action_kind": kind, "create_follow_up": create_follow_up},
    )
    record_event(
        event_type="PROCESS_FMEA_ACTION_RECORDED",
        actor=actor,
        metadata={
            "organization_id": str(org.id),
            "failure_mode_id": str(mode.id),
            "action_kind": kind,
        },
    )
    return action


@transaction.atomic
def link_process_fmea(
    *,
    actor: User,
    version_id: uuid.UUID,
    link_kind: str,
    citation: str = "",
    linked_object_id: uuid.UUID | None = None,
) -> ProcessFmeaLink:
    version = ProcessFmeaVersion.objects.select_related("fmea").get(pk=version_id)
    _require(actor, PERM_MANAGE, version.fmea.organization_id)
    _assert_draft(version)
    if link_kind not in ProcessFmeaLinkKind.values:
        raise ValidationError({"link_kind": "Unknown FMEA link kind."})
    if linked_object_id is not None:
        _resolve_link_object(
            organization_id=version.fmea.organization_id,
            link_kind=link_kind,
            linked_object_id=linked_object_id,
        )
    link = ProcessFmeaLink(
        version=version,
        link_kind=link_kind,
        linked_object_id=linked_object_id,
        citation=(citation or "").strip(),
        created_by=actor,
    )
    link.full_clean()
    link.save()
    _append_event(
        fmea=version.fmea,
        version=version,
        event_type="PROCESS_FMEA_LINKED",
        actor=actor,
        summary="FMEA context link recorded.",
        payload={"link_kind": link_kind},
    )
    record_event(
        event_type="PROCESS_FMEA_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(version.fmea.organization_id),
            "version_id": str(version.id),
            "link_kind": link_kind,
        },
    )
    return link


@transaction.atomic
def configure_fmea_scoring_policy(
    *,
    actor: User,
    organization_id: uuid.UUID,
    scoring_enabled: bool,
    formula_kind: str = FmeaScoringFormulaKind.NONE,
    formula_citation: str = "",
) -> ProcessFmeaScoringPolicy:
    _require(actor, PERM_POLICY, organization_id)
    kind = (formula_kind or FmeaScoringFormulaKind.NONE).strip().upper()
    if kind not in FmeaScoringFormulaKind.values:
        raise ValidationError({"formula_kind": "Unknown FMEA scoring formula kind."})
    citation = (formula_citation or "").strip()
    if scoring_enabled:
        if kind == FmeaScoringFormulaKind.NONE:
            raise ValidationError(
                {
                    "formula_kind": (
                        "Enabling scoring requires an explicit formula kind. "
                        "No RPN or Action Priority policy is invented."
                    )
                }
            )
        if not citation:
            raise ValidationError(
                {
                    "formula_citation": (
                        "Enabling scoring requires an owner-cited company method. "
                        "No RPN thresholds or Action Priority table are invented."
                    )
                }
            )
    else:
        kind = FmeaScoringFormulaKind.NONE
    policy = get_or_create_scoring_policy(organization_id=organization_id, actor=actor)
    policy.scoring_enabled = scoring_enabled
    policy.formula_kind = kind
    policy.formula_citation = citation if scoring_enabled else ""
    policy.updated_by = actor
    policy.save()
    record_event(
        event_type="PROCESS_FMEA_SCORING_POLICY_UPDATED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "scoring_enabled": scoring_enabled,
            "formula_kind": kind,
            "no_invented_rpn_policy": True,
        },
    )
    return policy


@transaction.atomic
def apply_scoring_policy_to_version(*, actor: User, version_id: uuid.UUID) -> ProcessFmeaVersion:
    version = ProcessFmeaVersion.objects.select_related("fmea").get(pk=version_id)
    _require(actor, PERM_MANAGE, version.fmea.organization_id)
    _assert_draft(version)
    policy = get_or_create_scoring_policy(organization_id=version.fmea.organization_id, actor=actor)
    version.scoring_enabled = policy.scoring_enabled
    version.formula_kind = policy.formula_kind
    version.formula_citation = policy.formula_citation
    version.save(update_fields=["scoring_enabled", "formula_kind", "formula_citation"])
    return version


@transaction.atomic
def approve_process_fmea_version(*, actor: User, version_id: uuid.UUID) -> ProcessFmeaVersion:
    version = ProcessFmeaVersion.objects.select_related("fmea").get(pk=version_id)
    _require(actor, PERM_APPROVE, version.fmea.organization_id)
    _assert_draft(version)
    if not version.process_steps.exists():
        raise ValidationError({"process_steps": "Approve requires at least one process step."})
    if not FailureMode.objects.filter(process_step__version=version).exists():
        raise ValidationError({"failure_modes": "Approve requires at least one failure mode."})
    version.status = ProcessFmeaVersionStatus.APPROVED
    version.approved_by = actor
    version.approved_at = timezone.now()
    version.save(update_fields=["status", "approved_by", "approved_at"])
    _append_event(
        fmea=version.fmea,
        version=version,
        event_type="PROCESS_FMEA_APPROVED",
        actor=actor,
        summary="FMEA version approved and historically locked.",
        payload={"version_number": version.version_number},
    )
    record_event(
        event_type="PROCESS_FMEA_APPROVED",
        actor=actor,
        metadata={
            "organization_id": str(version.fmea.organization_id),
            "version_id": str(version.id),
        },
    )
    return version


@transaction.atomic
def withdraw_process_fmea_version(*, actor: User, version_id: uuid.UUID) -> ProcessFmeaVersion:
    version = ProcessFmeaVersion.objects.select_related("fmea").get(pk=version_id)
    _require(actor, PERM_MANAGE, version.fmea.organization_id)
    _assert_draft(version)
    version.status = ProcessFmeaVersionStatus.WITHDRAWN
    version.save(update_fields=["status"])
    _append_event(
        fmea=version.fmea,
        version=version,
        event_type="PROCESS_FMEA_WITHDRAWN",
        actor=actor,
        summary="Draft FMEA version withdrawn.",
        payload={"version_number": version.version_number},
    )
    record_event(
        event_type="PROCESS_FMEA_WITHDRAWN",
        actor=actor,
        metadata={
            "organization_id": str(version.fmea.organization_id),
            "version_id": str(version.id),
        },
    )
    return version


def _clone_failure_mode(*, source: FailureMode, step: ProcessStep, actor: User) -> FailureMode:
    mode = FailureMode.objects.create(
        process_step=step,
        mode_code=source.mode_code,
        description=source.description,
        created_by=actor,
    )
    for effect in source.effects.all():
        FailureEffect.objects.create(
            failure_mode=mode, description=effect.description, created_by=actor
        )
    for cause in source.causes.all():
        PotentialCause.objects.create(
            failure_mode=mode, description=cause.description, created_by=actor
        )
    for control in source.current_controls.all():
        CurrentControl.objects.create(
            failure_mode=mode,
            description=control.description,
            control_reference=control.control_reference,
            created_by=actor,
        )
    latest = source.assessments.order_by("-snapshot_number").first()
    if latest is not None:
        FailureModeAssessment.objects.create(
            failure_mode=mode,
            snapshot_number=1,
            severity_input=latest.severity_input,
            occurrence_input=latest.occurrence_input,
            detection_input=latest.detection_input,
            computed_score_text="",
            method_citation="",
            notes="Copied inputs from prior version. Recalculation requires configured policy.",
            assessed_by=actor,
        )
    for action in source.recommended_actions.all():
        RecommendedAction.objects.create(
            failure_mode=mode,
            summary=action.summary,
            action_kind=action.action_kind,
            citation=action.citation,
            created_by=actor,
        )
    return mode


@transaction.atomic
def revise_process_fmea(
    *, actor: User, fmea_id: uuid.UUID, revision_note: str = ""
) -> ProcessFmeaVersion:
    fmea = ProcessFmea.objects.get(pk=fmea_id)
    _require(actor, PERM_MANAGE, fmea.organization_id)
    source = (
        ProcessFmeaVersion.objects.filter(fmea=fmea, status=ProcessFmeaVersionStatus.APPROVED)
        .order_by("-version_number")
        .first()
    )
    if source is None:
        raise ValidationError({"fmea": "A new revision requires an approved FMEA version."})
    next_number = (
        ProcessFmeaVersion.objects.filter(fmea=fmea).aggregate(m=Max("version_number"))["m"] or 0
    ) + 1
    policy = get_or_create_scoring_policy(organization_id=fmea.organization_id, actor=actor)
    new_version = ProcessFmeaVersion.objects.create(
        fmea=fmea,
        version_number=next_number,
        status=ProcessFmeaVersionStatus.DRAFT,
        scoring_enabled=policy.scoring_enabled,
        formula_kind=policy.formula_kind,
        formula_citation=policy.formula_citation,
        revision_note=revision_note or "",
        created_by=actor,
    )
    for step in source.process_steps.all():
        cloned_step = ProcessStep.objects.create(
            version=new_version,
            step_code=step.step_code,
            sequence=step.sequence,
            description=step.description,
            created_by=actor,
        )
        for mode in step.failure_modes.all():
            _clone_failure_mode(source=mode, step=cloned_step, actor=actor)
    for link in source.links.all():
        ProcessFmeaLink.objects.create(
            version=new_version,
            link_kind=link.link_kind,
            linked_object_id=link.linked_object_id,
            citation=link.citation,
            created_by=actor,
        )
    source.status = ProcessFmeaVersionStatus.SUPERSEDED
    source.save(update_fields=["status"])
    _append_event(
        fmea=fmea,
        version=new_version,
        event_type="PROCESS_FMEA_VERSION_CREATED",
        actor=actor,
        summary="New FMEA revision created. Prior approved version remains historically locked.",
        payload={"from_version": source.version_number, "to_version": new_version.version_number},
    )
    record_event(
        event_type="PROCESS_FMEA_VERSION_CREATED",
        actor=actor,
        metadata={
            "organization_id": str(fmea.organization_id),
            "fmea_id": str(fmea.id),
            "version_id": str(new_version.id),
        },
    )
    record_event(
        event_type="PROCESS_FMEA_SUPERSEDED",
        actor=actor,
        metadata={
            "organization_id": str(fmea.organization_id),
            "version_id": str(source.id),
        },
    )
    return new_version
