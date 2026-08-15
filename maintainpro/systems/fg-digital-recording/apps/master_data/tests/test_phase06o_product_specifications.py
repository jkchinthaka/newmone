"""Phase 06O — versioned product quality specifications (no invented Nelna limits)."""

from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_site, make_user

from apps.accounts.models import User
from apps.checklists.evaluation import evaluate_item_response
from apps.checklists.models import (
    ChecklistEvaluationResult,
    ChecklistEvaluationRuleKind,
    ChecklistResponseType,
    ChecklistTemplate,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    set_checklist_item_evaluation_rule,
)
from apps.master_data.historical_safety import (
    refuse_hard_delete_product_specification,
    refuse_hard_delete_specification_version,
)
from apps.master_data.models import (
    FGProduct,
    ProductSpecification,
    SpecificationParameter,
    SpecificationVersion,
    SpecificationVersionStatus,
)
from apps.master_data.selectors import list_product_specifications
from apps.master_data.services import create_fg_product
from apps.master_data.specification_evaluation import evaluate_specification_parameter
from apps.master_data.specification_services import (
    approve_specification_version,
    clone_specification_version_as_draft,
    create_product_specification,
    create_specification_version,
    remove_specification_parameter,
    retire_specification_version,
    update_draft_specification_version,
    upsert_specification_parameter,
)
from apps.organizations.models import Organization
from apps.quality.models import QAReview
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _spec_manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"S06OM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"SPEC{suffix}",
        name=f"Spec Manager {suffix}",
        permission=_perm(ProductSpecification, "manage_productspecification"),
    )
    role.permissions.add(_perm(ProductSpecification, "view_productspecification"))
    role.permissions.add(_perm(FGProduct, "manage_fgproduct"))
    role.permissions.add(_perm(FGProduct, "view_fgproduct"))
    grant_role(user, role, organization=org)
    return user


def _checklist_manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"C06OM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CHKM{suffix}",
        name=f"Checklist Manager {suffix}",
        permission=_perm(ChecklistTemplate, "manage_checklist"),
    )
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _product(actor: User, org: Organization, code: str) -> FGProduct:
    return create_fg_product(actor=actor, organization=org, code=code, name=f"Synthetic {code}")


@pytest.mark.django_db
def test_version_immutability_after_approve() -> None:
    org = make_org(code="ORG06O1")
    actor = _spec_manager(org=org)
    product = _product(actor, org, "SYN-P06O1")
    spec = create_product_specification(
        actor=actor,
        organization=org,
        product=product,
        code="SPEC-A",
        name="Synthetic Spec A",
    )
    version = SpecificationVersion.objects.get(specification=spec, version_number=1)
    # Synthetic bounds only — not Nelna limits.
    upsert_specification_parameter(
        actor=actor,
        version_id=version.id,
        code="PARAM1",
        name="Synthetic param",
        bound_min=Decimal("1.0"),
        bound_max=Decimal("2.0"),
        min_inclusive=True,
        max_inclusive=True,
    )
    approve_specification_version(actor=actor, version_id=version.id, approval_reference="SYN-APR")
    version.refresh_from_db()
    assert version.status == SpecificationVersionStatus.APPROVED
    assert version.is_immutable is True

    with pytest.raises(ValidationError):
        upsert_specification_parameter(
            actor=actor,
            version_id=version.id,
            code="PARAM1",
            name="Should not overwrite",
            bound_min=Decimal("9.0"),
            bound_max=Decimal("10.0"),
            min_inclusive=True,
            max_inclusive=True,
        )
    with pytest.raises(ValidationError):
        update_draft_specification_version(
            actor=actor,
            version_id=version.id,
            notes="mutate approved",
        )
    param = SpecificationParameter.objects.get(version=version, code="PARAM1")
    assert param.bound_min == Decimal("1.0")
    assert SecurityAuditEvent.objects.filter(event_type="SPECIFICATION_VERSION_APPROVED").exists()


