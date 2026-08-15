"""Phase 47 — configurable quality-risk management tests."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
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
from apps.quality_risks.admin import QualityRiskEventAdmin, SoftRetentionAdmin
from apps.quality_risks.historical_safety import risk_is_historically_locked
from apps.quality_risks.models import (
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
from apps.quality_risks.selectors import (
    get_quality_risk_for_org,
    list_quality_risks,
    list_risk_assessments,
    list_risk_events,
    report_high_rated_risks,
    report_open_risks,
    report_overdue_reviews,
)
from apps.quality_risks.services import (
    accept_quality_risk,
    add_risk_mitigation,
    cancel_quality_risk,
    close_quality_risk,
    configure_scoring_policy,
    create_quality_risk,
    link_quality_risk,
    open_quality_risk,
    record_risk_assessment,
    record_risk_review,
    upsert_risk_category,
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


def _risk_user(
    *,
    org: Organization,
    view: bool = True,
    manage: bool = False,
    assess: bool = False,
    accept: bool = False,
    policy: bool = False,
    capa: bool = False,
    change: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"QR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"QR{suffix}",
        name=f"Quality risk {suffix}",
        permission=_perm(QualityRisk, "view_qualityrisk"),
    )
    if not view:
        role.permissions.remove(_perm(QualityRisk, "view_qualityrisk"))
    if manage:
        role.permissions.add(_perm(QualityRisk, "manage_qualityrisk"))
    if assess:
        role.permissions.add(_perm(QualityRisk, "assess_qualityrisk"))
    if accept:
        role.permissions.add(_perm(QualityRisk, "accept_qualityrisk"))
    if policy:
        role.permissions.add(_perm(QualityRisk, "manage_qualityriskpolicy"))
    if capa:
        role.permissions.add(_perm(CorrectiveAction, "create_capa"))
    if change:
        role.permissions.add(_perm(QualityChangeRequest, "create_qualitychange"))
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_risk_creation_history_and_scoring_gate() -> None:
    org = make_org(code="QR-A")
    manager = _risk_user(org=org, manage=True, assess=True, policy=True)
    upsert_risk_category(
        actor=manager, organization_id=org.id, code="SYN-FOOD", label="Synthetic food-safety"
    )
    with pytest.raises(ValidationError, match="owner-configured"):
        create_quality_risk(
            actor=manager,
            organization_id=org.id,
            risk_code="SYN-RSK-001",
            title="Invented category",
            category_code="INVENTED",
        )
    risk = create_quality_risk(
        actor=manager,
        organization_id=org.id,
        risk_code="SYN-RSK-001",
        title="Synthetic allergen cross-contact shell",
        category_code="SYN-FOOD",
        cause="Owner-noted cause",
        potential_impact="Owner-noted impact",
        existing_control="Owner-noted existing control",
        next_review_date=date.today() - timedelta(days=1),
    )
    assert risk.status == QualityRiskStatus.DRAFT
    open_quality_risk(actor=manager, risk_id=risk.id)
    first = record_risk_assessment(
        actor=manager,
        risk_id=risk.id,
        likelihood_input="OWNER-L",
        severity_input="OWNER-S",
        detectability_input="OWNER-D",
        exposure_input="OWNER-E",
        residual_risk_input="OWNER-R1",
        notes="First historical snapshot.",
    )
    with pytest.raises(ValidationError, match="scoring is disabled"):
        record_risk_assessment(
            actor=manager,
            risk_id=risk.id,
            residual_risk_input="OWNER-R2",
            computed_score_text="15",
        )
    with pytest.raises(ValidationError, match="owner-cited company method"):
        configure_scoring_policy(actor=manager, organization_id=org.id, scoring_enabled=True)
    configure_scoring_policy(
        actor=manager,
        organization_id=org.id,
        scoring_enabled=True,
        formula_citation="Owner-cited synthetic method SYN-SCORE-01 (not 1–5 invented).",
        high_rated_codes=["OWNER-HIGH"],
    )
    second = record_risk_assessment(
        actor=manager,
        risk_id=risk.id,
        residual_risk_input="OWNER-HIGH",
        computed_score_text="OWNER-SCORE",
        notes="Second snapshot; first remains.",
    )
    first.refresh_from_db()
    assert first.version_number == 1
    assert first.computed_score_text == ""
    assert second.version_number == 2
    assert list_risk_assessments(risk=risk).count() == 2
    assert (
        report_high_rated_risks(actor=manager, organization_id=org.id).filter(pk=risk.id).exists()
    )
    configure_scoring_policy(
        actor=manager,
        organization_id=org.id,
        scoring_enabled=False,
        formula_citation="",
        high_rated_codes=[],
    )
    assert report_high_rated_risks(actor=manager, organization_id=org.id).count() == 0
    assert str(risk)
    assert str(first)
    assert str(QualityRiskCategoryConfig(code="X"))
    assert str(QualityRiskScoringPolicy(organization_id=org.id, scoring_enabled=False))


@pytest.mark.django_db
def test_mitigation_review_links_and_dashboard() -> None:
    org = make_org(code="QR-B")
    manager = _risk_user(org=org, manage=True, assess=True, accept=True, capa=True, change=True)
    risk = create_quality_risk(
        actor=manager,
        organization_id=org.id,
        risk_code="SYN-RSK-010",
        title="Mitigation risk",
        next_review_date=date.today() - timedelta(days=2),
    )
    open_quality_risk(actor=manager, risk_id=risk.id)
    for kind, citation in (
        (QualityRiskLinkKind.PRODUCT, "Product citation"),
        (QualityRiskLinkKind.PROCESS, "Process citation"),
        (QualityRiskLinkKind.HACCP, "HACCP plan citation"),
        (QualityRiskLinkKind.SUPPLIER, "Supplier citation"),
        (QualityRiskLinkKind.EQUIPMENT, "Equipment citation"),
        (QualityRiskLinkKind.SYSTEM_FEATURE, "System feature citation"),
        (QualityRiskLinkKind.NCR, "NCR citation"),
        (QualityRiskLinkKind.CAPA, "CAPA citation"),
        (QualityRiskLinkKind.AUDIT, "QMS audit citation"),
        (QualityRiskLinkKind.CHANGE_CONTROL, "Change-control citation"),
    ):
        link_quality_risk(actor=manager, risk_id=risk.id, link_kind=kind, citation=citation)
    assert risk.links.count() == 10
    capa_mit = add_risk_mitigation(
        actor=manager,
        risk_id=risk.id,
        mitigation_kind=QualityRiskMitigationKind.CAPA,
        summary="Owner-supplied CAPA mitigation.",
        create_follow_up=True,
        capa_code="SYN-CAPA-QR",
    )
    assert capa_mit.corrective_action is not None
    add_risk_mitigation(
        actor=manager,
        risk_id=risk.id,
        mitigation_kind=QualityRiskMitigationKind.CHANGE_REQUEST,
        summary="Owner-supplied change mitigation.",
        create_follow_up=True,
        change_code="SYN-CHG-QR",
    )
    add_risk_mitigation(
        actor=manager,
        risk_id=risk.id,
        mitigation_kind=QualityRiskMitigationKind.TRAINING,
        summary="Training citation only.",
        citation="TRN-SYN",
    )
    add_risk_mitigation(
        actor=manager,
        risk_id=risk.id,
        mitigation_kind=QualityRiskMitigationKind.DOCUMENT,
        summary="Document citation only.",
        citation="DOC-SYN",
    )
    add_risk_mitigation(
        actor=manager,
        risk_id=risk.id,
        mitigation_kind=QualityRiskMitigationKind.CONTROL,
        summary="Existing control citation.",
        citation="CTRL-SYN",
    )
    review = record_risk_review(
        actor=manager,
        risk_id=risk.id,
        notes="Periodic review recorded.",
        next_review_date=date.today() + timedelta(days=30),
    )
    assert review.next_review_date is not None
    assert report_open_risks(actor=manager, organization_id=org.id).filter(pk=risk.id).exists()
    overdue = create_quality_risk(
        actor=manager,
        organization_id=org.id,
        risk_code="SYN-RSK-011",
        title="Overdue review risk",
        next_review_date=date.today() - timedelta(days=5),
    )
    open_quality_risk(actor=manager, risk_id=overdue.id)
    assert (
        report_overdue_reviews(actor=manager, organization_id=org.id).filter(pk=overdue.id).exists()
    )
    accept_quality_risk(
        actor=manager, risk_id=overdue.id, acceptance_rationale="Owner residual acceptance."
    )
    overdue.refresh_from_db()
    assert overdue.status == QualityRiskStatus.ACCEPTED
    assert str(QualityRiskLink(link_kind=QualityRiskLinkKind.PROCESS, citation="x"))
    assert str(QualityRiskMitigation(mitigation_kind="CONTROL", risk=risk))
    assert str(review)
    event = list_risk_events(risk=risk).first()
    assert event is not None
    assert str(event)


@pytest.mark.django_db
def test_authorization_cross_org_and_immutability() -> None:
    org_a = make_org(code="QR-X")
    org_b = make_org(code="QR-Y")
    manager_a = _risk_user(org=org_a, manage=True, assess=True, accept=True)
    viewer_a = _risk_user(org=org_a, view=True)
    outsider = _risk_user(org=org_b, view=True, manage=True)
    risk = create_quality_risk(
        actor=manager_a,
        organization_id=org_a.id,
        risk_code="SYN-RSK-020",
        title="Auth risk",
    )
    with pytest.raises(PermissionDenied):
        create_quality_risk(
            actor=viewer_a,
            organization_id=org_a.id,
            risk_code="SYN-DENIED",
            title="Denied",
        )
    with pytest.raises(PermissionDenied):
        get_quality_risk_for_org(actor=outsider, organization_id=org_a.id, risk_id=risk.id)
    with pytest.raises(PermissionDenied):
        accept_quality_risk(actor=viewer_a, risk_id=risk.id, acceptance_rationale="No accept perm.")
    open_quality_risk(actor=manager_a, risk_id=risk.id)
    assert list_quality_risks(actor=viewer_a, organization_id=org_a.id).count() == 1
    with pytest.raises(ValidationError, match="Unknown risk link kind"):
        link_quality_risk(actor=manager_a, risk_id=risk.id, link_kind="INVENTED", citation="x")
    close_quality_risk(actor=manager_a, risk_id=risk.id)
    assert risk_is_historically_locked(QualityRiskStatus.CLOSED)
    with pytest.raises(ValidationError, match="historically immutable"):
        record_risk_assessment(actor=manager_a, risk_id=risk.id, notes="too late")
    draft = create_quality_risk(
        actor=manager_a,
        organization_id=org_a.id,
        risk_code="SYN-RSK-021",
        title="Cancel me",
    )
    cancel_quality_risk(actor=manager_a, risk_id=draft.id)
    with pytest.raises(ValidationError, match="already exists"):
        create_quality_risk(
            actor=manager_a,
            organization_id=org_a.id,
            risk_code="SYN-RSK-020",
            title="Dup",
        )
    request = RequestFactory().get("/")
    request.user = manager_a
    event_admin = QualityRiskEventAdmin(QualityRiskEvent, AdminSite())
    assert event_admin.has_add_permission(request) is False
    assert event_admin.has_change_permission(request) is False
    assert event_admin.has_delete_permission(request) is False
    retention = SoftRetentionAdmin(QualityRisk, AdminSite())
    assert retention.has_delete_permission(request) is False
    QualityRisk(
        organization=org_a,
        risk_code="clean",
        title="t",
        created_by=manager_a,
    ).clean()
    with pytest.raises(ValidationError):
        QualityRisk(organization=org_a, risk_code=" ", title="t", created_by=manager_a).clean()
    assert SecurityAuditEvent.objects.filter(event_type="QUALITY_RISK_CREATED").exists()
    from apps.quality_risks.admin import QualityRiskAssessmentAdmin, QualityRiskReviewAdmin

    assess_admin = QualityRiskAssessmentAdmin(QualityRiskAssessment, AdminSite())
    assert assess_admin.has_add_permission(request) is False
    assert assess_admin.has_change_permission(request) is False
    review_admin = QualityRiskReviewAdmin(QualityRiskReview, AdminSite())
    assert review_admin.has_add_permission(request) is False
    assert review_admin.has_change_permission(request) is False


@pytest.mark.django_db
def test_link_resolve_mitigation_guards_and_selector_authz() -> None:
    org = make_org(code="QR-G")
    org_b = make_org(code="QR-H")
    manager = _risk_user(org=org, manage=True, assess=True, accept=True, policy=True)
    stranger = _risk_user(org=org_b, view=True)
    risk = create_quality_risk(
        actor=manager,
        organization_id=org.id,
        risk_code="SYN-RSK-030",
        title="Guardrail risk",
        owner_reference="QMS-OWNER-TBC",
    )
    open_quality_risk(actor=manager, risk_id=risk.id)
    link_quality_risk(
        actor=manager,
        risk_id=risk.id,
        link_kind=QualityRiskLinkKind.PROCESS,
        citation="Process shell",
        linked_object_id=uuid.uuid4(),
    )
    with pytest.raises(ValidationError, match="not found in this organization"):
        link_quality_risk(
            actor=manager,
            risk_id=risk.id,
            link_kind=QualityRiskLinkKind.PRODUCT,
            citation="missing product",
            linked_object_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="not found in this organization"):
        link_quality_risk(
            actor=manager,
            risk_id=risk.id,
            link_kind=QualityRiskLinkKind.NCR,
            citation="missing ncr",
            linked_object_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="Unknown mitigation"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind="CERTIFICATE",
            summary="nope",
        )
    with pytest.raises(ValidationError, match="Owner-supplied CAPA"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.CAPA,
            summary="capa",
            create_follow_up=True,
        )
    with pytest.raises(ValidationError, match="not found in organization"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.CAPA,
            summary="capa",
            existing_capa_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="create_follow_up, existing_capa_id"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.CAPA,
            summary="capa",
        )
    with pytest.raises(ValidationError, match="Owner-supplied change"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.CHANGE_REQUEST,
            summary="chg",
            create_follow_up=True,
        )
    with pytest.raises(ValidationError, match="not found"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.CHANGE_REQUEST,
            summary="chg",
            existing_change_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="existing_change_id"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.CHANGE_REQUEST,
            summary="chg",
        )
    with pytest.raises(ValidationError, match="Training record not found"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.TRAINING,
            summary="trn",
            existing_training_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="existing_training_id"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.TRAINING,
            summary="trn",
        )
    with pytest.raises(ValidationError, match="Document version not found"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.DOCUMENT,
            summary="doc",
            existing_document_version_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="existing_document_version_id"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.DOCUMENT,
            summary="doc",
        )
    with pytest.raises(ValidationError, match="owner-cited control"):
        add_risk_mitigation(
            actor=manager,
            risk_id=risk.id,
            mitigation_kind=QualityRiskMitigationKind.CONTROL,
            summary="ctrl",
        )
    with pytest.raises(ValidationError, match="Acceptance rationale"):
        accept_quality_risk(actor=manager, risk_id=risk.id, acceptance_rationale=" ")
    with pytest.raises(ValidationError, match="Category code"):
        upsert_risk_category(actor=manager, organization_id=org.id, code=" ", label="x")
    upsert_risk_category(actor=manager, organization_id=org.id, code="SYN-CAT", label="Cat")
    upsert_risk_category(actor=manager, organization_id=org.id, code="SYN-CAT", label="Cat 2")
    with pytest.raises(ValidationError, match="Review notes"):
        record_risk_review(actor=manager, risk_id=risk.id, notes=" ")
    review_risk = create_quality_risk(
        actor=manager,
        organization_id=org.id,
        risk_code="SYN-RSK-031",
        title="Review from open",
    )
    open_quality_risk(actor=manager, risk_id=review_risk.id)
    record_risk_review(
        actor=manager,
        risk_id=review_risk.id,
        notes="Periodic review from OPEN.",
        next_review_date=date.today() + timedelta(days=7),
    )
    review_risk.refresh_from_db()
    assert review_risk.status == QualityRiskStatus.UNDER_REVIEW
    policy = QualityRiskScoringPolicy.objects.create(
        organization_id=org.id,
        scoring_enabled=True,
        formula_citation="",
        high_rated_codes=[],
        updated_by=manager,
    )
    with pytest.raises(ValidationError, match="no owner-cited formula"):
        record_risk_assessment(actor=manager, risk_id=risk.id, residual_risk_input="X")
    policy.scoring_enabled = False
    policy.save()
    with pytest.raises(PermissionDenied):
        list_quality_risks(actor=stranger, organization_id=org.id)
    with pytest.raises(PermissionDenied):
        report_open_risks(actor=stranger, organization_id=org.id)
    with pytest.raises(PermissionDenied):
        report_overdue_reviews(actor=stranger, organization_id=org.id)
    with pytest.raises(PermissionDenied):
        report_high_rated_risks(actor=stranger, organization_id=org.id)
    assert (
        list_quality_risks(actor=manager, organization_id=org.id, status=QualityRiskStatus.OPEN)
        .filter(pk=risk.id)
        .exists()
    )
    with pytest.raises(ValidationError):
        QualityRisk(organization=org, risk_code="x", title=" ", created_by=manager).clean()
    with pytest.raises(ValidationError):
        QualityRiskLink(risk=risk, link_kind=QualityRiskLinkKind.PROCESS, citation="").clean()
    with pytest.raises(ValidationError):
        QualityRiskMitigation(risk=risk, mitigation_kind="CONTROL", summary=" ").clean()
