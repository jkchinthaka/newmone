"""Phase 24 sampling engine — additional coverage."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import AnonymousUser, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import RequestFactory
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistItemKind, ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
)
from apps.organizations.models import Organization
from apps.sampling.admin import SamplingPlanAdmin, SoftRetentionAdmin
from apps.sampling.engine import (
    SamplingMatchContext,
    evaluate_sampling_acceptance,
    parse_lot_size,
    resolve_sampling_requirement,
)
from apps.sampling.models import (
    SampleRequirement,
    SamplingEvaluationResult,
    SamplingHistoryEntry,
    SamplingPlan,
    SamplingPlanVersionStatus,
)
from apps.sampling.selectors import versions_for_plan
from apps.sampling.services import (
    add_sampling_rule,
    approve_plan_version,
    bind_checklist_item_to_sampling_plan,
    create_draft_plan_version,
    create_sampling_plan,
    retire_plan_version,
    set_sample_requirement,
)


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant(user: User, org: Organization, *codenames: str) -> None:
    suffix = uuid.uuid4().hex[:6].upper()
    role = make_role_with_permission(
        code=f"C{suffix}",
        name=f"Cov role {suffix}",
        permission=_perm(SamplingPlan, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(SamplingPlan, code))
    grant_role(user, role, organization=org)


@pytest.mark.django_db
def test_parse_lot_size_empty_and_engine_as_dict() -> None:
    assert parse_lot_size(None) is None
    assert parse_lot_size("") is None
    outcome = evaluate_sampling_acceptance(
        defective_count=None, accept_threshold=1, reject_threshold=2
    )
    assert outcome.result == SamplingEvaluationResult.NOT_EVALUATED
    assert outcome.reason_code == "DEFECTIVE_COUNT_MISSING"
    between = evaluate_sampling_acceptance(
        defective_count=2, accept_threshold=1, reject_threshold=4
    )
    assert between.result == SamplingEvaluationResult.NOT_EVALUATED
    assert between.reason_code == "BETWEEN_THRESHOLDS_PENDING_POLICY"
    assert between.as_dict()["advisory_only"] is True


@pytest.mark.django_db
def test_dimension_filters_and_priority_winner() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, "manage_samplingplan", "publish_samplingplan")
    plan = create_sampling_plan(
        actor=user, organization=org, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="Dims"
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    broad = add_sampling_rule(
        actor=user,
        plan_version_id=version.id,
        code="BROAD",
        priority=50,
        inspection_type="INCOMING",
        risk_class="HIGH",
        product_group_code="GRP1",
        process_code="PROC-A",
        lot_size_min=Decimal("1"),
        lot_size_max=Decimal("1000"),
    )
    narrow = add_sampling_rule(
        actor=user,
        plan_version_id=version.id,
        code="NARROW",
        priority=10,
        inspection_type="INCOMING",
        risk_class="HIGH",
        product_group_code="GRP1",
        process_code="PROC-A",
        lot_size_min=Decimal("1"),
        lot_size_max=Decimal("1000"),
    )
    set_sample_requirement(actor=user, rule_id=broad.id, required_sample_count=9)
    set_sample_requirement(actor=user, rule_id=narrow.id, required_sample_count=3)
    approve_plan_version(actor=user, plan_version_id=version.id, effective_from=date.today())

    hit = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id,
            lot_size=Decimal("100"),
            inspection_type="incoming",
            risk_class="high",
            product_group_code="grp1",
            process_code="proc-a",
            as_of=date.today(),
        )
    )
    assert hit.matched is True
    assert hit.reason_code == "MATCHED"
    assert hit.required_sample_count == 3
    assert hit.as_dict()["matched"] is True

    miss = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id,
            lot_size=Decimal("100"),
            inspection_type="OUTGOING",
            risk_class="HIGH",
            product_group_code="GRP1",
            process_code="PROC-A",
            as_of=date.today(),
        )
    )
    assert miss.matched is False


@pytest.mark.django_db
def test_cross_org_historical_resolve_denied() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org_a, "manage_samplingplan", "publish_samplingplan")
    plan = create_sampling_plan(
        actor=user, organization=org_a, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="A"
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    rule = add_sampling_rule(actor=user, plan_version_id=version.id, code="R1")
    set_sample_requirement(actor=user, rule_id=rule.id, required_sample_count=2)
    approve_plan_version(actor=user, plan_version_id=version.id, effective_from=date.today())
    denied = resolve_sampling_requirement(
        context=SamplingMatchContext(organization_id=org_b.id, lot_size=Decimal("1")),
        plan_version=version,
    )
    assert denied.reason_code == "CROSS_ORG_DENIED"


@pytest.mark.django_db
def test_service_validation_paths_and_selectors() -> None:
    org = make_org(code=f"V{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, "manage_samplingplan", "publish_samplingplan")
    with pytest.raises(PermissionDenied):
        create_sampling_plan(actor=None, organization=org, code="X", title="x")
    with pytest.raises(PermissionDenied):
        create_sampling_plan(actor=AnonymousUser(), organization=org, code="X", title="x")  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        create_sampling_plan(actor=user, organization=org, code="", title="")
    plan = create_sampling_plan(
        actor=user, organization=org, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="Val"
    )
    assert str(plan)
    with pytest.raises(ValidationError):
        create_draft_plan_version(actor=user, plan_id=uuid.uuid4())
    with pytest.raises(ValidationError):
        create_draft_plan_version(
            actor=user,
            plan_id=plan.id,
            effective_from=date.today() + timedelta(days=5),
            effective_to=date.today(),
        )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    assert str(version)
    assert versions_for_plan(plan.id).count() == 1
    with pytest.raises(ValidationError):
        add_sampling_rule(actor=user, plan_version_id=uuid.uuid4(), code="X")
    with pytest.raises(ValidationError):
        add_sampling_rule(actor=user, plan_version_id=version.id, code="")
    rule = add_sampling_rule(actor=user, plan_version_id=version.id, code="OK")
    assert str(rule)
    with pytest.raises(ValidationError):
        add_sampling_rule(actor=user, plan_version_id=version.id, code="OK")
    with pytest.raises(ValidationError):
        set_sample_requirement(actor=user, rule_id=uuid.uuid4())
    set_sample_requirement(
        actor=user,
        rule_id=rule.id,
        required_sample_count=4,
        sample_grouping="by_line",
        accept_threshold=0,
        reject_threshold=2,
        inspection_level="II",
    )
    req = SampleRequirement.objects.get(rule=rule)
    assert str(req)
    set_sample_requirement(actor=user, rule_id=rule.id, required_sample_count=5)
    with pytest.raises(ValidationError):
        approve_plan_version(actor=user, plan_version_id=uuid.uuid4())
    approve_plan_version(actor=user, plan_version_id=version.id, effective_from=date.today())
    with pytest.raises(ValidationError):
        approve_plan_version(actor=user, plan_version_id=version.id)
    with pytest.raises(ValidationError):
        add_sampling_rule(actor=user, plan_version_id=version.id, code="LATE")
    retired = retire_plan_version(actor=user, plan_version_id=version.id)
    assert retired.status == SamplingPlanVersionStatus.RETIRED
    with pytest.raises(ValidationError):
        retire_plan_version(actor=user, plan_version_id=version.id)
    with pytest.raises(ValidationError):
        retire_plan_version(actor=user, plan_version_id=uuid.uuid4())
    hist = SamplingHistoryEntry.objects.filter(plan=plan).first()
    assert hist is not None
    assert str(hist)


@pytest.mark.django_db
def test_binding_rejects_non_repeating_and_cross_org() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org_a, "manage_samplingplan", "publish_samplingplan")
    ct = ContentType.objects.get_for_model(ChecklistTemplate)
    manage_perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename="manage_checklist",
        defaults={"name": "Can manage checklist"},
    )
    role = make_role_with_permission(
        code=f"CL{uuid.uuid4().hex[:6].upper()}",
        name="CL",
        permission=manage_perm,
    )
    grant_role(user, role, organization=org_a)

    plan = create_sampling_plan(
        actor=user, organization=org_a, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="Bind"
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    rule = add_sampling_rule(actor=user, plan_version_id=version.id, code="R1")
    set_sample_requirement(actor=user, rule_id=rule.id, required_sample_count=2)
    approve_plan_version(actor=user, plan_version_id=version.id, effective_from=date.today())

    template = create_checklist_template(
        actor=user, organization=org_a, code=f"T{uuid.uuid4().hex[:6].upper()}", name="T"
    )
    cver = create_checklist_version(actor=user, template_id=template.id)
    section = add_checklist_section(actor=user, version_id=cver.id, title="S")
    simple = add_checklist_item(
        actor=user,
        section_id=section.id,
        code="S1",
        label="Simple",
        item_kind=ChecklistItemKind.SIMPLE,
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
    )
    with pytest.raises(ValidationError):
        bind_checklist_item_to_sampling_plan(
            actor=user, checklist_item_id=simple.id, plan_version_id=version.id
        )
    with pytest.raises(ValidationError):
        bind_checklist_item_to_sampling_plan(
            actor=user, checklist_item_id=uuid.uuid4(), plan_version_id=version.id
        )
    group = add_checklist_item(
        actor=user,
        section_id=section.id,
        code="G1",
        label="Group",
        item_kind=ChecklistItemKind.REPEATING_GROUP,
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
    )
    # Cross-org binding denied via foreign plan version.
    user_b = make_user(employee_code=f"B{uuid.uuid4().hex[:6].upper()}")
    _grant(user_b, org_b, "manage_samplingplan", "publish_samplingplan")
    plan_b = create_sampling_plan(
        actor=user_b, organization=org_b, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="B"
    )
    ver_b = create_draft_plan_version(actor=user_b, plan_id=plan_b.id)
    with pytest.raises(PermissionDenied):
        bind_checklist_item_to_sampling_plan(
            actor=user, checklist_item_id=group.id, plan_version_id=ver_b.id
        )
    with pytest.raises(ValidationError):
        bind_checklist_item_to_sampling_plan(
            actor=user, checklist_item_id=group.id, plan_version_id=uuid.uuid4()
        )
    binding = bind_checklist_item_to_sampling_plan(
        actor=user, checklist_item_id=group.id, plan_version_id=version.id
    )
    assert str(binding)
    assert binding.frozen_sampling_context["not_qa_disposition"] is True


@pytest.mark.django_db
def test_soft_retention_admin() -> None:
    from django.contrib.admin.sites import AdminSite

    rf = RequestFactory()
    request = rf.get("/")
    site = AdminSite()
    mixin = SoftRetentionAdmin(SamplingPlan, site)
    assert mixin.has_delete_permission(request) is False
    actions = mixin.get_actions(request)
    assert "delete_selected" not in actions
    _ = SamplingPlanAdmin(SamplingPlan, site)


@pytest.mark.django_db
def test_lot_edge_inclusive_and_missing_requirement() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, "manage_samplingplan", "publish_samplingplan")
    plan = create_sampling_plan(
        actor=user, organization=org, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="Edge"
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    add_sampling_rule(
        actor=user,
        plan_version_id=version.id,
        code="EDGE",
        lot_size_min=Decimal("10"),
        lot_size_max=Decimal("20"),
    )
    # no requirement yet
    approve_plan_version(actor=user, plan_version_id=version.id, effective_from=date.today())
    # approved immutable — need draft for requirement; create v2
    v2 = create_draft_plan_version(actor=user, plan_id=plan.id)
    r2 = add_sampling_rule(
        actor=user,
        plan_version_id=v2.id,
        code="EDGE2",
        lot_size_min=Decimal("10"),
        lot_size_max=Decimal("20"),
    )
    set_sample_requirement(actor=user, rule_id=r2.id, required_sample_count=7)
    approve_plan_version(
        actor=user,
        plan_version_id=v2.id,
        effective_from=date.today(),
        effective_to=date.today() + timedelta(days=30),
    )
    # retire v1 so only v2 effective with matching rule that has count
    retire_plan_version(actor=user, plan_version_id=version.id)
    lo = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id, lot_size=Decimal("10"), as_of=date.today()
        )
    )
    assert lo.matched is True
    assert lo.required_sample_count == 7
    hi = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id, lot_size=Decimal("20"), as_of=date.today()
        )
    )
    assert hi.matched is True
    below = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id, lot_size=Decimal("9.9999"), as_of=date.today()
        )
    )
    assert below.matched is False