@pytest.mark.django_db
def test_boundary_semantics_and_pending_bounds() -> None:
    org = make_org(code="ORG06O2")
    actor = _spec_manager(org=org)
    product = _product(actor, org, "SYN-P06O2")
    spec = create_product_specification(
        actor=actor,
        organization=org,
        product=product,
        code="SPEC-B",
        name="Synthetic Spec B",
        create_initial_draft=True,
    )
    version = SpecificationVersion.objects.get(specification=spec)
    pending = upsert_specification_parameter(
        actor=actor,
        version_id=version.id,
        code="PENDING",
        name="Pending evidence",
    )
    result, label, extra = evaluate_specification_parameter(value=Decimal("1.5"), parameter=pending)
    assert result == ChecklistEvaluationResult.NOT_EVALUATED
    assert label == "NOT_EVALUATED"
    assert extra["not_qa_disposition"] is True

    param = upsert_specification_parameter(
        actor=actor,
        version_id=version.id,
        code="BOUNDED",
        name="Synthetic bounded",
        bound_min=Decimal("10"),
        bound_max=Decimal("20"),
        min_inclusive=True,
        max_inclusive=False,  # exclusive max
        warn_min=Decimal("12"),
        warn_max=Decimal("18"),
        warn_min_inclusive=True,
        warn_max_inclusive=True,
    )
    in_spec, label_in, _ = evaluate_specification_parameter(value=Decimal("15"), parameter=param)
    assert in_spec == ChecklistEvaluationResult.PASS and label_in == "IN_SPEC"
    # 20 is exclusive hard max → OUT_OF_SPEC / FAIL (hard bounds win)
    out, label_out, ctx = evaluate_specification_parameter(value=Decimal("20"), parameter=param)
    assert out == ChecklistEvaluationResult.FAIL and label_out == "OUT_OF_SPEC"
    assert "OUT_OF_SPEC≠HOLD" in ctx["qa_disposition_note"]
    # Inside hard bounds but outside preferred warn band → WARN
    warn, label_warn, _ = evaluate_specification_parameter(value=Decimal("11"), parameter=param)
    assert warn == ChecklistEvaluationResult.WARN and label_warn == "WARN"
    assert QAReview.objects.count() == 0


@pytest.mark.django_db
def test_effective_dates_and_overlap_policy() -> None:
    org = make_org(code="ORG06O3")
    actor = _spec_manager(org=org)
    product = _product(actor, org, "SYN-P06O3")
    spec = create_product_specification(
        actor=actor,
        organization=org,
        product=product,
        code="SPEC-C",
        name="Synthetic Spec C",
        create_initial_draft=False,
    )
    v1 = create_specification_version(
        actor=actor,
        specification_id=spec.id,
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 6, 30),
    )
    with pytest.raises(ValidationError):
        update_draft_specification_version(
            actor=actor,
            version_id=v1.id,
            effective_from=datetime.date(2026, 6, 1),
            effective_to=datetime.date(2026, 1, 1),
        )
    approve_specification_version(actor=actor, version_id=v1.id)
    v2 = create_specification_version(
        actor=actor,
        specification_id=spec.id,
        effective_from=datetime.date(2026, 6, 1),
        effective_to=datetime.date(2026, 12, 31),
    )
    with pytest.raises(ValidationError):
        approve_specification_version(actor=actor, version_id=v2.id)
    update_draft_specification_version(
        actor=actor,
        version_id=v2.id,
        effective_from=datetime.date(2026, 7, 1),
        effective_to=datetime.date(2026, 12, 31),
    )
    approve_specification_version(actor=actor, version_id=v2.id)
    v2.refresh_from_db()
    assert v2.status == SpecificationVersionStatus.APPROVED
    assert v1.is_effective_on(datetime.date(2026, 3, 1)) is True
    assert v1.is_effective_on(datetime.date(2026, 8, 1)) is False


