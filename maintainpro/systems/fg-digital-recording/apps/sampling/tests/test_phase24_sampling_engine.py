"""Phase 24 — configurable sampling engine tests."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
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
from apps.sampling.engine import (
    SamplingMatchContext,
    evaluate_sampling_acceptance,
    parse_lot_size,
    resolve_sampling_requirement,
)
from apps.sampling.models import (
    SamplingEvaluationResult,
    SamplingPlan,
    SamplingPlanVersion,
    SamplingPlanVersionStatus,
)
from apps.sampling.selectors import plans_for_organization, rules_for_version
from apps.sampling.services import (
    add_sampling_rule,
    approve_plan_version,
    bind_checklist_item_to_sampling_plan,
    create_draft_plan_version,
    create_sampling_plan,
    retire_plan_version,
    set_sample_requirement,
)
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
        code=f"S{suffix}",
        name=f"Sampling role {suffix}",
        permission=_perm(model, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)


def _approved_lot_plan(
    user: User, org: Organization, *, count: int = 5, accept: int = 1, reject: int = 2
) -> SamplingPlanVersion:
    plan = create_sampling_plan(
        actor=user,
        organization=org,
        code=f"SP-{uuid.uuid4().hex[:6].upper()}",
        title="Shell sampling plan",
        external_standard_source="",  # no invented ISO table
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    rule = add_sampling_rule(
        actor=user,
        plan_version_id=version.id,
        code="R-LOT",
        priority=10,
        lot_size_min=Decimal("1"),
        lot_size_max=Decimal("100"),
    )
    set_sample_requirement(
        actor=user,
        rule_id=rule.id,
        required_sample_count=count,
        accept_threshold=accept,
        reject_threshold=reject,
        inspection_level="",  # blank until approved
    )
    return approve_plan_version(actor=user, plan_version_id=version.id, effective_from=date.today())


@pytest.mark.django_db
def test_lot_boundaries_and_sample_count_resolution() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, SamplingPlan, "manage_samplingplan", "publish_samplingplan")
    version = _approved_lot_plan(user, org, count=8)
    ctx = SamplingMatchContext(organization_id=org.id, lot_size=Decimal("50"), as_of=date.today())
    result = resolve_sampling_requirement(context=ctx)
    assert result.matched is True
    assert result.reason_code == "MATCHED"
    assert result.required_sample_count == 8
    assert result.plan_version_id == str(version.id)
    assert result.snapshot["not_qa_disposition"] is True

    miss = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id, lot_size=Decimal("500"), as_of=date.today()
        )
    )
    assert miss.matched is False
    assert miss.reason_code == "NO_MATCHING_RULE"


@pytest.mark.django_db
def test_no_matching_plan_and_decimal_lot_size() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    assert parse_lot_size("12.5") == Decimal("12.5")
    with pytest.raises(ValueError):
        parse_lot_size("not-a-number")
    result = resolve_sampling_requirement(
        context=SamplingMatchContext(organization_id=org.id, lot_size=Decimal("10"))
    )
    assert result.matched is False
    assert result.reason_code == "NO_EFFECTIVE_PLAN"


@pytest.mark.django_db
def test_conflicting_same_priority_rules() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, SamplingPlan, "manage_samplingplan", "publish_samplingplan")
    plan = create_sampling_plan(
        actor=user, organization=org, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="Conflict"
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    r1 = add_sampling_rule(
        actor=user,
        plan_version_id=version.id,
        code="A-RULE",
        priority=5,
        lot_size_min=Decimal("1"),
        lot_size_max=Decimal("10"),
    )
    r2 = add_sampling_rule(
        actor=user,
        plan_version_id=version.id,
        code="B-RULE",
        priority=5,
        lot_size_min=Decimal("1"),
        lot_size_max=Decimal("10"),
    )
    set_sample_requirement(actor=user, rule_id=r1.id, required_sample_count=2)
    set_sample_requirement(actor=user, rule_id=r2.id, required_sample_count=3)
    approve_plan_version(actor=user, plan_version_id=version.id, effective_from=date.today())
    result = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id, lot_size=Decimal("5"), as_of=date.today()
        )
    )
    assert result.matched is True
    assert result.reason_code == "CONFLICTING_RULES"
    assert len(result.conflicting_rule_ids) == 2
    assert result.required_sample_count == 2  # stable: lower code A-RULE


@pytest.mark.django_db
def test_version_effectivity_and_immutability() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, SamplingPlan, "manage_samplingplan", "publish_samplingplan")
    plan = create_sampling_plan(
        actor=user, organization=org, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="Dated"
    )
    start = date.today()
    end = start + timedelta(days=7)
    version = create_draft_plan_version(
        actor=user, plan_id=plan.id, effective_from=start, effective_to=end
    )
    rule = add_sampling_rule(
        actor=user,
        plan_version_id=version.id,
        code="R1",
        lot_size_min=Decimal("1"),
        lot_size_max=Decimal("9"),
    )
    set_sample_requirement(actor=user, rule_id=rule.id, required_sample_count=4)
    approve_plan_version(actor=user, plan_version_id=version.id)
    assert version.is_immutable or SamplingPlanVersion.objects.get(pk=version.id).is_immutable
    with pytest.raises(ValidationError):
        add_sampling_rule(actor=user, plan_version_id=version.id, code="R2")
    outside = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id,
            lot_size=Decimal("5"),
            as_of=end + timedelta(days=1),
        )
    )
    assert outside.reason_code == "NO_EFFECTIVE_PLAN"
    retired = retire_plan_version(actor=user, plan_version_id=version.id)
    assert retired.status == SamplingPlanVersionStatus.RETIRED


@pytest.mark.django_db
def test_historical_snapshot_binding() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, SamplingPlan, "manage_samplingplan", "publish_samplingplan")
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

    version = _approved_lot_plan(user, org, count=6)
    template = create_checklist_template(
        actor=user, organization=org, code=f"T{uuid.uuid4().hex[:6].upper()}", name="Shell"
    )
    cver = create_checklist_version(actor=user, template_id=template.id)
    section = add_checklist_section(actor=user, version_id=cver.id, title="S1")
    group = add_checklist_item(
        actor=user,
        section_id=section.id,
        code="G1",
        label="Repeating shell",
        item_kind=ChecklistItemKind.REPEATING_GROUP,
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
    )
    binding = bind_checklist_item_to_sampling_plan(
        actor=user, checklist_item_id=group.id, plan_version_id=version.id
    )
    frozen = dict(binding.frozen_sampling_context)
    assert frozen["plan_version_id"] == str(version.id)
    assert frozen["version_number"] == version.version_number
    assert frozen["not_qa_disposition"] is True

    # Historical resolve against exact bound version
    hist = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id, lot_size=Decimal("20"), as_of=date.today()
        ),
        plan_version=version,
    )
    assert hist.matched is True
    assert hist.required_sample_count == 6
    assert hist.snapshot["plan_version_id"] == str(version.id)

    # New draft version must not rewrite frozen binding
    create_draft_plan_version(actor=user, plan_id=version.plan_id, change_summary="v2")
    binding.refresh_from_db()
    assert binding.frozen_sampling_context == frozen


@pytest.mark.django_db
def test_authorization_and_cross_org() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    manager = make_user(employee_code=f"M{uuid.uuid4().hex[:6].upper()}")
    publisher = make_user(employee_code=f"P{uuid.uuid4().hex[:6].upper()}")
    stranger = make_user(employee_code=f"X{uuid.uuid4().hex[:6].upper()}")
    _grant(manager, org_a, SamplingPlan, "manage_samplingplan")
    _grant(publisher, org_a, SamplingPlan, "publish_samplingplan")
    with pytest.raises(PermissionDenied):
        create_sampling_plan(actor=stranger, organization=org_a, code="X", title="no")
    with pytest.raises(PermissionDenied):
        create_sampling_plan(actor=manager, organization=org_b, code="X", title="cross")
    plan = create_sampling_plan(
        actor=manager, organization=org_a, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="A"
    )
    version = create_draft_plan_version(actor=manager, plan_id=plan.id)
    with pytest.raises(PermissionDenied):
        approve_plan_version(actor=manager, plan_version_id=version.id)
    approve_plan_version(actor=publisher, plan_version_id=version.id)
    assert plans_for_organization(org_a.id).filter(id=plan.id).exists()
    assert SecurityAuditEvent.objects.filter(event_type="SAMPLING_PLAN_VERSION_APPROVED").exists()


@pytest.mark.django_db
def test_sampling_reject_is_not_qa_disposition() -> None:
    outcome = evaluate_sampling_acceptance(
        defective_count=3, accept_threshold=1, reject_threshold=2
    )
    assert outcome.result == SamplingEvaluationResult.REJECT
    assert outcome.advisory_only is True
    assert outcome.as_dict()["not_qa_disposition"] is True
    missing = evaluate_sampling_acceptance(
        defective_count=1, accept_threshold=None, reject_threshold=None
    )
    assert missing.result == SamplingEvaluationResult.NOT_EVALUATED
    accept = evaluate_sampling_acceptance(defective_count=0, accept_threshold=1, reject_threshold=2)
    assert accept.result == SamplingEvaluationResult.ACCEPT


@pytest.mark.django_db
def test_requirement_validation_and_selectors() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, SamplingPlan, "manage_samplingplan")
    plan = create_sampling_plan(
        actor=user, organization=org, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="Val"
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    with pytest.raises(ValidationError):
        add_sampling_rule(
            actor=user,
            plan_version_id=version.id,
            code="BAD",
            lot_size_min=Decimal("10"),
            lot_size_max=Decimal("1"),
        )
    rule = add_sampling_rule(actor=user, plan_version_id=version.id, code="OK")
    with pytest.raises(ValidationError):
        set_sample_requirement(actor=user, rule_id=rule.id, accept_threshold=5, reject_threshold=5)
    set_sample_requirement(actor=user, rule_id=rule.id, accept_threshold=1, reject_threshold=3)
    assert rules_for_version(version.id).filter(id=rule.id).exists()


@pytest.mark.django_db
def test_dimension_filters_and_snapshot_helpers() -> None:
    from apps.master_data.models import FGProduct
    from apps.organizations.models import Site
    from apps.sampling.selectors import versions_for_plan
    from apps.sampling.snapshots import snapshot_for_checklist_item, snapshot_for_item_or_parent

    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, SamplingPlan, "manage_samplingplan", "publish_samplingplan")
    product = FGProduct.objects.create(
        organization=org,
        code=f"P{uuid.uuid4().hex[:6].upper()}",
        name="Opaque product",
    )
    site = Site.objects.create(
        organization=org,
        code=f"SI{uuid.uuid4().hex[:5].upper()}",
        name="Opaque site",
    )
    plan = create_sampling_plan(
        actor=user,
        organization=org,
        code=f"SP-{uuid.uuid4().hex[:6].upper()}",
        title="Dims",
        external_standard_source="COMPANY-REF-OPAQUE",
    )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    rule = add_sampling_rule(
        actor=user,
        plan_version_id=version.id,
        code="DIM",
        priority=1,
        product=product,
        product_group_code="GRP-A",
        inspection_type="NORMAL",
        risk_class="R1",
        site=site,
        process_code="PROC-1",
        lot_size_min=Decimal("1"),
        lot_size_max=Decimal("100"),
    )
    set_sample_requirement(
        actor=user,
        rule_id=rule.id,
        required_sample_count=3,
        sample_grouping="UNIT",
        accept_threshold=0,
        reject_threshold=1,
        inspection_level="II",
    )
    approve_plan_version(actor=user, plan_version_id=version.id, effective_from=date.today())

    hit = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id,
            lot_size=Decimal("10"),
            product_id=product.id,
            product_group_code="grp-a",
            inspection_type="normal",
            risk_class="r1",
            site_id=site.id,
            process_code="proc-1",
            as_of=date.today(),
        )
    )
    assert hit.matched is True
    assert hit.as_dict()["not_qa_disposition"] is True
    miss_product = resolve_sampling_requirement(
        context=SamplingMatchContext(
            organization_id=org.id,
            lot_size=Decimal("10"),
            product_id=uuid.uuid4(),
            product_group_code="GRP-A",
            inspection_type="NORMAL",
            risk_class="R1",
            site_id=site.id,
            process_code="PROC-1",
            as_of=date.today(),
        )
    )
    assert miss_product.matched is False
    assert versions_for_plan(plan.id).filter(id=version.id).exists()

    # Binding + snapshot helpers
    from apps.checklists.models import ChecklistTemplate
    from apps.checklists.services import (
        add_checklist_item,
        add_checklist_section,
        create_checklist_template,
        create_checklist_version,
    )

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
    template = create_checklist_template(
        actor=user, organization=org, code=f"T{uuid.uuid4().hex[:6].upper()}", name="S"
    )
    cver = create_checklist_version(actor=user, template_id=template.id)
    section = add_checklist_section(actor=user, version_id=cver.id, title="S1")
    group = add_checklist_item(
        actor=user,
        section_id=section.id,
        code="G1",
        label="Repeating",
        item_kind=ChecklistItemKind.REPEATING_GROUP,
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
    )
    child = add_checklist_item(
        actor=user,
        section_id=section.id,
        code="C1",
        label="Child",
        response_type=ChecklistResponseType.TEXT,
        parent_item_id=group.id,
    )
    binding = bind_checklist_item_to_sampling_plan(
        actor=user, checklist_item_id=group.id, plan_version_id=version.id
    )
    group_snapshot = snapshot_for_checklist_item(group.id)
    assert group_snapshot is not None
    assert group_snapshot["plan_version_id"] == str(version.id)
    child_snapshot = snapshot_for_item_or_parent(child)
    assert child_snapshot is not None
    assert child_snapshot["plan_version_id"] == str(version.id)
    assert snapshot_for_checklist_item(uuid.uuid4()) is None
    # Clear frozen to exercise fallback path
    binding.frozen_sampling_context = {}
    binding.save(update_fields=["frozen_sampling_context"])
    group_snapshot_after = snapshot_for_checklist_item(group.id)
    assert group_snapshot_after is not None
    assert group_snapshot_after["version_number"] == version.version_number

    between = evaluate_sampling_acceptance(
        defective_count=1, accept_threshold=0, reject_threshold=3
    )
    assert between.result == SamplingEvaluationResult.NOT_EVALUATED
    missing_defects = evaluate_sampling_acceptance(
        defective_count=None, accept_threshold=0, reject_threshold=1
    )
    assert missing_defects.reason_code == "DEFECTIVE_COUNT_MISSING"

    # Cross-org historical resolve denied
    other = make_org(code=f"O{uuid.uuid4().hex[:6].upper()}")
    denied = resolve_sampling_requirement(
        context=SamplingMatchContext(organization_id=other.id, lot_size=Decimal("10")),
        plan_version=version,
    )
    assert denied.reason_code == "CROSS_ORG_DENIED"


@pytest.mark.django_db
def test_service_guards_and_model_str() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    user = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")
    _grant(user, org, SamplingPlan, "manage_samplingplan", "publish_samplingplan")
    with pytest.raises(ValidationError):
        create_sampling_plan(actor=user, organization=org, code="", title="")
    plan = create_sampling_plan(
        actor=user, organization=org, code=f"SP-{uuid.uuid4().hex[:6].upper()}", title="G"
    )
    assert str(plan)
    with pytest.raises(ValidationError):
        create_draft_plan_version(
            actor=user,
            plan_id=plan.id,
            effective_from=date.today() + timedelta(days=5),
            effective_to=date.today(),
        )
    version = create_draft_plan_version(actor=user, plan_id=plan.id)
    assert str(version)
    with pytest.raises(ValidationError):
        retire_plan_version(actor=user, plan_version_id=version.id)
    rule = add_sampling_rule(actor=user, plan_version_id=version.id, code="R")
    assert str(rule)
    req = set_sample_requirement(actor=user, rule_id=rule.id, required_sample_count=2)
    assert str(req)
    approve_plan_version(actor=user, plan_version_id=version.id)
    with pytest.raises(ValidationError):
        approve_plan_version(actor=user, plan_version_id=version.id)
    with pytest.raises(ValidationError):
        bind_checklist_item_to_sampling_plan(
            actor=user, checklist_item_id=uuid.uuid4(), plan_version_id=version.id
        )
