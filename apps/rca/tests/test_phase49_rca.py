"""Phase 49 — structured root-cause analysis tests."""

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
from apps.organizations.models import Organization
from apps.rca.admin import RcaEventAdmin, SoftRetentionAdmin
from apps.rca.historical_safety import rca_is_historically_locked
from apps.rca.models import (
    RcaCause,
    RcaCauseState,
    RcaEvent,
    RcaFishboneCategory,
    RcaSourceKind,
    RcaStatus,
    RootCauseAnalysis,
)
from apps.rca.selectors import get_rca_for_org, list_rca_causes, list_rca_events, list_rcas
from apps.rca.services import (
    add_fishbone_entry,
    add_five_why_step,
    add_possible_cause,
    add_rca_evidence,
    add_rca_participant,
    cancel_rca,
    close_rca,
    confirm_root_cause,
    create_rca,
    link_confirmed_cause_to_capa,
    mark_cause_supported,
    record_rca_verification,
    start_rca,
)
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    content_type = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _rca_user(
    *,
    org: Organization,
    view: bool = True,
    manage: bool = False,
    confirm: bool = False,
    capa_link: bool = False,
    capa: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"RC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RC{suffix}",
        name=f"RCA {suffix}",
        permission=_perm(RootCauseAnalysis, "view_rca"),
    )
    if not view:
        role.permissions.remove(_perm(RootCauseAnalysis, "view_rca"))
    if manage:
        role.permissions.add(_perm(RootCauseAnalysis, "manage_rca"))
    if confirm:
        role.permissions.add(_perm(RootCauseAnalysis, "confirm_rca"))
    if capa_link:
        role.permissions.add(_perm(RootCauseAnalysis, "link_rca_capa"))
    if capa:
        role.permissions.add(_perm(CorrectiveAction, "create_capa"))
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_five_why_fishbone_cause_states_and_history() -> None:
    org = make_org(code="RC-A")
    investigator = _rca_user(org=org, manage=True, confirm=True)
    rca = create_rca(
        actor=investigator,
        organization_id=org.id,
        rca_code="SYN-RCA-001",
        source_kind=RcaSourceKind.NCR,
        source_citation="Owner-cited NCR SYN-NCR-001",
        problem_statement="Synthetic seal leak after packing.",
        facilitator=investigator,
    )
    assert rca.status == RcaStatus.DRAFT
    start_rca(actor=investigator, rca_id=rca.id)
    add_rca_participant(
        actor=investigator,
        rca_id=rca.id,
        participant=investigator,
        role_note="Facilitator",
    )
    first = add_five_why_step(
        actor=investigator,
        rca_id=rca.id,
        sequence=1,
        why_question="Why did the pack leak?",
        answer="Seal incomplete.",
    )
    add_five_why_step(
        actor=investigator,
        rca_id=rca.id,
        sequence=2,
        why_question="Why was the seal incomplete?",
        answer="Jaw misaligned.",
    )
    bone = add_fishbone_entry(
        actor=investigator,
        rca_id=rca.id,
        category=RcaFishboneCategory.MACHINE,
        description="Jaw alignment drift",
    )
    add_fishbone_entry(
        actor=investigator,
        rca_id=rca.id,
        category=RcaFishboneCategory.OTHER,
        category_label="Owner-cited category",
        description="Unclassified owner note",
    )
    possible = add_possible_cause(
        actor=investigator,
        rca_id=rca.id,
        statement="Jaw wear",
        suggested_by_ai=True,
    )
    assert possible.state == RcaCauseState.POSSIBLE_CAUSE
    assert possible.suggested_by_ai is True
    with pytest.raises(ValidationError, match="evidence"):
        mark_cause_supported(actor=investigator, cause_id=possible.id)
    supported = mark_cause_supported(
        actor=investigator,
        cause_id=possible.id,
        evidence_citation="Photo SYN-EVD-01",
    )
    assert supported.state == RcaCauseState.SUPPORTED_CAUSE
    with pytest.raises(ValidationError, match="Only a possible cause"):
        mark_cause_supported(actor=investigator, cause_id=possible.id)
    confirmed = confirm_root_cause(
        actor=investigator, cause_id=possible.id, confirmation_note="Human review."
    )
    assert confirmed.state == RcaCauseState.CONFIRMED_ROOT_CAUSE
    assert confirmed.confirmed_by_id == investigator.id
    rca.refresh_from_db()
    assert rca.status == RcaStatus.ROOT_CAUSE_CONFIRMED
    assert "Jaw wear" in rca.confirmed_root_cause_text
    assert list_rca_causes(rca=rca).count() == 1
    assert list_rca_events(rca=rca).filter(event_type="RCA_ROOT_CAUSE_CONFIRMED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="RCA_CREATED").exists()
    assert str(rca)
    assert str(first)
    assert str(bone)
    assert str(possible)
    assert not rca_is_historically_locked(RcaStatus.IN_PROGRESS)


@pytest.mark.django_db
def test_capa_linkage_evidence_and_verification() -> None:
    org = make_org(code="RC-B")
    investigator = _rca_user(org=org, manage=True, confirm=True, capa_link=True, capa=True)
    rca = create_rca(
        actor=investigator,
        organization_id=org.id,
        rca_code="SYN-RCA-010",
        source_kind=RcaSourceKind.COMPLAINT,
        source_citation="Complaint citation SYN-CMP",
        problem_statement="Synthetic complaint RCA.",
    )
    start_rca(actor=investigator, rca_id=rca.id)
    cause = add_possible_cause(actor=investigator, rca_id=rca.id, statement="Wrong label applied")
    add_rca_evidence(
        actor=investigator,
        rca_id=rca.id,
        cause_id=cause.id,
        citation="Retained pack photo SYN-EVD-02",
    )
    mark_cause_supported(actor=investigator, cause_id=cause.id)
    with pytest.raises(ValidationError, match="CONFIRMED_ROOT_CAUSE"):
        link_confirmed_cause_to_capa(
            actor=investigator,
            cause_id=cause.id,
            create_follow_up=True,
            capa_code="SYN-CAPA-RCA-1",
        )
    confirm_root_cause(actor=investigator, cause_id=cause.id)
    with pytest.raises(ValidationError, match="never created automatically"):
        link_confirmed_cause_to_capa(actor=investigator, cause_id=cause.id)
    link = link_confirmed_cause_to_capa(
        actor=investigator,
        cause_id=cause.id,
        create_follow_up=True,
        capa_code="SYN-CAPA-RCA-1",
    )
    assert link.corrective_action is not None
    existing = CorrectiveAction.objects.create(
        organization=org,
        code="SYN-EXIST-RCA",
        title="Existing",
        summary="Existing",
        created_by=investigator,
    )
    second_cause = add_possible_cause(
        actor=investigator, rca_id=rca.id, statement="Secondary confirmed cause"
    )
    add_rca_evidence(
        actor=investigator,
        rca_id=rca.id,
        cause_id=second_cause.id,
        citation="Line log SYN-EVD-03",
    )
    mark_cause_supported(actor=investigator, cause_id=second_cause.id)
    confirm_root_cause(actor=investigator, cause_id=second_cause.id)
    link_confirmed_cause_to_capa(
        actor=investigator, cause_id=second_cause.id, existing_capa_id=existing.id
    )
    record_rca_verification(
        actor=investigator, rca_id=rca.id, verification_notes="Checked against retained sample."
    )
    rca.refresh_from_db()
    assert rca.status == RcaStatus.VERIFIED
    close_rca(actor=investigator, rca_id=rca.id)
    rca.refresh_from_db()
    assert rca_is_historically_locked(rca.status)
    with pytest.raises(ValidationError, match="historically immutable"):
        add_five_why_step(
            actor=investigator,
            rca_id=rca.id,
            sequence=9,
            why_question="Blocked",
            answer="Blocked",
        )


@pytest.mark.django_db
def test_authorization_cross_org_and_no_auto_confirm() -> None:
    org_a = make_org(code="RC-C")
    org_b = make_org(code="RC-D")
    editor = _rca_user(org=org_a, manage=True)
    confirmer = _rca_user(org=org_a, confirm=True)
    viewer = _rca_user(org=org_a, view=True)
    stranger = _rca_user(org=org_b, manage=True, confirm=True, view=True)
    rca = create_rca(
        actor=editor,
        organization_id=org_a.id,
        rca_code="SYN-RCA-020",
        source_kind=RcaSourceKind.AUDIT_FINDING,
        source_citation="Finding citation",
        problem_statement="Audit finding RCA.",
    )
    cause = add_possible_cause(actor=editor, rca_id=rca.id, statement="Procedure drift")
    add_rca_evidence(actor=editor, rca_id=rca.id, cause_id=cause.id, citation="SOP gap note")
    mark_cause_supported(actor=editor, cause_id=cause.id)
    with pytest.raises(PermissionDenied):
        confirm_root_cause(actor=editor, cause_id=cause.id)
    with pytest.raises(PermissionDenied):
        create_rca(
            actor=stranger,
            organization_id=org_a.id,
            rca_code="CROSS",
            source_kind=RcaSourceKind.OTHER,
            source_citation="x",
            problem_statement="Blocked",
        )
    with pytest.raises(PermissionDenied):
        list_rcas(actor=stranger, organization_id=org_a.id)
    assert list_rcas(actor=viewer, organization_id=org_a.id).filter(pk=rca.id).exists()
    assert get_rca_for_org(actor=viewer, organization_id=org_a.id, rca_id=rca.id).id == rca.id
    start_rca(actor=editor, rca_id=rca.id)
    confirm_root_cause(actor=confirmer, cause_id=cause.id)
    with pytest.raises(PermissionDenied):
        link_confirmed_cause_to_capa(
            actor=editor,
            cause_id=cause.id,
            create_follow_up=True,
            capa_code="NOPE",
        )
    cancelled = create_rca(
        actor=editor,
        organization_id=org_a.id,
        rca_code="SYN-RCA-CANCEL",
        source_kind=RcaSourceKind.CAPA,
        source_citation="CAPA citation",
        problem_statement="Cancel shell",
    )
    cancel_rca(actor=editor, rca_id=cancelled.id)
    with pytest.raises(ValidationError, match="historically immutable"):
        add_possible_cause(actor=editor, rca_id=cancelled.id, statement="Blocked")
    with pytest.raises(ValidationError, match="not found"):
        create_rca(
            actor=editor,
            organization_id=org_a.id,
            rca_code="SYN-RCA-MISSING",
            source_kind=RcaSourceKind.NCR,
            source_citation="missing object",
            linked_object_id=uuid.uuid4(),
            problem_statement="Missing source",
        )
    with pytest.raises(ValidationError, match="Unknown RCA source"):
        create_rca(
            actor=editor,
            organization_id=org_a.id,
            rca_code="SYN-RCA-BAD",
            source_kind="INVENTED",
            source_citation="x",
            problem_statement="Bad",
        )
    site = AdminSite()
    event_admin = RcaEventAdmin(RcaEvent, site)
    request = RequestFactory().get("/")
    request.user = editor
    assert event_admin.has_add_permission(request) is False
    assert event_admin.has_change_permission(request) is False
    assert event_admin.has_delete_permission(request) is False
    assert SoftRetentionAdmin(RootCauseAnalysis, site).has_delete_permission(request) is False
    assert RcaCause(state=RcaCauseState.POSSIBLE_CAUSE).state == RcaCauseState.POSSIBLE_CAUSE