@pytest.mark.django_db
def test_product_isolation_and_historical_reference() -> None:
    org = make_org(code="ORG06O4")
    actor = _spec_manager(org=org)
    p1 = _product(actor, org, "SYN-P06O4A")
    p2 = _product(actor, org, "SYN-P06O4B")
    s1 = create_product_specification(
        actor=actor, organization=org, product=p1, code="SHARED-CODE", name="On P1"
    )
    s2 = create_product_specification(
        actor=actor, organization=org, product=p2, code="SHARED-CODE", name="On P2"
    )
    assert s1.id != s2.id
    listed = list(list_product_specifications(actor, organization=org, product=p1))
    assert {s.id for s in listed} == {s1.id}

    v1 = SpecificationVersion.objects.get(specification=s1, version_number=1)
    upsert_specification_parameter(
        actor=actor,
        version_id=v1.id,
        code="W",
        name="Synthetic weight param",
        bound_min=Decimal("100"),
        bound_max=Decimal("200"),
        min_inclusive=True,
        max_inclusive=True,
    )
    approve_specification_version(actor=actor, version_id=v1.id)
    draft = clone_specification_version_as_draft(actor=actor, source_version_id=v1.id)
    upsert_specification_parameter(
        actor=actor,
        version_id=draft.id,
        code="W",
        name="Synthetic weight param",
        bound_min=Decimal("110"),
        bound_max=Decimal("190"),
        min_inclusive=True,
        max_inclusive=True,
    )
    # Historical approved pin unchanged.
    hist = SpecificationParameter.objects.get(version_id=v1.id, code="W")
    assert hist.bound_min == Decimal("100")
    new_param = SpecificationParameter.objects.get(version_id=draft.id, code="W")
    assert new_param.bound_min == Decimal("110")


@pytest.mark.django_db
def test_cross_org_and_authorization() -> None:
    org_a = make_org(code="ORG06OA")
    org_b = make_org(code="ORG06OB")
    manager_a = _spec_manager(org=org_a)
    manager_b = _spec_manager(org=org_b)
    product_a = _product(manager_a, org_a, "SYN-PA")
    product_b = _product(manager_b, org_b, "SYN-PB")
    create_product_specification(
        actor=manager_a, organization=org_a, product=product_a, code="SPEC-X", name="A"
    )
    with pytest.raises(PermissionDenied):
        create_product_specification(
            actor=manager_a, organization=org_b, product=product_b, code="SPEC-Y", name="B"
        )
    site_a = make_site(org_a, code="SITE06OA")
    site_only = make_user(employee_code="S06OSITE", is_staff=True)
    role = make_role_with_permission(
        code="SITESPEC",
        name="Site Spec",
        permission=_perm(ProductSpecification, "manage_productspecification"),
    )
    grant_role(site_only, role, organization=org_a, site=site_a)
    with pytest.raises(PermissionDenied):
        create_product_specification(
            actor=site_only,
            organization=org_a,
            product=product_a,
            code="SPEC-Z",
            name="Denied site-only",
        )
    assert list_product_specifications(manager_b, organization=org_a).count() == 0


@pytest.mark.django_db
def test_checklist_evaluation_pin_and_no_auto_disposition() -> None:
    org = make_org(code="ORG06O5")
    spec_actor = _spec_manager(org=org)
    chk_actor = _checklist_manager(org=org)
    product = _product(spec_actor, org, "SYN-P06O5")
    spec = create_product_specification(
        actor=spec_actor,
        organization=org,
        product=product,
        code="SPEC-E",
        name="Eval Spec",
    )
    version = SpecificationVersion.objects.get(specification=spec)
    param = upsert_specification_parameter(
        actor=spec_actor,
        version_id=version.id,
        code="TEMP_SYN",
        name="Synthetic temp param",
        bound_min=Decimal("0"),
        bound_max=Decimal("5"),
        min_inclusive=True,
        max_inclusive=True,
    )
    approve_specification_version(actor=spec_actor, version_id=version.id)
    retire_specification_version(actor=spec_actor, version_id=version.id)
    version.refresh_from_db()
    assert version.status == SpecificationVersionStatus.RETIRED

    template = create_checklist_template(
        actor=chk_actor, organization=org, code="CHK06O", name="Spec Link"
    )
    draft = create_checklist_version(actor=chk_actor, template_id=template.id)
    section = add_checklist_section(actor=chk_actor, version_id=draft.id, title="S")
    item = add_checklist_item(
        actor=chk_actor,
        section_id=section.id,
        code="I1",
        label="Synthetic number",
        response_type=ChecklistResponseType.NUMBER,
        is_required=True,
    )
    rule = set_checklist_item_evaluation_rule(
        actor=chk_actor,
        item_id=item.id,
        rule_kind=ChecklistEvaluationRuleKind.SPECIFICATION_PARAMETER,
        specification_version_id=version.id,
        specification_parameter_id=param.id,
    )
    assert rule.specification_version_id == version.id
    result, ctx = evaluate_item_response(
        item=item, rule=rule, visible=True, number_value=Decimal("9")
    )
    assert result == ChecklistEvaluationResult.FAIL
    assert ctx["spec_result"] == "OUT_OF_SPEC"
    assert ctx["not_qa_disposition"] is True
    assert QAReview.objects.count() == 0

    with pytest.raises(ValidationError):
        refuse_hard_delete_specification_version(version)
    with pytest.raises(ValidationError):
        refuse_hard_delete_product_specification(spec)
    assert SpecificationVersion.objects.filter(pk=version.pk).exists()


