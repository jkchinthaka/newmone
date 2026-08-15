"""Phase 23 — HACCP / control-point foundation tests."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
)
from apps.haccp.models import (
    ControlPoint,
    HaccpControlPointType,
    HaccpPlan,
    HaccpPlanVersion,
    HaccpPlanVersionStatus,
    HazardCategory,
)
from apps.haccp.policy import evaluate_control_point_failure_policy
from apps.haccp.selectors import approved_versions_effective_on, plans_for_organization
from apps.haccp.services import (
    add_control_point,
    add_hazard,
    add_process_step,
    approve_plan_version,
    bind_checklist_item_to_control_point,
    create_draft_plan_version,
    create_haccp_plan,
    retire_plan_version,
    set_corrective_action_reference,
    set_critical_limit_reference,
    set_monitoring_rule,
)
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant(user: User, org: Organization, model: type[Any], *codenames: str) -> None:
    suffix = uuid.uuid4().hex[:6].upper()
    role = make_role_with_permission(
        code=f"H{suffix}",
        name=f"HACCP role {suffix}",
        permission=_perm(model, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)


def _draft_tree(user: User, org: Organization) -> tuple[HaccpPlan, HaccpPlanVersion, ControlPoint]:
    plan = create_haccp_plan(
        actor=user, organization=org, code=f"HP-{uuid.uuid4().hex[:6].upper()}", title="Shell plan"
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id, change_summary="initial draft")
    step = add_process_step(
        actor=user, plan_version_id=version.id, code="STEP-1", title="Opaque step", sequence=1
    )
    hazard = add_hazard(
        actor=user,
        process_step_id=step.id,
        code="HZ-1",
        title="Generic hazard shell",
        category=HazardCategory.BIOLOGICAL,
    )
    cp = add_control_point(
        actor=user,
        plan_version_id=version.id,
        process_step_id=step.id,
        hazard_id=hazard.id,
        code="CP-1",
        title="Control point shell",
        control_point_type=HaccpControlPointType.CCP,
    )
    return plan, version, cp


@pytest.mark.django_db
def test_version_immutability_after_approve() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan", "approve_haccpplan", "view_haccp")
    _plan, version, cp = _draft_tree(user, org)
    set_critical_limit_reference(
        actor=user,
        control_point_id=cp.id,
        rule_reference="RULE-REF-OPAQUE",
        unit="",
        source_reference="EVIDENCE-PENDING",
    )
    set_monitoring_rule(
        actor=user,
        control_point_id=cp.id,
        method_reference="",
        frequency_reference="",
    )
    approved = approve_plan_version(
        actor=user,
        plan_version_id=version.id,
        effective_from=date.today(),
    )
    assert approved.status == HaccpPlanVersionStatus.APPROVED
    assert approved.is_immutable
    assert approved.approved_by_id == user.id
    with pytest.raises(ValidationError):
        add_process_step(actor=user, plan_version_id=version.id, code="STEP-X", title="blocked")
    assert SecurityAuditEvent.objects.filter(event_type="HACCP_PLAN_VERSION_APPROVED").exists()


@pytest.mark.django_db
def test_effective_dates_and_retire() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan", "approve_haccpplan")
    plan = create_haccp_plan(
        actor=user, organization=org, code=f"HP-{uuid.uuid4().hex[:6].upper()}", title="Dated"
    )
    start = date.today()
    end = start + timedelta(days=30)
    version = create_draft_plan_version(
        actor=user,
        plan_id=plan.id,
        effective_from=start,
        effective_to=end,
    )
    with pytest.raises(ValidationError):
        create_draft_plan_version(
            actor=user,
            plan_id=plan.id,
            effective_from=end,
            effective_to=start,
        )
    approve_plan_version(actor=user, plan_version_id=version.id)
    assert (
        approved_versions_effective_on(organization_id=org.id, as_of=start)
        .filter(id=version.id)
        .exists()
    )
    assert (
        not approved_versions_effective_on(organization_id=org.id, as_of=end + timedelta(days=1))
        .filter(id=version.id)
        .exists()
    )
    retired = retire_plan_version(actor=user, plan_version_id=version.id)
    assert retired.status == HaccpPlanVersionStatus.RETIRED


@pytest.mark.django_db
def test_control_point_link_and_checklist_historical_integrity() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan", "approve_haccpplan")
    # Checklist authoring uses checklist permissions via services that check publish/manage
    from apps.checklists.models import ChecklistTemplate

    ct = ContentType.objects.get_for_model(ChecklistTemplate)
    manage_perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename="manage_checklist",
        defaults={"name": "Can manage checklist"},
    )
    role = make_role_with_permission(
        code=f"C{uuid.uuid4().hex[:6].upper()}",
        name="Checklist manager",
        permission=manage_perm,
    )
    grant_role(user, role, organization=org)

    plan, version, cp = _draft_tree(user, org)
    approve_plan_version(actor=user, plan_version_id=version.id)

    template = create_checklist_template(
        actor=user, organization=org, code=f"T{uuid.uuid4().hex[:6].upper()}", name="Shell"
    )
    cver = create_checklist_version(actor=user, template_id=template.id)
    section = add_checklist_section(actor=user, version_id=cver.id, title="S1")
    item = add_checklist_item(
        actor=user,
        section_id=section.id,
        code="I1",
        label="Opaque item",
        response_type=ChecklistResponseType.TEXT,
    )
    binding = bind_checklist_item_to_control_point(
        actor=user,
        checklist_item_id=item.id,
        plan_version_id=version.id,
        control_point_id=cp.id,
    )
    frozen = dict(binding.frozen_haccp_context)
    assert frozen["control_point_code"] == cp.code
    assert frozen["plan_version_id"] == str(version.id)
    assert frozen["version_number"] == version.version_number

    # New immutable version must not rewrite frozen historical binding context.
    v2 = create_draft_plan_version(actor=user, plan_id=plan.id, change_summary="v2")
    binding.refresh_from_db()
    assert binding.plan_version_id == version.id
    assert binding.frozen_haccp_context == frozen
    assert v2.version_number == 2


@pytest.mark.django_db
def test_authorization_and_cross_org() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    manager = make_user(employee_code=f"M{uuid.uuid4().hex[:6].upper()}")
    stranger = make_user(employee_code=f"S{uuid.uuid4().hex[:6].upper()}")
    approver = make_user(employee_code=f"P{uuid.uuid4().hex[:6].upper()}")
    _grant(manager, org_a, HaccpPlan, "manage_haccpplan")
    _grant(approver, org_a, HaccpPlan, "approve_haccpplan")
    with pytest.raises(PermissionDenied):
        create_haccp_plan(actor=stranger, organization=org_a, code="X", title="denied")
    with pytest.raises(PermissionDenied):
        create_haccp_plan(actor=manager, organization=org_b, code="X", title="cross")
    plan = create_haccp_plan(
        actor=manager, organization=org_a, code=f"HP-{uuid.uuid4().hex[:6].upper()}", title="A"
    )
    version = create_draft_plan_version(actor=manager, plan_id=plan.id)
    # Manager without approve cannot approve (System Admin assumption rejected).
    with pytest.raises(PermissionDenied):
        approve_plan_version(actor=manager, plan_version_id=version.id)
    approve_plan_version(actor=approver, plan_version_id=version.id)
    assert plans_for_organization(org_a.id).filter(id=plan.id).exists()


@pytest.mark.django_db
def test_no_auto_hold_by_default() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan")
    _plan, _version, cp = _draft_tree(user, org)
    decision = evaluate_control_point_failure_policy(control_point=cp)
    assert decision.auto_hold is False
    assert decision.auto_ncr is False
    assert decision.reason_code == "NO_CORRECTIVE_REF"
    assert decision.as_dict()["advisory_only"] is True

    set_corrective_action_reference(
        actor=user,
        control_point_id=cp.id,
        procedure_reference="PROC-OPAQUE",
        auto_raise_hold_enabled=False,
        auto_raise_ncr_enabled=False,
    )
    cp.refresh_from_db()
    decision2 = evaluate_control_point_failure_policy(control_point=cp)
    assert decision2.auto_hold is False
    assert decision2.auto_ncr is False
    assert decision2.reason_code == "CORRECTIVE_REF_ADVISORY_ONLY"


@pytest.mark.django_db
def test_staff_superuser_not_food_safety_authority() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    staff = make_user(
        employee_code=f"ST{uuid.uuid4().hex[:6].upper()}",
        is_staff=True,
        is_superuser=True,
    )
    with pytest.raises(PermissionDenied):
        create_haccp_plan(actor=staff, organization=org, code="X", title="no FS authority")


@pytest.mark.django_db
def test_published_checklist_binding_immutable() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan", "approve_haccpplan")
    from apps.checklists.models import ChecklistTemplate
    from apps.checklists.services import publish_checklist_version

    ct = ContentType.objects.get_for_model(ChecklistTemplate)
    manage_perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename="manage_checklist",
        defaults={"name": "Can manage checklist"},
    )
    role = make_role_with_permission(
        code=f"C{uuid.uuid4().hex[:6].upper()}",
        name="Checklist manager",
        permission=manage_perm,
    )
    grant_role(user, role, organization=org)

    _plan, version, cp = _draft_tree(user, org)
    approve_plan_version(actor=user, plan_version_id=version.id)
    template = create_checklist_template(
        actor=user, organization=org, code=f"T{uuid.uuid4().hex[:6].upper()}", name="Shell"
    )
    cver = create_checklist_version(actor=user, template_id=template.id)
    section = add_checklist_section(actor=user, version_id=cver.id, title="S1")
    item = add_checklist_item(
        actor=user,
        section_id=section.id,
        code="I1",
        label="Opaque item",
        response_type=ChecklistResponseType.TEXT,
    )
    bind_checklist_item_to_control_point(
        actor=user,
        checklist_item_id=item.id,
        plan_version_id=version.id,
        control_point_id=cp.id,
    )
    publish_checklist_version(actor=user, version_id=cver.id)
    v2 = create_draft_plan_version(actor=user, plan_id=_plan.id, change_summary="v2")
    step = add_process_step(
        actor=user, plan_version_id=v2.id, code="STEP-2", title="Opaque", sequence=1
    )
    cp2 = add_control_point(
        actor=user,
        plan_version_id=v2.id,
        process_step_id=step.id,
        code="CP-2",
        title="Other shell",
        control_point_type=HaccpControlPointType.OPRP,
    )
    with pytest.raises(ValidationError):
        bind_checklist_item_to_control_point(
            actor=user,
            checklist_item_id=item.id,
            plan_version_id=v2.id,
            control_point_id=cp2.id,
        )


@pytest.mark.django_db
def test_control_measure_and_auto_flag_advisory() -> None:
    from apps.haccp.services import add_control_measure

    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan")
    _plan, _version, cp = _draft_tree(user, org)
    hazard = cp.hazard
    assert hazard is not None
    measure = add_control_measure(
        actor=user,
        hazard_id=hazard.id,
        code="CM-1",
        title="Opaque measure",
    )
    assert measure.code == "CM-1"
    with pytest.raises(ValidationError):
        add_hazard(
            actor=user,
            process_step_id=cp.process_step_id,
            code="HZ-BAD",
            title="bad",
            category="NOT_A_CATEGORY",
        )
    set_corrective_action_reference(
        actor=user,
        control_point_id=cp.id,
        procedure_reference="PROC-OPT-IN-SHELL",
        auto_raise_hold_enabled=True,
        auto_raise_ncr_enabled=False,
    )
    decision = evaluate_control_point_failure_policy(control_point=cp)
    assert decision.auto_hold is True
    assert decision.auto_ncr is False
    assert decision.reason_code == "AUTO_FLAGS_CONFIGURED"
    # Policy remains advisory — does not create HoldCase/NCR here.
    assert decision.as_dict()["advisory_only"] is True


@pytest.mark.django_db
def test_approve_retire_guards_and_snapshot_helper() -> None:
    from apps.haccp.snapshots import build_haccp_context_snapshot, snapshot_for_checklist_item

    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan", "approve_haccpplan")
    plan, version, cp = _draft_tree(user, org)
    with pytest.raises(ValidationError):
        retire_plan_version(actor=user, plan_version_id=version.id)
    approve_plan_version(actor=user, plan_version_id=version.id)
    with pytest.raises(ValidationError):
        approve_plan_version(actor=user, plan_version_id=version.id)
    snap = build_haccp_context_snapshot(plan_version=version, control_point=cp)
    assert snap["control_point_type"] == cp.control_point_type
    assert snapshot_for_checklist_item(uuid.uuid4()) is None
    assert plans_for_organization(org.id).filter(id=plan.id).exists()


@pytest.mark.django_db
def test_critical_limit_reference_keeps_bounds_null() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan")
    _plan, _version, cp = _draft_tree(user, org)
    ref = set_critical_limit_reference(
        actor=user,
        control_point_id=cp.id,
        rule_reference="PENDING",
        boundary_semantics="INCLUSIVE",
    )
    assert ref.lower_bound is None
    assert ref.upper_bound is None
    assert ref.specification_parameter_id is None


@pytest.mark.django_db
def test_control_measure_and_snapshots() -> None:
    from apps.haccp.selectors import control_points_for_version, versions_for_plan
    from apps.haccp.services import add_control_measure
    from apps.haccp.snapshots import build_haccp_context_snapshot, snapshot_for_checklist_item

    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan", "approve_haccpplan")
    plan, version, cp = _draft_tree(user, org)
    hazard = cp.hazard
    assert hazard is not None
    measure = add_control_measure(
        actor=user,
        hazard_id=hazard.id,
        code="CM-1",
        title="Opaque measure shell",
    )
    assert measure.code == "CM-1"
    assert versions_for_plan(plan.id).filter(id=version.id).exists()
    assert control_points_for_version(version.id).filter(id=cp.id).exists()

    snap = build_haccp_context_snapshot(plan_version=version, control_point=cp)
    assert snap["control_point_code"] == cp.code
    assert snap["not_qa_disposition"] is True
    assert snapshot_for_checklist_item(uuid.uuid4()) is None


@pytest.mark.django_db
def test_control_point_clean_rejects_cross_step_hazard() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan")
    _plan, version, cp = _draft_tree(user, org)
    step2 = add_process_step(
        actor=user, plan_version_id=version.id, code="STEP-2", title="Other", sequence=2
    )
    hazard2 = add_hazard(
        actor=user,
        process_step_id=step2.id,
        code="HZ-2",
        title="Other hazard",
        category=HazardCategory.PHYSICAL,
    )
    with pytest.raises(ValidationError):
        add_control_point(
            actor=user,
            plan_version_id=version.id,
            process_step_id=cp.process_step_id,
            hazard_id=hazard2.id,
            code="CP-BAD",
            title="Bad link",
            control_point_type=HaccpControlPointType.OPRP,
        )


@pytest.mark.django_db
def test_snapshot_prefers_frozen_binding_context() -> None:
    from apps.checklists.models import ChecklistTemplate
    from apps.haccp.snapshots import snapshot_for_checklist_item

    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, HaccpPlan, "manage_haccpplan", "approve_haccpplan")
    ct = ContentType.objects.get_for_model(ChecklistTemplate)
    manage_perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename="manage_checklist",
        defaults={"name": "Can manage checklist"},
    )
    role = make_role_with_permission(
        code=f"C{uuid.uuid4().hex[:6].upper()}",
        name="Checklist manager",
        permission=manage_perm,
    )
    grant_role(user, role, organization=org)
    _plan, version, cp = _draft_tree(user, org)
    approve_plan_version(actor=user, plan_version_id=version.id)
    template = create_checklist_template(
        actor=user, organization=org, code=f"T{uuid.uuid4().hex[:6].upper()}", name="Shell"
    )
    cver = create_checklist_version(actor=user, template_id=template.id)
    section = add_checklist_section(actor=user, version_id=cver.id, title="S1")
    item = add_checklist_item(
        actor=user,
        section_id=section.id,
        code="I2",
        label="Opaque",
        response_type=ChecklistResponseType.TEXT,
    )
    binding = bind_checklist_item_to_control_point(
        actor=user,
        checklist_item_id=item.id,
        plan_version_id=version.id,
        control_point_id=cp.id,
    )
    out = snapshot_for_checklist_item(item.id)
    assert out is not None
    assert out["control_point_id"] == str(cp.id)
    assert out.get("not_qa_disposition") is True
    assert binding.frozen_haccp_context["control_point_code"] == cp.code
