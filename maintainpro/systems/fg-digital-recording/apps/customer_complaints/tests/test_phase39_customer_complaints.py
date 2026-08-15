"""Phase 39 — Customer quality complaint management tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.customer_complaints.admin import SoftRetentionAdmin
from apps.customer_complaints.models import (
    ComplaintCaseStatus,
    ComplaintInvestigationLinkKind,
    CustomerComplaintCase,
    CustomerComplaintPolicy,
)
from apps.customer_complaints.policy import (
    complaint_customer_response_auto_send_approved,
    evaluate_complaint_customer_response,
)
from apps.customer_complaints.selectors import get_complaint_by_code, get_complaint_case
from apps.customer_complaints.services import (
    attempt_customer_response_send,
    can_view_customer_sensitive,
    close_complaint_case,
    create_complaint_case,
    get_complaint_timeline,
    link_complaint_evidence,
    open_complaint_case,
    record_complaint_communication,
    record_investigation_link,
    serialize_complaint_case,
    set_complaint_batch_reference,
    upsert_batch_trace,
    upsert_category_config,
    upsert_complaint_policy,
)
from apps.nonconformance.models import NonConformanceRecord
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


def _complaint_user(
    *,
    org: Organization,
    create: bool = True,
    manage: bool = True,
    close: bool = False,
    sensitive: bool = False,
    comm: bool = False,
    policy: bool = False,
    ncr: bool = False,
    capa: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"CQ{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CQ{suffix}",
        name=f"Complaint {suffix}",
        permission=_perm(CustomerComplaintCase, "view_customercomplaint"),
    )
    if create:
        role.permissions.add(_perm(CustomerComplaintCase, "create_customercomplaint"))
    if manage:
        role.permissions.add(_perm(CustomerComplaintCase, "manage_customercomplaint"))
    if close:
        role.permissions.add(_perm(CustomerComplaintCase, "close_customercomplaint"))
    if sensitive:
        role.permissions.add(_perm(CustomerComplaintCase, "view_complaint_customer_sensitive"))
    if comm:
        role.permissions.add(_perm(CustomerComplaintCase, "record_complaint_communication"))
    if policy:
        role.permissions.add(_perm(CustomerComplaintCase, "manage_complaintpolicy"))
    if ncr:
        role.permissions.add(_perm(NonConformanceRecord, "create_nonconformance"))
    if capa:
        role.permissions.add(_perm(CorrectiveAction, "create_capa"))
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_batch_known_and_unknown() -> None:
    org = make_org(code=f"C{uuid.uuid4().hex[:5].upper()}")
    actor = _complaint_user(org=org, close=True)

    unknown = create_complaint_case(
        actor=actor,
        organization=org,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="Customer reported off-odour — category TBC",
        erp_customer_reference="ERP-CUST-001",
        customer_display_label="Retail Partner A",
        product_reference="PROD-TBC",
        category_reference="CAT-TBC",
        batch_reference="",
    )
    assert unknown.batch_known is False
    assert unknown.batch_reference == ""
    assert unknown.status == ComplaintCaseStatus.OPEN

    with pytest.raises(ValidationError):
        upsert_batch_trace(
            actor=actor,
            organization=org,
            case_id=unknown.id,
            batch_reference="",
            dossier_batch_reference="",
        )

    known = set_complaint_batch_reference(
        actor=actor,
        organization=org,
        case_id=unknown.id,
        batch_reference="FG-BATCH-KNOWN-1",
    )
    assert known.batch_known is True
    assert known.batch_reference == "FG-BATCH-KNOWN-1"

    direct = create_complaint_case(
        actor=actor,
        organization=org,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="Batch known at intake",
        batch_reference="FG-BATCH-2",
    )
    assert direct.batch_known is True

    closed = close_complaint_case(
        actor=actor,
        organization=org,
        case_id=direct.id,
        closure_notes="Closed after review",
    )
    assert closed.status == ComplaintCaseStatus.CLOSED
    assert SecurityAuditEvent.objects.filter(event_type="COMPLAINT_CASE_CLOSED").exists()
    assert (
        SoftRetentionAdmin(CustomerComplaintCase, admin.site).has_delete_permission(None) is False
    )


@pytest.mark.django_db
def test_batch_trace_links_dossier_genealogy_qa_lab_dispatch() -> None:
    org = make_org(code=f"G{uuid.uuid4().hex[:5].upper()}")
    actor = _complaint_user(org=org)
    fg = f"FG-{uuid.uuid4().hex[:8].upper()}"
    case = create_complaint_case(
        actor=actor,
        organization=org,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="Trace drill",
        batch_reference=fg,
    )
    gene_id = uuid.uuid4()
    qa_id = uuid.uuid4()
    lab_id = uuid.uuid4()
    disp_id = uuid.uuid4()
    trace = upsert_batch_trace(
        actor=actor,
        organization=org,
        case_id=case.id,
        batch_reference=fg,
        dossier_batch_reference=fg,
        genealogy_node_id=gene_id,
        qa_disposition_reference=f"QA-DISP-{fg}",
        qa_review_id=qa_id,
        lab_sample_id=lab_id,
        lab_sample_reference=f"LAB-{fg}",
        dispatch_record_id=disp_id,
        dispatch_reference=f"DSP-{fg}",
    )
    assert trace.batch_reference == fg
    assert trace.dossier_batch_reference == fg
    assert trace.genealogy_node_id == gene_id
    assert trace.qa_disposition_reference.startswith("QA-DISP-")
    assert trace.lab_sample_id == lab_id
    assert trace.dispatch_record_id == disp_id
    case.refresh_from_db()
    assert case.status == ComplaintCaseStatus.INVESTIGATING
    assert SecurityAuditEvent.objects.filter(event_type="COMPLAINT_BATCH_TRACE_UPDATED").exists()


@pytest.mark.django_db
def test_privacy_redacts_customer_sensitive_fields() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:5].upper()}")
    actor = _complaint_user(org=org, sensitive=False)
    privileged = _complaint_user(org=org, sensitive=True)
    case = create_complaint_case(
        actor=actor,
        organization=org,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="Privacy check",
        erp_customer_reference="ERP-CUST-PRIV",
        customer_display_label="Sensitive Label Co",
    )
    redacted = serialize_complaint_case(case, viewer=actor)
    assert redacted["customer_display_label"] == ""
    assert redacted["customer_sensitive_redacted"] is True
    assert "REDACTED" in redacted["erp_customer_reference"]

    revealed = serialize_complaint_case(case, viewer=privileged)
    assert revealed["customer_display_label"] == "Sensitive Label Co"
    assert revealed["erp_customer_reference"] == "ERP-CUST-PRIV"
    assert revealed["customer_sensitive_redacted"] is False


@pytest.mark.django_db
def test_evidence_and_communication_no_auto_send() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:5].upper()}")
    actor = _complaint_user(org=org, comm=True, policy=True)
    case = create_complaint_case(
        actor=actor,
        organization=org,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="Comms and evidence",
    )
    evidence_id = uuid.uuid4()
    link = link_complaint_evidence(
        actor=actor,
        organization=org,
        case_id=case.id,
        evidence_attachment_id=evidence_id,
        notes="Photo shell",
    )
    assert link.evidence_attachment_id == evidence_id

    row = record_complaint_communication(
        actor=actor,
        organization=org,
        case_id=case.id,
        reference="COMM-REF-1",
        channel_reference="EMAIL-LOG-TBC",
        evidence_attachment_id=evidence_id,
    )
    assert row.reference == "COMM-REF-1"

    blocked = attempt_customer_response_send(actor=actor, organization=org, case_id=case.id)
    assert blocked["allowed"] is False
    assert blocked["message_not_sent"] is True
    assert complaint_customer_response_auto_send_approved() is False

    upsert_complaint_policy(
        actor=actor,
        organization=org,
        customer_response_auto_send_enabled=True,
        procedure_reference="RESP-PROC-TBC",
    )
    decision = evaluate_complaint_customer_response(organization_id=org.id)
    assert decision.allowed is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"

    with override_settings(COMPLAINT_CUSTOMER_RESPONSE_AUTO_SEND_APPROVED=True):
        prepared = attempt_customer_response_send(actor=actor, organization=org, case_id=case.id)
    assert prepared["allowed"] is True
    assert prepared["message_not_sent"] is True
    assert SecurityAuditEvent.objects.filter(event_type="COMPLAINT_EVIDENCE_LINKED").exists()


@pytest.mark.django_db
def test_rca_ncr_capa_explicit_links() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:5].upper()}")
    actor = _complaint_user(org=org, ncr=True, capa=True)
    case = create_complaint_case(
        actor=actor,
        organization=org,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="Investigation path",
        batch_reference="FG-INV-1",
    )
    rca = record_investigation_link(
        actor=actor,
        organization=org,
        case_id=case.id,
        link_kind=ComplaintInvestigationLinkKind.RCA,
        reference="RCA-REF-TBC",
        explicit_user_action=True,
    )
    assert rca.link_kind == ComplaintInvestigationLinkKind.RCA
    case.refresh_from_db()
    assert case.status == ComplaintCaseStatus.INVESTIGATING

    with pytest.raises(ValidationError):
        record_investigation_link(
            actor=actor,
            organization=org,
            case_id=case.id,
            link_kind=ComplaintInvestigationLinkKind.NCR,
            explicit_user_action=False,
            create_quality_case=True,
        )

    ncr_link = record_investigation_link(
        actor=actor,
        organization=org,
        case_id=case.id,
        link_kind=ComplaintInvestigationLinkKind.NCR,
        explicit_user_action=True,
        create_quality_case=True,
        ncr_code=f"NCR-C-{uuid.uuid4().hex[:6].upper()}",
        ncr_title="Complaint NCR",
    )
    assert ncr_link.nonconformance_id is not None
    assert NonConformanceRecord.objects.filter(id=ncr_link.nonconformance_id).exists()

    capa_link = record_investigation_link(
        actor=actor,
        organization=org,
        case_id=case.id,
        link_kind=ComplaintInvestigationLinkKind.CAPA,
        explicit_user_action=True,
        create_quality_case=True,
        capa_code=f"CAPA-C-{uuid.uuid4().hex[:6].upper()}",
        capa_title="Complaint CAPA",
        nonconformance_id=ncr_link.nonconformance_id,
    )
    assert capa_link.corrective_action_id is not None
    assert CorrectiveAction.objects.filter(id=capa_link.corrective_action_id).exists()
    assert SecurityAuditEvent.objects.filter(
        event_type="COMPLAINT_INVESTIGATION_LINKED",
        metadata__explicit_user_action=True,
    ).exists()


@pytest.mark.django_db
def test_authorization_and_cross_org() -> None:
    org_a = make_org(code=f"X{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"Y{uuid.uuid4().hex[:5].upper()}")
    actor_a = _complaint_user(org=org_a)
    actor_b = _complaint_user(org=org_b)

    case = create_complaint_case(
        actor=actor_a,
        organization=org_a,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="Org A only",
    )
    assert get_complaint_case(organization_id=org_b.id, case_id=case.id) is None
    assert get_complaint_by_code(organization_id=org_a.id, code=case.code) is not None

    with pytest.raises(PermissionDenied):
        set_complaint_batch_reference(
            actor=actor_b,
            organization=org_a,
            case_id=case.id,
            batch_reference="LEAK",
        )

    viewer = make_user(employee_code=f"VW{uuid.uuid4().hex[:6].upper()}")
    role = make_role_with_permission(
        code=f"VW{uuid.uuid4().hex[:6].upper()}",
        name="View only",
        permission=_perm(CustomerComplaintCase, "view_customercomplaint"),
    )
    grant_role(viewer, role, organization=org_a)
    with pytest.raises(PermissionDenied):
        create_complaint_case(
            actor=viewer,
            organization=org_a,
            code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
            description="denied",
        )


@pytest.mark.django_db
def test_category_config_is_not_seeded_taxonomy() -> None:
    org = make_org(code=f"K{uuid.uuid4().hex[:5].upper()}")
    actor = _complaint_user(org=org, policy=True)
    assert CustomerComplaintPolicy.objects.filter(organization=org).count() == 0
    cfg = upsert_category_config(
        actor=actor,
        organization=org,
        kind="CATEGORY",
        code="OWNED-CAT-1",
        label="Owner-configured category",
    )
    assert cfg.code == "OWNED-CAT-1"
    sev = upsert_category_config(
        actor=actor,
        organization=org,
        kind="SEVERITY",
        code="OWNED-SEV-1",
        label="Owner-configured severity",
        is_active=False,
        notes="shell only",
    )
    assert sev.kind == "SEVERITY"
    assert sev.is_active is False
    with pytest.raises(ValidationError):
        upsert_category_config(
            actor=actor,
            organization=org,
            kind="INVALID",
            code="X",
            label="Y",
        )


@pytest.mark.django_db
def test_draft_open_close_timeline_and_serialize_coverage() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:5].upper()}")
    actor = _complaint_user(org=org, close=True, comm=True, sensitive=True)
    draft = create_complaint_case(
        actor=actor,
        organization=org,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="Draft intake",
        erp_customer_reference="AB",
        customer_display_label="Label",
        open_immediately=False,
    )
    assert draft.status == ComplaintCaseStatus.DRAFT
    assert str(draft)
    with pytest.raises(ValidationError):
        close_complaint_case(
            actor=actor, organization=org, case_id=draft.id, closure_notes="too early"
        )
    opened = open_complaint_case(actor=actor, organization=org, case_id=draft.id)
    assert opened.status == ComplaintCaseStatus.OPEN

    inv = record_investigation_link(
        actor=actor,
        organization=org,
        case_id=opened.id,
        link_kind=ComplaintInvestigationLinkKind.INVESTIGATION,
        reference="INV-REF-TBC",
        explicit_user_action=True,
    )
    assert inv.reference == "INV-REF-TBC"
    with pytest.raises(ValidationError):
        record_investigation_link(
            actor=actor,
            organization=org,
            case_id=opened.id,
            link_kind="NOT_A_KIND",
            reference="X",
            explicit_user_action=True,
        )
    with pytest.raises(ValidationError):
        record_investigation_link(
            actor=actor,
            organization=org,
            case_id=opened.id,
            link_kind=ComplaintInvestigationLinkKind.RCA,
            reference="",
            explicit_user_action=True,
        )

    evidence_id = uuid.uuid4()
    link_complaint_evidence(
        actor=actor,
        organization=org,
        case_id=opened.id,
        evidence_attachment_id=evidence_id,
    )
    upsert_batch_trace(
        actor=actor,
        organization=org,
        case_id=opened.id,
        notes="opaque trace notes",
    )
    record_complaint_communication(
        actor=actor,
        organization=org,
        case_id=opened.id,
        reference="COMM-2",
        audience_reference="AUDIENCE-TBC",
    )
    payload = serialize_complaint_case(opened, viewer=actor)
    assert payload["batch_trace"] is not None
    assert payload["investigation_links"]
    assert payload["communications"]
    assert payload["evidence_links"]
    assert get_complaint_timeline(actor=actor, organization=org, case_id=opened.id)
    assert can_view_customer_sensitive(None, organization_id=org.id) is False
    assert get_complaint_by_code(organization_id=org.id, code="") is None

    closed = close_complaint_case(
        actor=actor, organization=org, case_id=opened.id, closure_notes="done"
    )
    assert closed.status == ComplaintCaseStatus.CLOSED
    again = close_complaint_case(
        actor=actor, organization=org, case_id=opened.id, closure_notes="noop"
    )
    assert again.status == ComplaintCaseStatus.CLOSED
    with pytest.raises(ValidationError):
        set_complaint_batch_reference(
            actor=actor,
            organization=org,
            case_id=opened.id,
            batch_reference="TOO-LATE",
        )
    decision = evaluate_complaint_customer_response(organization_id=org.id)
    assert decision.as_dict()["allowed"] is False
    assert decision.reason_code == "POLICY_DISABLED"


@pytest.mark.django_db
def test_not_found_and_unauthenticated_guards() -> None:
    org = make_org(code=f"Z{uuid.uuid4().hex[:5].upper()}")
    actor = _complaint_user(org=org, close=True, comm=True, policy=True)
    missing = uuid.uuid4()
    with pytest.raises(PermissionDenied):
        create_complaint_case(
            actor=None,
            organization=org,
            code="X",
            description="denied",
        )
    with pytest.raises(ValidationError):
        open_complaint_case(actor=actor, organization=org, case_id=missing)
    with pytest.raises(ValidationError):
        set_complaint_batch_reference(
            actor=actor, organization=org, case_id=missing, batch_reference="B"
        )
    with pytest.raises(ValidationError):
        upsert_batch_trace(actor=actor, organization=org, case_id=missing)
    with pytest.raises(ValidationError):
        link_complaint_evidence(
            actor=actor,
            organization=org,
            case_id=missing,
            evidence_attachment_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError):
        record_investigation_link(
            actor=actor,
            organization=org,
            case_id=missing,
            link_kind=ComplaintInvestigationLinkKind.RCA,
            reference="R",
            explicit_user_action=True,
        )
    with pytest.raises(ValidationError):
        record_complaint_communication(
            actor=actor, organization=org, case_id=missing, reference="C"
        )
    with pytest.raises(ValidationError):
        attempt_customer_response_send(actor=actor, organization=org, case_id=missing)
    with pytest.raises(ValidationError):
        close_complaint_case(actor=actor, organization=org, case_id=missing)

    case = create_complaint_case(
        actor=actor,
        organization=org,
        code=f"CQ-{uuid.uuid4().hex[:8].upper()}",
        description="comms empty ref",
    )
    with pytest.raises(ValidationError):
        record_complaint_communication(
            actor=actor, organization=org, case_id=case.id, reference="  "
        )
    redacted = serialize_complaint_case(case, viewer=None)
    assert redacted["customer_sensitive_redacted"] is True

    blank = CustomerComplaintCase(
        organization=org,
        code="",
        description="",
        received_at=case.received_at,
        created_by=actor,
    )
    with pytest.raises(ValidationError):
        blank.full_clean()
    assert str(
        upsert_complaint_policy(
            actor=actor,
            organization=org,
            customer_response_auto_send_enabled=False,
            procedure_reference="PROC-TBC",
        )
    )