@pytest.mark.django_db
def test_no_seeded_nelna_limits_in_repo_docs() -> None:
    """Guard: Phase 06O docs must not invent concrete Nelna temperature/weight limits."""
    doc = Path("docs/business/PHASE_06O_PRODUCT_SPECIFICATIONS.md")
    assert doc.is_file()
    text = doc.read_text(encoding="utf-8").lower()
    for banned in ("°c", "asm-001 value", "nelna limit =", "seed temperature"):
        assert banned not in text
    assert "evidence required" in text or "apr-006" in text


@pytest.mark.django_db
def test_remove_draft_parameter_and_missing_value_eval() -> None:
    org = make_org(code="ORG06O6")
    actor = _spec_manager(org=org)
    product = _product(actor, org, "SYN-P06O6")
    spec = create_product_specification(
        actor=actor, organization=org, product=product, code="SPEC-R", name="Remove"
    )
    version = SpecificationVersion.objects.get(specification=spec)
    param = upsert_specification_parameter(
        actor=actor, version_id=version.id, code="TMP", name="Temp remove"
    )
    remove_specification_parameter(actor=actor, parameter_id=param.id)
    assert not SpecificationParameter.objects.filter(pk=param.pk).exists()
    param2 = upsert_specification_parameter(
        actor=actor,
        version_id=version.id,
        code="BND",
        name="Bound",
        bound_min=Decimal("1"),
        bound_max=Decimal("2"),
        min_inclusive=True,
        max_inclusive=True,
    )
    result, label, _ = evaluate_specification_parameter(value=None, parameter=param2)
    assert result == ChecklistEvaluationResult.NOT_EVALUATED
    assert label == "NOT_EVALUATED"
    from apps.master_data.specification_evaluation import assert_parameter_belongs_to_version

    with pytest.raises(ValidationError):
        assert_parameter_belongs_to_version(parameter=param2, version_id=uuid.uuid4())


@pytest.mark.django_db
def test_clone_approved_version_creates_independent_draft() -> None:
    org = make_org(code="ORG06O7")
    actor = _spec_manager(org=org)
    product = _product(actor, org, "SYN-P06O7")
    spec = create_product_specification(
        actor=actor, organization=org, product=product, code="SPEC-CL", name="Clone"
    )
    version = SpecificationVersion.objects.get(specification=spec)
    upsert_specification_parameter(
        actor=actor,
        version_id=version.id,
        code="P1",
        name="Param",
        bound_min=Decimal("0"),
        bound_max=Decimal("1"),
        min_inclusive=True,
        max_inclusive=True,
    )
    approve_specification_version(actor=actor, version_id=version.id)
    cloned = clone_specification_version_as_draft(actor=actor, source_version_id=version.id)
    assert cloned.status == SpecificationVersionStatus.DRAFT
    assert cloned.version_number == 2
    assert SpecificationParameter.objects.filter(version=cloned, code="P1").exists()
    source_param = SpecificationParameter.objects.get(version=version, code="P1")
    cloned_param = SpecificationParameter.objects.get(version=cloned, code="P1")
    assert cloned_param.id != source_param.id
    assert SecurityAuditEvent.objects.filter(event_type="SPECIFICATION_VERSION_CLONED").exists()
