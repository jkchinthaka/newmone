"""Phase 48 — process FMEA management tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import RequestFactory
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.change_control.models import QualityChangeRequest
from apps.organizations.models import Organization
from apps.process_fmea.admin import ProcessFmeaEventAdmin, SoftRetentionAdmin
from apps.process_fmea.historical_safety import version_is_historically_locked
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
from apps.process_fmea.selectors import (
    get_process_fmea_for_org,
    list_failure_modes,
    list_fmea_events,
    list_fmea_versions,
    list_process_fmeas,
    list_process_steps,
)
from apps.process_fmea.services import (
    add_current_control,
    add_failure_effect,
    add_failure_mode,
    add_potential_cause,
    add_process_step,
    add_recommended_action,
    apply_scoring_policy_to_version,
    approve_process_fmea_version,
    calculate_configured_sod_product,
    configure_fmea_scoring_policy,
    create_process_fmea,
    link_process_fmea,
    record_failure_mode_assessment,
    revise_process_fmea,
    withdraw_process_fmea_version,
)
from apps.quality_risks.models import QualityRisk
from apps.quality_risks.services import create_quality_risk
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    content_type = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _fmea_user(
    *,
    org: Organization,
    view: bool = True,
    manage: bool = False,
    approve: bool = False,
    policy: bool = False,
    action: bool = False,
    capa: bool = False,
    change: bool = False,
    risk: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"PF{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"PF{suffix}",
        name=f"Process FMEA {suffix}",
        permission=_perm(ProcessFmea, "view_processfmea"),
    )
    if not view:
        role.permissions.remove(_perm(ProcessFmea, "view_processfmea"))
    if manage:
        role.permissions.add(_perm(ProcessFmea, "manage_processfmea"))
    if approve:
        role.permissions.add(_perm(ProcessFmea, "approve_processfmea"))
    if policy:
        role.permissions.add(_perm(ProcessFmea, "configure_processfmeascoring"))
    if action:
        role.permissions.add(_perm(ProcessFmea, "link_processfmea_action"))
    if capa:
        role.permissions.add(_perm(CorrectiveAction, "create_capa"))
    if change:
        role.permissions.add(_perm(QualityChangeRequest, "create_qualitychange"))
    if risk:
        role.permissions.add(_perm(QualityRisk, "manage_qualityrisk"))
        role.permissions.add(_perm(QualityRisk, "view_qualityrisk"))
    grant_role(user, role, organization=org)
    return user


def _seed_mode(
    actor: User, org: Organization, code: str = "SYN-PFMEA-001"
) -> tuple[ProcessFmea, ProcessFmeaVersion, FailureMode]:
    fmea = create_process_fmea(
        actor=actor,
        organization_id=org.id,
        fmea_code=code,
        title="Synthetic filling PFMEA",
        process_reference="FILL-LINE-SYN",
    )
    version = fmea.versions.get(version_number=1)
    step = add_process_step(
        actor=actor,
        version_id=version.id,
        step_code="PS-01",
        description="Fill and seal",
        sequence=1,
    )
    mode = add_failure_mode(
        actor=actor,
        step_id=step.id,
        mode_code="FM-01",
        description="Underfill",
    )
    return fmea, version, mode


@pytest.mark.django_db
def test_versioning_failure_modes_and_historical_integrity() -> None:
    org = make_org(code="PF-A")
    manager = _fmea_user(org=org, manage=True, approve=True)
    fmea, version, mode = _seed_mode(manager, org)
    add_failure_effect(actor=manager, failure_mode_id=mode.id, description="Short weight")
    add_potential_cause(actor=manager, failure_mode_id=mode.id, description="Nozzle blockage")
    add_current_control(actor=manager, failure_mode_id=mode.id, description="Weight check")
    add_recommended_action(
        actor=manager,
        failure_mode_id=mode.id,
        summary="Review nozzle PM.",
        action_kind=ProcessFmeaActionKind.ACTION,
    )
    record_failure_mode_assessment(
        actor=manager,
        failure_mode_id=mode.id,
        severity_input="OWNER-S",
        occurrence_input="OWNER-O",
        detection_input="OWNER-D",
        notes="Inputs only; scoring disabled.",
    )
    with pytest.raises(ValidationError, match="scoring is disabled"):
        record_failure_mode_assessment(
            actor=manager,
            failure_mode_id=mode.id,
            severity_input="3",
            occurrence_input="3",
            detection_input="3",
            computed_score_text="27",
        )
    approved = approve_process_fmea_version(actor=manager, version_id=version.id)
    assert approved.status == ProcessFmeaVersionStatus.APPROVED
    assert version_is_historically_locked(approved.status)
    with pytest.raises(ValidationError, match="historically immutable"):
        add_process_step(
            actor=manager,
            version_id=version.id,
            step_code="PS-02",
            description="Should fail",
        )
    revision = revise_process_fmea(
        actor=manager, fmea_id=fmea.id, revision_note="Owner-requested update."
    )
    version.refresh_from_db()
    assert version.status == ProcessFmeaVersionStatus.SUPERSEDED
    assert revision.version_number == 2
    assert revision.status == ProcessFmeaVersionStatus.DRAFT
    assert list_process_steps(version=revision).count() == 1
    assert list_failure_modes(version=revision).count() == 1
    cloned = list_failure_modes(version=revision).get()
    assert cloned.effects.count() == 1
    assert cloned.causes.count() == 1
    assert cloned.current_controls.count() == 1
    assert cloned.recommended_actions.count() == 1
    add_process_step(
        actor=manager,
        version_id=revision.id,
        step_code="PS-02",
        description="New step on revision",
        sequence=2,
    )
    assert list_fmea_versions(fmea=fmea).count() == 2
    assert str(fmea)
    assert str(version)
    assert str(mode)
    assert str(ProcessStep(step_code="X"))
    assert str(FailureEffect(failure_mode=mode))
    assert str(PotentialCause(failure_mode=mode))
    assert str(CurrentControl(failure_mode=mode))
    assert str(RecommendedAction(action_kind="ACTION", failure_mode=mode))
    event = list_fmea_events(fmea=fmea).first()
    assert event is not None
    assert str(event)


@pytest.mark.django_db
def test_scoring_configuration_and_calculation() -> None:
    org = make_org(code="PF-B")
    manager = _fmea_user(org=org, manage=True, policy=True)
    _fmea, version, mode = _seed_mode(manager, org, code="SYN-PFMEA-010")
    with pytest.raises(ValidationError, match="owner-cited company method"):
        configure_fmea_scoring_policy(
            actor=manager,
            organization_id=org.id,
            scoring_enabled=True,
            formula_kind=FmeaScoringFormulaKind.SOD_PRODUCT,
        )
    with pytest.raises(ValidationError, match="explicit formula kind"):
        configure_fmea_scoring_policy(
            actor=manager,
            organization_id=org.id,
            scoring_enabled=True,
            formula_kind=FmeaScoringFormulaKind.NONE,
            formula_citation="Owner method",
        )
    with pytest.raises(ValidationError, match="Unknown FMEA scoring"):
        configure_fmea_scoring_policy(
            actor=manager,
            organization_id=org.id,
            scoring_enabled=True,
            formula_kind="ACTION_PRIORITY",
            formula_citation="Invented",
        )
    configure_fmea_scoring_policy(
        actor=manager,
        organization_id=org.id,
        scoring_enabled=True,
        formula_kind=FmeaScoringFormulaKind.SOD_PRODUCT,
        formula_citation="Owner-cited synthetic SOD product SYN-FMEA-SCORE-01 (not RPN policy).",
    )
    apply_scoring_policy_to_version(actor=manager, version_id=version.id)
    version.refresh_from_db()
    assert version.scoring_enabled is True
    with pytest.raises(ValidationError, match="Do not supply a score"):
        record_failure_mode_assessment(
            actor=manager,
            failure_mode_id=mode.id,
            severity_input="4",
            occurrence_input="3",
            detection_input="2",
            computed_score_text="24",
        )
    with pytest.raises(ValidationError, match="positive integer"):
        record_failure_mode_assessment(
            actor=manager,
            failure_mode_id=mode.id,
            severity_input="HIGH",
            occurrence_input="3",
            detection_input="2",
        )
    assessed = record_failure_mode_assessment(
        actor=manager,
        failure_mode_id=mode.id,
        severity_input="4",
        occurrence_input="3",
        detection_input="2",
        notes="Mathematical product only.",
    )
    assert assessed.computed_score_text == "24"
    assert (
        calculate_configured_sod_product(
            severity_input="5", occurrence_input="2", detection_input="2"
        )
        == "20"
    )
    configure_fmea_scoring_policy(
        actor=manager,
        organization_id=org.id,
        scoring_enabled=True,
        formula_kind=FmeaScoringFormulaKind.OWNER_SUPPLIED,
        formula_citation="Owner-cited qualitative method SYN-FMEA-OWN-01.",
    )
    apply_scoring_policy_to_version(actor=manager, version_id=version.id)
    with pytest.raises(ValidationError, match="Owner-supplied score text"):
        record_failure_mode_assessment(
            actor=manager,
            failure_mode_id=mode.id,
            severity_input="A",
            occurrence_input="B",
            detection_input="C",
        )
    owned = record_failure_mode_assessment(
        actor=manager,
        failure_mode_id=mode.id,
        severity_input="A",
        occurrence_input="B",
        detection_input="C",
        computed_score_text="OWNER-SCORE",
    )
    assessed.refresh_from_db()
    assert assessed.snapshot_number == 1
    assert assessed.computed_score_text == "24"
    assert owned.snapshot_number == 2
    assert owned.computed_score_text == "OWNER-SCORE"
    assert mode.assessments.count() == 2
    configure_fmea_scoring_policy(actor=manager, organization_id=org.id, scoring_enabled=False)
    apply_scoring_policy_to_version(actor=manager, version_id=version.id)
    assert str(ProcessFmeaScoringPolicy(organization_id=org.id, scoring_enabled=False))
    assert str(FailureModeAssessment(failure_mode=mode))


@pytest.mark.django_db
def test_links_and_explicit_capa_change_actions() -> None:
    org = make_org(code="PF-C")
    manager = _fmea_user(org=org, manage=True, action=True, capa=True, change=True, risk=True)
    _fmea, version, mode = _seed_mode(manager, org, code="SYN-PFMEA-020")
    risk = create_quality_risk(
        actor=manager,
        organization_id=org.id,
        risk_code="SYN-RSK-PF",
        title="Linked quality risk shell",
    )
    for kind, citation in (
        (ProcessFmeaLinkKind.PROCESS, "Process citation"),
        (ProcessFmeaLinkKind.HACCP, "HACCP plan citation"),
        (ProcessFmeaLinkKind.CHECKLIST, "Checklist citation"),
        (ProcessFmeaLinkKind.RISK, "Quality risk citation"),
        (ProcessFmeaLinkKind.NCR, "NCR citation"),
        (ProcessFmeaLinkKind.CAPA, "CAPA citation"),
        (ProcessFmeaLinkKind.CHANGE_CONTROL, "Change citation"),
    ):
        link_process_fmea(actor=manager, version_id=version.id, link_kind=kind, citation=citation)
    link_process_fmea(
        actor=manager,
        version_id=version.id,
        link_kind=ProcessFmeaLinkKind.RISK,
        citation="Risk object",
        linked_object_id=risk.id,
    )
    link_process_fmea(
        actor=manager,
        version_id=version.id,
        link_kind=ProcessFmeaLinkKind.PROCESS,
        citation="Process object optional",
        linked_object_id=uuid.uuid4(),
    )
    assert version.links.count() == 9
    with pytest.raises(ValidationError, match="not found in this organization"):
        link_process_fmea(
            actor=manager,
            version_id=version.id,
            link_kind=ProcessFmeaLinkKind.NCR,
            citation="missing",
            linked_object_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="Unknown FMEA link"):
        link_process_fmea(actor=manager, version_id=version.id, link_kind="INVENTED", citation="x")
    with pytest.raises(ValidationError, match="explicit_user_action"):
        add_recommended_action(
            actor=manager,
            failure_mode_id=mode.id,
            summary="Should fail",
            action_kind=ProcessFmeaActionKind.CAPA,
            create_follow_up=True,
            capa_code="SYN-CAPA-PF",
        )
    capa_action = add_recommended_action(
        actor=manager,
        failure_mode_id=mode.id,
        summary="Open CAPA from FMEA.",
        action_kind=ProcessFmeaActionKind.CAPA,
        explicit_user_action=True,
        create_follow_up=True,
        capa_code="SYN-CAPA-PF",
    )
    assert capa_action.corrective_action is not None
    change_action = add_recommended_action(
        actor=manager,
        failure_mode_id=mode.id,
        summary="Open change from FMEA.",
        action_kind=ProcessFmeaActionKind.CHANGE_REQUEST,
        explicit_user_action=True,
        create_follow_up=True,
        change_code="SYN-CHG-PF",
    )
    assert change_action.change_request is not None
    assert str(ProcessFmeaLink(link_kind=ProcessFmeaLinkKind.PROCESS, citation="x"))


@pytest.mark.django_db
def test_authorization_cross_org_and_guards() -> None:
    org_a = make_org(code="PF-X")
    org_b = make_org(code="PF-Y")
    manager_a = _fmea_user(org=org_a, manage=True, approve=True, action=True)
    viewer_a = _fmea_user(org=org_a, view=True)
    outsider = _fmea_user(org=org_b, view=True, manage=True)
    fmea, version, mode = _seed_mode(manager_a, org_a, code="SYN-PFMEA-030")
    with pytest.raises(PermissionDenied):
        create_process_fmea(
            actor=viewer_a,
            organization_id=org_a.id,
            fmea_code="SYN-DENIED",
            title="Denied",
        )
    with pytest.raises(PermissionDenied):
        get_process_fmea_for_org(actor=outsider, organization_id=org_a.id, fmea_id=fmea.id)
    with pytest.raises(PermissionDenied):
        approve_process_fmea_version(actor=viewer_a, version_id=version.id)
    with pytest.raises(PermissionDenied):
        add_recommended_action(
            actor=viewer_a,
            failure_mode_id=mode.id,
            summary="Viewer cannot open CAPA from FMEA.",
            action_kind=ProcessFmeaActionKind.CAPA,
            explicit_user_action=True,
            citation="cite",
        )
    assert list_process_fmeas(actor=viewer_a, organization_id=org_a.id).count() == 1
    with pytest.raises(ValidationError, match="already exists"):
        create_process_fmea(
            actor=manager_a,
            organization_id=org_a.id,
            fmea_code="SYN-PFMEA-030",
            title="Dup",
        )
    with pytest.raises(ValidationError, match="at least one failure mode"):
        empty = create_process_fmea(
            actor=manager_a,
            organization_id=org_a.id,
            fmea_code="SYN-PFMEA-031",
            title="Empty",
        )
        empty_version = empty.versions.get()
        add_process_step(
            actor=manager_a,
            version_id=empty_version.id,
            step_code="ONLY",
            description="Step only",
        )
        approve_process_fmea_version(actor=manager_a, version_id=empty_version.id)
    approve_process_fmea_version(actor=manager_a, version_id=version.id)
    with pytest.raises(ValidationError, match="historically immutable"):
        withdraw_process_fmea_version(actor=manager_a, version_id=version.id)
    draft = create_process_fmea(
        actor=manager_a,
        organization_id=org_a.id,
        fmea_code="SYN-PFMEA-032",
        title="Withdraw me",
    )
    withdrawn = withdraw_process_fmea_version(actor=manager_a, version_id=draft.versions.get().id)
    assert withdrawn.status == ProcessFmeaVersionStatus.WITHDRAWN
    with pytest.raises(ValidationError, match="approved FMEA version"):
        revise_process_fmea(actor=manager_a, fmea_id=draft.id)
    with pytest.raises(PermissionDenied):
        list_process_fmeas(actor=outsider, organization_id=org_a.id)
    request = RequestFactory().get("/")
    request.user = manager_a
    event_admin = ProcessFmeaEventAdmin(ProcessFmeaEvent, AdminSite())
    assert event_admin.has_add_permission(request) is False
    assert event_admin.has_change_permission(request) is False
    assert event_admin.has_delete_permission(request) is False
    retention = SoftRetentionAdmin(ProcessFmea, AdminSite())
    assert retention.has_delete_permission(request) is False
    ProcessFmea(organization=org_a, fmea_code="clean", title="t", created_by=manager_a).clean()
    with pytest.raises(ValidationError):
        ProcessFmea(organization=org_a, fmea_code=" ", title="t", created_by=manager_a).clean()
    with pytest.raises(ValidationError):
        ProcessFmea(organization=org_a, fmea_code="x", title=" ", created_by=manager_a).clean()
    with pytest.raises(ValidationError):
        ProcessStep(version=version, step_code=" ", description="d").clean()
    with pytest.raises(ValidationError):
        FailureMode(process_step=mode.process_step, mode_code=" ", description="d").clean()
    with pytest.raises(ValidationError):
        FailureEffect(failure_mode=mode, description=" ").clean()
    with pytest.raises(ValidationError):
        PotentialCause(failure_mode=mode, description=" ").clean()
    with pytest.raises(ValidationError):
        CurrentControl(failure_mode=mode, description=" ").clean()
    with pytest.raises(ValidationError):
        RecommendedAction(failure_mode=mode, summary=" ").clean()
    with pytest.raises(ValidationError):
        ProcessFmeaLink(version=version, link_kind=ProcessFmeaLinkKind.PROCESS, citation="").clean()
    assert SecurityAuditEvent.objects.filter(event_type="PROCESS_FMEA_CREATED").exists()
    revision = revise_process_fmea(actor=manager_a, fmea_id=fmea.id)
    cloned_mode = list_failure_modes(version=revision).get()
    with pytest.raises(ValidationError, match="Unknown recommended-action"):
        add_recommended_action(
            actor=manager_a,
            failure_mode_id=cloned_mode.id,
            summary="bad",
            action_kind="CERTIFICATE",
        )
    with pytest.raises(ValidationError, match="Owner-supplied CAPA"):
        add_recommended_action(
            actor=manager_a,
            failure_mode_id=cloned_mode.id,
            summary="capa",
            action_kind=ProcessFmeaActionKind.CAPA,
            explicit_user_action=True,
            create_follow_up=True,
        )
    with pytest.raises(ValidationError, match="not found in organization"):
        add_recommended_action(
            actor=manager_a,
            failure_mode_id=cloned_mode.id,
            summary="capa",
            action_kind=ProcessFmeaActionKind.CAPA,
            explicit_user_action=True,
            existing_capa_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="create_follow_up, existing_capa_id"):
        add_recommended_action(
            actor=manager_a,
            failure_mode_id=cloned_mode.id,
            summary="capa",
            action_kind=ProcessFmeaActionKind.CAPA,
            explicit_user_action=True,
        )
    with pytest.raises(ValidationError, match="Owner-supplied change"):
        add_recommended_action(
            actor=manager_a,
            failure_mode_id=cloned_mode.id,
            summary="chg",
            action_kind=ProcessFmeaActionKind.CHANGE_REQUEST,
            explicit_user_action=True,
            create_follow_up=True,
        )
    with pytest.raises(ValidationError, match="not found"):
        add_recommended_action(
            actor=manager_a,
            failure_mode_id=cloned_mode.id,
            summary="chg",
            action_kind=ProcessFmeaActionKind.CHANGE_REQUEST,
            explicit_user_action=True,
            existing_change_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="existing_change_id"):
        add_recommended_action(
            actor=manager_a,
            failure_mode_id=cloned_mode.id,
            summary="chg",
            action_kind=ProcessFmeaActionKind.CHANGE_REQUEST,
            explicit_user_action=True,
        )
