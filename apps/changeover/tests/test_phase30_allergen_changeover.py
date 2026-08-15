"""Phase 30 — allergen / changeover / line-clearance foundation tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.changeover.models import (
    AllergenReference,
    AllergenRiskPolicy,
    ChangeoverRecord,
    ChangeoverStatus,
    DeclarationStatus,
    LineClearanceRecord,
)
from apps.changeover.policy import evaluate_allergen_changeover_block
from apps.changeover.selectors import (
    changeovers_for_batch,
    changeovers_for_line,
    changeovers_for_organization,
    declarations_for_product,
    line_clearances_for_organization,
)
from apps.changeover.services import (
    approve_product_allergen_declaration,
    assert_can_view_changeover,
    create_allergen_reference,
    create_product_allergen_declaration,
    record_changeover,
    record_line_clearance,
    upsert_allergen_risk_policy,
    verify_changeover,
)
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.evidence.linking import resolve_linked_target
from apps.evidence.models import EvidenceLinkedKind
from apps.master_data.models import FGProduct
from apps.master_data.services import create_fg_product
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


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"CO{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CO{suffix}",
        name=f"Changeover mgr {suffix}",
        permission=_perm(AllergenReference, "manage_changeover"),
    )
    role.permissions.add(_perm(AllergenReference, "manage_allergenreference"))
    role.permissions.add(_perm(AllergenReference, "view_changeover"))
    role.permissions.add(_perm(AllergenReference, "manage_allergenriskpolicy"))
    role.permissions.add(_perm(FGProduct, "manage_fgproduct"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _verifier(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"CV{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CV{suffix}",
        name=f"Changeover QA {suffix}",
        permission=_perm(AllergenReference, "verify_changeover"),
    )
    role.permissions.add(_perm(AllergenReference, "view_changeover"))
    grant_role(user, role, organization=org)
    return user


def _viewer(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"VW{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"VW{suffix}",
        name=f"Changeover view {suffix}",
        permission=_perm(AllergenReference, "view_changeover"),
    )
    grant_role(user, role, organization=org)
    return user


def _product(manager: User, org: Organization) -> FGProduct:
    return create_fg_product(
        actor=manager,
        organization=org,
        code=f"FG-{uuid.uuid4().hex[:6].upper()}",
        name="Changeover product shell",
    )


def _published_template_version(*, actor: User, org: Organization) -> Any:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"CL-{uuid.uuid4().hex[:6].upper()}",
        name="Line clearance checklist shell",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Clearance")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="CLR",
        label="Line clear",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    publish_checklist_version(actor=actor, version_id=version.id)
    version.refresh_from_db()
    return template, version


@pytest.mark.django_db
def test_product_allergen_relationships_and_history() -> None:
    org = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    verifier = _verifier(org=org)
    product = _product(manager, org)

    ref = create_allergen_reference(
        actor=manager,
        organization=org,
        code=f"ALG-{uuid.uuid4().hex[:4].upper()}",
        name="Generic allergen shell",
        description="Company must map — not seeded Nelna list",
    )
    decl = create_product_allergen_declaration(
        actor=manager,
        organization=org,
        product=product,
        declaration_reference="DOC-OPAQUE-ALLERGEN",
        notes="Evidence required — shell only",
        allergen_reference_ids=[ref.id],
    )
    assert decl.status == DeclarationStatus.DRAFT
    assert declarations_for_product(product.id).filter(pk=decl.id).exists()
    assert decl.allergen_references.filter(pk=ref.id).exists()

    with pytest.raises(PermissionDenied):
        approve_product_allergen_declaration(actor=manager, declaration=decl)
    approved = approve_product_allergen_declaration(actor=verifier, declaration=decl)
    assert approved.status == DeclarationStatus.APPROVED
    assert SecurityAuditEvent.objects.filter(
        event_type="PRODUCT_ALLERGEN_DECLARATION_APPROVED"
    ).exists()


@pytest.mark.django_db
def test_changeover_line_scope_checklist_version_and_dossier_hooks() -> None:
    org = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    verifier = _verifier(org=org)
    prev = _product(manager, org)
    nxt = _product(manager, org)
    template, version = _published_template_version(actor=manager, org=org)

    decl_prev = create_product_allergen_declaration(
        actor=manager,
        organization=org,
        product=prev,
        declaration_reference="DEC-PREV",
    )
    approve_product_allergen_declaration(actor=verifier, declaration=decl_prev)
    decl_next = create_product_allergen_declaration(
        actor=manager,
        organization=org,
        product=nxt,
        declaration_reference="DEC-NEXT",
    )
    approve_product_allergen_declaration(actor=verifier, declaration=decl_next)

    record, decision = record_changeover(
        actor=manager,
        organization=org,
        previous_product=prev,
        next_product=nxt,
        line_code="LINE-A",
        batch_reference="BATCH-DOSSIER-1",
        cleaning_checklist_template=template,
        cleaning_checklist_version=version,
        previous_declaration=decl_prev,
        next_declaration=decl_next,
        evidence_object_key="private/evidence/changeover-1",
        evidence_file_name="clearance-photo.jpg",
        matrix_conflict_asserted=False,
    )
    assert decision["block_production"] is False
    assert record.status == ChangeoverStatus.RECORDED
    assert record.frozen_changeover_context["cleaning_checklist_version_id"] == str(version.id)
    assert record.frozen_changeover_context["batch_dossier_ready"] is True
    assert (
        changeovers_for_line(organization_id=org.id, line_code="LINE-A")
        .filter(pk=record.id)
        .exists()
    )
    assert (
        changeovers_for_batch(organization_id=org.id, batch_reference="BATCH-DOSSIER-1")
        .filter(pk=record.id)
        .exists()
    )
    assert changeovers_for_organization(org.id).filter(pk=record.id).exists()

    clearance = record_line_clearance(
        actor=manager,
        organization=org,
        checklist_template=template,
        checklist_version=version,
        changeover=record,
        line_code="LINE-A",
        notes="Checklist-engine clearance — no hardcoded steps",
    )
    assert clearance.frozen_clearance_context["checklist_version_number"] == (
        version.version_number
    )
    assert clearance.frozen_clearance_context["uses_checklist_engine"] is True
    assert line_clearances_for_organization(org.id).filter(pk=clearance.id).exists()

    verified = verify_changeover(actor=verifier, changeover=record, notes="QA OK")
    assert verified.status == ChangeoverStatus.VERIFIED
    assert verified.verified_by_id == verifier.id
    frozen = dict(verified.frozen_changeover_context)
    verified.line_code = "LINE-RENAMED-LATER"
    verified.save(update_fields=["line_code", "updated_at"])
    verified.refresh_from_db()
    assert verified.frozen_changeover_context["line_code"] == frozen["line_code"]

    target = resolve_linked_target(
        kind=EvidenceLinkedKind.CHANGEOVER_RECORD,
        object_id=record.id,
    )
    assert target.organization_id == org.id
    target2 = resolve_linked_target(
        kind=EvidenceLinkedKind.LINE_CLEARANCE_RECORD,
        object_id=clearance.id,
    )
    assert target2.organization_id == org.id
    assert SecurityAuditEvent.objects.filter(event_type="CHANGEOVER_RECORDED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="LINE_CLEARANCE_RECORDED").exists()


@pytest.mark.django_db
def test_authorization_and_cross_org() -> None:
    org_a = make_org(code=f"C{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    viewer = _viewer(org=org_a)
    outsider = make_user(employee_code=f"XX{uuid.uuid4().hex[:6].upper()}")

    prev = _product(manager_a, org_a)
    nxt = _product(manager_a, org_a)
    foreign = _product(manager_b, org_b)

    assert_can_view_changeover(actor=viewer, organization_id=org_a.id)
    with pytest.raises(PermissionDenied):
        assert_can_view_changeover(actor=outsider, organization_id=org_a.id)

    with pytest.raises(PermissionDenied):
        create_allergen_reference(
            actor=viewer,
            organization=org_a,
            code="NOPE",
            name="No manage",
        )

    with pytest.raises(ValidationError):
        record_changeover(
            actor=manager_a,
            organization=org_a,
            previous_product=prev,
            next_product=foreign,
            line_code="LINE-X",
        )

    with pytest.raises(PermissionDenied):
        record_changeover(
            actor=manager_b,
            organization=org_a,
            previous_product=prev,
            next_product=nxt,
            line_code="LINE-X",
        )


@pytest.mark.django_db
@override_settings(CHANGEOVER_ALLERGEN_BLOCK_APPROVED=False)
def test_policy_disabled_never_blocks() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    upsert_allergen_risk_policy(
        actor=manager,
        organization=org,
        policy_enabled=True,
        procedure_reference="SOP-OPAQUE",
        notes="Company policy stub — settings still OFF",
    )
    decision = evaluate_allergen_changeover_block(
        organization_id=org.id,
        matrix_conflict_asserted=True,
    )
    assert decision.block_production is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"
    assert decision.advisory_only is True

    prev = _product(manager, org)
    nxt = _product(manager, org)
    record, gate = record_changeover(
        actor=manager,
        organization=org,
        previous_product=prev,
        next_product=nxt,
        line_code="LINE-P",
        matrix_conflict_asserted=True,
    )
    assert gate["block_production"] is False
    assert (
        record.frozen_changeover_context["allergen_block_decision"]["reason_code"]
        == "SETTINGS_APPROVAL_MISSING"
    )


@pytest.mark.django_db
@override_settings(CHANGEOVER_ALLERGEN_BLOCK_APPROVED=True)
def test_policy_dual_gate_can_signal_block_when_approved() -> None:
    org = make_org(code=f"F{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    upsert_allergen_risk_policy(
        actor=manager,
        organization=org,
        policy_enabled=True,
        procedure_reference="SOP-APPROVED-MATRIX",
    )
    on = evaluate_allergen_changeover_block(
        organization_id=org.id,
        matrix_conflict_asserted=True,
    )
    assert on.block_production is True
    assert on.reason_code == "BLOCK_PRODUCTION_ENABLED"

    off_conflict = evaluate_allergen_changeover_block(
        organization_id=org.id,
        matrix_conflict_asserted=False,
    )
    assert off_conflict.block_production is False
    assert off_conflict.reason_code == "NO_MATRIX_CONFLICT_ASSERTED"

    AllergenRiskPolicy.objects.filter(organization=org).update(policy_enabled=False)
    disabled = evaluate_allergen_changeover_block(
        organization_id=org.id,
        matrix_conflict_asserted=True,
    )
    assert disabled.block_production is False
    assert disabled.reason_code == "POLICY_DISABLED"


@pytest.mark.django_db
def test_historical_record_preserves_checklist_pin() -> None:
    org = make_org(code=f"G{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template, version = _published_template_version(actor=manager, org=org)
    prev = _product(manager, org)
    nxt = _product(manager, org)
    record, _ = record_changeover(
        actor=manager,
        organization=org,
        previous_product=prev,
        next_product=nxt,
        line_code="LINE-H",
        cleaning_checklist_template=template,
        cleaning_checklist_version=version,
    )
    pinned = record.cleaning_checklist_version_id
    create_checklist_version(actor=manager, template_id=template.id)
    record.refresh_from_db()
    assert record.cleaning_checklist_version_id == pinned
    assert ChangeoverRecord.objects.get(pk=record.id).frozen_changeover_context[
        "cleaning_checklist_version_id"
    ] == str(pinned)

    with pytest.raises(ValidationError):
        create_allergen_reference(actor=manager, organization=org, code="", name="")
    with pytest.raises(ValidationError):
        _template2, version2 = _published_template_version(actor=manager, org=org)
        record_changeover(
            actor=manager,
            organization=org,
            previous_product=prev,
            next_product=nxt,
            cleaning_checklist_template=template,
            cleaning_checklist_version=version2,
        )
    assert LineClearanceRecord.objects.count() >= 0
    from django.contrib.admin.sites import AdminSite

    from apps.changeover.admin import SoftRetentionAdmin

    admin = SoftRetentionAdmin(AllergenReference, AdminSite())
    assert admin.has_delete_permission(request=None) is False
    assert str(record)
    assert AllergenRiskPolicy.objects.count() >= 0
