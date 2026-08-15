"""Phase 46 — compliance / control-mapping foundation tests."""

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
from apps.compliance_mapping.admin import ComplianceMappingEventAdmin, SoftRetentionAdmin
from apps.compliance_mapping.historical_safety import edition_is_historically_locked
from apps.compliance_mapping.models import (
    ApplicabilityStatus,
    ComplianceControlMapping,
    ComplianceEvidenceLink,
    ComplianceGap,
    ComplianceGapAction,
    ComplianceMappingEvent,
    ComplianceSource,
    ComplianceSourceEdition,
    ComplianceSourceKind,
    ControlMappingStatus,
    GapActionKind,
    SourceRegisterStatus,
    SystemControlKind,
)
from apps.compliance_mapping.selectors import (
    get_source_for_org,
    list_compliance_sources,
    list_control_mappings,
    list_mapping_events,
    list_open_gaps,
    list_source_editions,
    report_mapping_status,
)
from apps.compliance_mapping.services import (
    close_compliance_gap,
    create_control_mapping,
    link_gap_action,
    link_mapping_evidence,
    open_compliance_gap,
    register_compliance_source,
    revise_compliance_source,
    set_mapping_status,
    set_source_applicability,
    verify_control_mapping,
)
from apps.evidence.linking import (
    assert_can_upload_to_target,
    assert_can_view_target,
    resolve_linked_target,
)
from apps.evidence.models import EvidenceAttachment, EvidenceLinkedKind
from apps.nonconformance.models import NonConformanceRecord
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    content_type = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _cm_user(
    *,
    org: Organization,
    view: bool = True,
    source: bool = False,
    control: bool = False,
    verify: bool = False,
    gap: bool = False,
    ncr: bool = False,
    capa: bool = False,
    change: bool = False,
    evidence: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"CM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CM{suffix}",
        name=f"Compliance mapping {suffix}",
        permission=_perm(ComplianceSource, "view_compliancemapping"),
    )
    if not view:
        role.permissions.remove(_perm(ComplianceSource, "view_compliancemapping"))
    if source:
        role.permissions.add(_perm(ComplianceSource, "manage_compliancesource"))
    if control:
        role.permissions.add(_perm(ComplianceSource, "manage_compliancecontrol"))
    if verify:
        role.permissions.add(_perm(ComplianceSource, "verify_compliancecontrol"))
    if gap:
        role.permissions.add(_perm(ComplianceSource, "link_compliance_gap_action"))
    if ncr:
        role.permissions.add(_perm(NonConformanceRecord, "create_nonconformance"))
    if capa:
        role.permissions.add(_perm(CorrectiveAction, "create_capa"))
    if change:
        role.permissions.add(_perm(QualityChangeRequest, "create_qualitychange"))
    if evidence:
        role.permissions.add(_perm(EvidenceAttachment, "view_evidenceattachment"))
        role.permissions.add(_perm(EvidenceAttachment, "upload_evidenceattachment"))
    grant_role(user, role, organization=org)
    return user


def _register(
    actor: User, org: Organization, code: str = "SYN-POL-001"
) -> tuple[ComplianceSource, ComplianceSourceEdition]:
    return register_compliance_source(
        actor=actor,
        organization_id=org.id,
        source_code=code,
        title="Synthetic company policy shell",
        kind=ComplianceSourceKind.COMPANY_POLICY,
        version_edition="v1",
        official_source_citation="Owner-cited internal policy register (synthetic).",
        business_owner_reference="QMS-OWNER-TBC",
    )


@pytest.mark.django_db
def test_mapping_creation_status_and_version_change() -> None:
    org = make_org(code="CM-A")
    admin_user = _cm_user(org=org, source=True, control=True, verify=True)
    source, edition = _register(admin_user, org)
    assert edition.applicability_status == ApplicabilityStatus.NOT_ASSESSED
    assert source.kind != ComplianceSourceKind.CERTIFICATION_SCHEME
    set_source_applicability(
        actor=admin_user,
        edition_id=edition.id,
        applicability_status=ApplicabilityStatus.APPLICABLE,
    )
    mapping = create_control_mapping(
        actor=admin_user,
        edition_id=edition.id,
        clause_reference="POL-4.1",
        requirement_summary="Owner-supplied internal clause summary.",
        system_control_kind=SystemControlKind.DOCUMENT_VERSION,
        system_control_reference="DOC-SYN-001",
        owner_reference="QMS",
    )
    assert mapping.status == ControlMappingStatus.NOT_ASSESSED
    set_mapping_status(
        actor=admin_user, mapping_id=mapping.id, status=ControlMappingStatus.APPLICABLE
    )
    set_mapping_status(
        actor=admin_user,
        mapping_id=mapping.id,
        status=ControlMappingStatus.CONTROL_DESIGNED,
    )
    set_mapping_status(
        actor=admin_user, mapping_id=mapping.id, status=ControlMappingStatus.IMPLEMENTED
    )
    verified = verify_control_mapping(actor=admin_user, mapping_id=mapping.id)
    assert verified.status == ControlMappingStatus.VERIFIED
    assert verified.status != "COMPLIANT"
    with pytest.raises(ValidationError, match="not COMPLIANT"):
        set_mapping_status(actor=admin_user, mapping_id=mapping.id, status="COMPLIANT")
    with pytest.raises(ValidationError, match="separate authority"):
        set_mapping_status(
            actor=admin_user, mapping_id=mapping.id, status=ControlMappingStatus.VERIFIED
        )
    new_edition = revise_compliance_source(
        actor=admin_user,
        source_id=source.id,
        version_edition="v2",
        official_source_citation="Owner-cited revision (synthetic).",
    )
    edition.refresh_from_db()
    assert edition.register_status == SourceRegisterStatus.SUPERSEDED
    assert edition_is_historically_locked(edition.register_status)
    mapping.refresh_from_db()
    assert mapping.edition_id == edition.id
    with pytest.raises(ValidationError, match="historically immutable"):
        create_control_mapping(
            actor=admin_user,
            edition_id=edition.id,
            clause_reference="POL-4.2",
            system_control_kind=SystemControlKind.CHECKLIST_DEFINITION,
            system_control_reference="CL-SYN",
        )
    create_control_mapping(
        actor=admin_user,
        edition_id=new_edition.id,
        clause_reference="POL-4.1",
        system_control_kind=SystemControlKind.DOCUMENT_VERSION,
        system_control_reference="DOC-SYN-001",
    )
    editions = list(list_source_editions(source=source))
    assert len(editions) == 2
    assert str(source)
    assert str(edition)
    assert str(mapping)
    assert str(ComplianceEvidenceLink(evidence_kind=SystemControlKind.OTHER, citation="x"))
    assert str(ComplianceGap(mapping=mapping, status=ComplianceGap.Status.OPEN))
    assert str(ComplianceGapAction(gap=ComplianceGap(mapping=mapping), action_kind="ACTION"))
    event = list_mapping_events(source=source).first()
    assert event is not None
    assert str(event)


@pytest.mark.django_db
def test_evidence_links_and_phase11_attachment() -> None:
    org = make_org(code="CM-E")
    admin_user = _cm_user(org=org, source=True, control=True, evidence=True)
    viewer = _cm_user(org=org, view=True, evidence=True)
    _source, edition = _register(admin_user, org, code="SYN-POL-E01")
    mapping = create_control_mapping(
        actor=admin_user,
        edition_id=edition.id,
        clause_reference="EV-1",
        system_control_kind=SystemControlKind.TRAINING_RECORD,
        system_control_reference="TRN-SYN",
    )
    for kind, citation in (
        (SystemControlKind.CHECKLIST_DEFINITION, "Checklist template SYN"),
        (SystemControlKind.HACCP_CONTROL, "HACCP plan shell citation"),
        (SystemControlKind.CALIBRATION, "Calibration record citation"),
        (SystemControlKind.LABORATORY, "Lab result citation"),
        (SystemControlKind.NCR, "NCR citation"),
        (SystemControlKind.CAPA, "CAPA citation"),
        (SystemControlKind.QUALITY_AUDIT, "QMS audit citation"),
        (SystemControlKind.DOCUMENT_VERSION, "Document version citation"),
        (SystemControlKind.SECURITY_CONTROL, "Security event catalogue citation"),
        (SystemControlKind.BACKUP_DR, "Restore-drill citation"),
    ):
        link_mapping_evidence(
            actor=admin_user,
            mapping_id=mapping.id,
            evidence_kind=kind,
            citation=citation,
        )
    assert mapping.evidence_links.count() == 10
    with pytest.raises(ValidationError, match="citation"):
        link_mapping_evidence(
            actor=admin_user,
            mapping_id=mapping.id,
            evidence_kind=SystemControlKind.OTHER,
        )
    target = resolve_linked_target(
        kind=EvidenceLinkedKind.COMPLIANCE_CONTROL_MAPPING, object_id=mapping.id
    )
    assert target.organization_id == org.id
    assert_can_upload_to_target(actor=admin_user, target=target)
    assert_can_view_target(actor=viewer, target=target)


@pytest.mark.django_db
def test_authorization_and_cross_org() -> None:
    org_a = make_org(code="CM-X")
    org_b = make_org(code="CM-Y")
    admin_a = _cm_user(org=org_a, source=True, control=True)
    viewer_a = _cm_user(org=org_a, view=True)
    outsider = _cm_user(org=org_b, view=True, source=True, control=True)
    source, edition = _register(admin_a, org_a, code="SYN-POL-X01")
    with pytest.raises(PermissionDenied):
        register_compliance_source(
            actor=viewer_a,
            organization_id=org_a.id,
            source_code="SYN-DENIED",
            title="Denied",
            kind=ComplianceSourceKind.COMPANY_POLICY,
            version_edition="v1",
        )
    with pytest.raises(PermissionDenied):
        get_source_for_org(actor=outsider, organization_id=org_a.id, source_id=source.id)
    with pytest.raises(PermissionDenied):
        create_control_mapping(
            actor=outsider,
            edition_id=edition.id,
            clause_reference="X",
            system_control_kind=SystemControlKind.OTHER,
            system_control_reference="x",
        )
    assert list_compliance_sources(actor=viewer_a, organization_id=org_a.id).count() == 1
    assert list_control_mappings(actor=viewer_a, organization_id=org_a.id).count() == 0
    with pytest.raises(ValidationError, match="already exists"):
        _register(admin_a, org_a, code="SYN-POL-X01")
    with pytest.raises(ValidationError, match="Unknown architectural source kind"):
        register_compliance_source(
            actor=admin_a,
            organization_id=org_a.id,
            source_code="SYN-BAD",
            title="Bad",
            kind="ISO_CERTIFIED",
            version_edition="v1",
        )


@pytest.mark.django_db
def test_gap_linkage_requires_explicit_action() -> None:
    org = make_org(code="CM-G")
    admin_user = _cm_user(
        org=org, source=True, control=True, gap=True, ncr=True, capa=True, change=True
    )
    _source, edition = _register(admin_user, org, code="SYN-POL-G01")
    mapping = create_control_mapping(
        actor=admin_user,
        edition_id=edition.id,
        clause_reference="GAP-1",
        system_control_kind=SystemControlKind.HACCP_CONTROL,
        system_control_reference="HACCP-SHELL",
    )
    set_mapping_status(
        actor=admin_user, mapping_id=mapping.id, status=ControlMappingStatus.APPLICABLE
    )
    gap = open_compliance_gap(
        actor=admin_user, mapping_id=mapping.id, description="Owner-noted mapping gap."
    )
    mapping.refresh_from_db()
    assert mapping.status == ControlMappingStatus.GAP_IDENTIFIED
    with pytest.raises(ValidationError, match="explicit_user_action"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=False,
            action_kind=GapActionKind.RISK,
            action_summary="Should fail",
            risk_reference="RSK-G-012",
        )
    risk_action = link_gap_action(
        actor=admin_user,
        gap_id=gap.id,
        explicit_user_action=True,
        action_kind=GapActionKind.RISK,
        action_summary="Cite existing governance risk.",
        risk_reference="RSK-G-012",
    )
    assert risk_action.risk_reference == "RSK-G-012"
    ncr_action = link_gap_action(
        actor=admin_user,
        gap_id=gap.id,
        explicit_user_action=True,
        action_kind=GapActionKind.NCR,
        action_summary="Open NCR from gap.",
        create_follow_up=True,
        ncr_code="SYN-NCR-CM",
    )
    assert ncr_action.nonconformance is not None
    capa_action = link_gap_action(
        actor=admin_user,
        gap_id=gap.id,
        explicit_user_action=True,
        action_kind=GapActionKind.CAPA,
        action_summary="Open CAPA from gap.",
        create_follow_up=True,
        capa_code="SYN-CAPA-CM",
    )
    assert capa_action.corrective_action is not None
    change_action = link_gap_action(
        actor=admin_user,
        gap_id=gap.id,
        explicit_user_action=True,
        action_kind=GapActionKind.CHANGE_REQUEST,
        action_summary="Open change from gap.",
        create_follow_up=True,
        change_code="SYN-CHG-CM",
    )
    assert change_action.change_request is not None
    generic = link_gap_action(
        actor=admin_user,
        gap_id=gap.id,
        explicit_user_action=True,
        action_kind=GapActionKind.ACTION,
        action_summary="Owner follow-up action.",
    )
    assert generic.nonconformance_id is None
    close_compliance_gap(actor=admin_user, gap_id=gap.id)
    with pytest.raises(ValidationError, match="Closed gaps"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.ACTION,
            action_summary="Too late",
        )
    assert list_open_gaps(actor=admin_user, organization_id=org.id).count() == 0
    statuses = {
        row["status"] for row in report_mapping_status(actor=admin_user, organization_id=org.id)
    }
    assert ControlMappingStatus.GAP_IDENTIFIED in statuses


@pytest.mark.django_db
def test_status_validation_and_admin_retention() -> None:
    org = make_org(code="CM-S")
    admin_user = _cm_user(org=org, source=True, control=True)
    verifier = _cm_user(org=org, verify=True)
    _source, edition = _register(admin_user, org, code="SYN-POL-S01")
    mapping = create_control_mapping(
        actor=admin_user,
        edition_id=edition.id,
        clause_reference="ST-1",
        system_control_kind=SystemControlKind.SECURITY_CONTROL,
        system_control_reference="SEC-AUDIT",
    )
    with pytest.raises(ValidationError, match="Cannot transition"):
        set_mapping_status(
            actor=admin_user, mapping_id=mapping.id, status=ControlMappingStatus.IMPLEMENTED
        )
    with pytest.raises(ValidationError, match="Cannot transition"):
        verify_control_mapping(actor=verifier, mapping_id=mapping.id)
    set_mapping_status(
        actor=admin_user,
        mapping_id=mapping.id,
        status=ControlMappingStatus.NOT_APPLICABLE,
    )
    with pytest.raises(ValidationError, match="Cannot transition"):
        set_mapping_status(
            actor=admin_user, mapping_id=mapping.id, status=ControlMappingStatus.IMPLEMENTED
        )
    set_mapping_status(
        actor=admin_user,
        mapping_id=mapping.id,
        status=ControlMappingStatus.APPLICABILITY_PENDING,
    )
    set_source_applicability(
        actor=admin_user,
        edition_id=edition.id,
        applicability_status=ApplicabilityStatus.NOT_APPLICABLE,
    )
    with pytest.raises(ValidationError, match="Unknown applicability"):
        set_source_applicability(
            actor=admin_user, edition_id=edition.id, applicability_status="CERTIFIED"
        )
    request = RequestFactory().get("/")
    request.user = admin_user
    event_admin = ComplianceMappingEventAdmin(ComplianceMappingEvent, AdminSite())
    assert event_admin.has_add_permission(request) is False
    assert event_admin.has_change_permission(request) is False
    assert event_admin.has_delete_permission(request) is False
    retention = SoftRetentionAdmin(ComplianceSource, AdminSite())
    assert retention.has_delete_permission(request) is False
    assert SecurityAuditEvent.objects.filter(event_type="COMPLIANCE_SOURCE_REGISTERED").exists()
    ComplianceControlMapping(
        organization=org,
        edition=edition,
        clause_reference="clean",
        system_control_kind=SystemControlKind.OTHER,
        system_control_reference="ref",
        status=ControlMappingStatus.NOT_ASSESSED,
        created_by=admin_user,
    ).clean()
    with pytest.raises(ValidationError):
        ComplianceSource(
            organization=org, source_code=" ", title="x", kind="NOPE", created_by=admin_user
        ).clean()


@pytest.mark.django_db
def test_withdraw_evidence_resolve_and_gap_guardrails() -> None:
    from apps.compliance_mapping.selectors import list_mapping_gaps
    from apps.compliance_mapping.services import (
        add_source_edition,
        update_edition_applicability,
        withdraw_source_edition,
    )

    org = make_org(code="CM-W")
    org_b = make_org(code="CM-Z")
    admin_user = _cm_user(
        org=org, source=True, control=True, gap=True, ncr=True, capa=True, change=True
    )
    stranger = _cm_user(org=org_b, view=True)
    source, edition = _register(admin_user, org, code="SYN-POL-W01")
    with pytest.raises(ValidationError, match="Unknown applicability"):
        register_compliance_source(
            actor=admin_user,
            organization_id=org.id,
            source_code="SYN-POL-W02",
            title="Bad applicability",
            kind=ComplianceSourceKind.LEGAL_REGULATORY,
            version_edition="v1",
            applicability_status="CERTIFIED",
        )
    extra = add_source_edition(
        actor=admin_user,
        source_id=source.id,
        version_edition="v1-alt",
        official_source_citation="Owner-cited alternate edition.",
    )
    with pytest.raises(ValidationError, match="Unknown applicability"):
        add_source_edition(
            actor=admin_user,
            source_id=source.id,
            version_edition="v9",
            applicability_status="CERTIFIED",
        )
    update_edition_applicability(
        actor=admin_user,
        edition_id=extra.id,
        applicability_status=ApplicabilityStatus.APPLICABILITY_PENDING,
        evidence_reference="APR-071",
        last_reviewed_on=None,
    )
    with pytest.raises(ValidationError, match="Unknown applicability"):
        update_edition_applicability(
            actor=admin_user, edition_id=extra.id, applicability_status="CERTIFIED"
        )
    mapping = create_control_mapping(
        actor=admin_user,
        edition_id=edition.id,
        clause_reference="W-1",
        system_control_kind=SystemControlKind.BACKUP_DR,
        system_control_reference="RESTORE-DRILL",
    )
    with pytest.raises(ValidationError, match="not COMPLIANT"):
        create_control_mapping(
            actor=admin_user,
            edition_id=edition.id,
            clause_reference="W-BAD",
            system_control_kind=SystemControlKind.OTHER,
            system_control_reference="x",
            status="COMPLIANT",
        )
    with pytest.raises(ValidationError, match="Unknown mapping status"):
        create_control_mapping(
            actor=admin_user,
            edition_id=edition.id,
            clause_reference="W-BAD0",
            system_control_kind=SystemControlKind.OTHER,
            system_control_reference="x",
            status="BOGUS",
        )
    with pytest.raises(ValidationError, match="Unknown system control"):
        create_control_mapping(
            actor=admin_user,
            edition_id=edition.id,
            clause_reference="W-BAD2",
            system_control_kind="ISO_CERT",
            system_control_reference="x",
        )
    link_mapping_evidence(
        actor=admin_user,
        mapping_id=mapping.id,
        evidence_kind=SystemControlKind.SECURITY_CONTROL,
        citation="Security catalogue",
        linked_object_id=uuid.uuid4(),
    )
    with pytest.raises(ValidationError, match="not found in this organization"):
        link_mapping_evidence(
            actor=admin_user,
            mapping_id=mapping.id,
            evidence_kind=SystemControlKind.NCR,
            citation="missing",
            linked_object_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="Unknown evidence kind"):
        link_mapping_evidence(
            actor=admin_user,
            mapping_id=mapping.id,
            evidence_kind="FAKE",
            citation="x",
        )
    set_mapping_status(
        actor=admin_user, mapping_id=mapping.id, status=ControlMappingStatus.APPLICABLE
    )
    gap = open_compliance_gap(actor=admin_user, mapping_id=mapping.id, description="First gap")
    open_compliance_gap(actor=admin_user, mapping_id=mapping.id, description="Second gap")
    assert list_mapping_gaps(mapping=mapping).count() == 2
    with pytest.raises(ValidationError, match="Unknown gap action"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind="CERTIFICATE",
            action_summary="nope",
        )
    with pytest.raises(ValidationError, match="Action summary"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.ACTION,
            action_summary=" ",
        )
    with pytest.raises(ValidationError, match="risk identifier"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.RISK,
            action_summary="missing risk",
        )
    with pytest.raises(ValidationError, match="Owner-supplied NCR"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.NCR,
            action_summary="ncr",
            create_linked_record=True,
        )
    with pytest.raises(ValidationError, match="existing_ncr_id"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.NCR,
            action_summary="ncr",
        )
    with pytest.raises(ValidationError, match="not found in organization"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.NCR,
            action_summary="ncr",
            existing_ncr_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="Owner-supplied CAPA"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.CAPA,
            action_summary="capa",
            create_follow_up=True,
        )
    with pytest.raises(ValidationError, match="existing_capa_id"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.CAPA,
            action_summary="capa",
        )
    with pytest.raises(ValidationError, match="not found in organization"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.CAPA,
            action_summary="capa",
            existing_capa_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="change request code"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.CHANGE_REQUEST,
            action_summary="chg",
            create_linked_record=True,
        )
    with pytest.raises(ValidationError, match="existing_change_id"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.CHANGE_REQUEST,
            action_summary="chg",
        )
    with pytest.raises(ValidationError, match="not found in organization"):
        link_gap_action(
            actor=admin_user,
            gap_id=gap.id,
            explicit_user_action=True,
            action_kind=GapActionKind.CHANGE_REQUEST,
            action_summary="chg",
            existing_change_id=uuid.uuid4(),
        )
    with pytest.raises(PermissionDenied):
        list_compliance_sources(actor=stranger, organization_id=org.id)
    with pytest.raises(PermissionDenied):
        get_source_for_org(actor=stranger, organization_id=org.id, source_id=source.id)
    with pytest.raises(PermissionDenied):
        list_control_mappings(actor=stranger, organization_id=org.id)
    with pytest.raises(PermissionDenied):
        list_open_gaps(actor=stranger, organization_id=org.id)
    with pytest.raises(PermissionDenied):
        report_mapping_status(actor=stranger, organization_id=org.id)
    list_control_mappings(
        actor=admin_user, organization_id=org.id, status=ControlMappingStatus.GAP_IDENTIFIED
    )
    withdrawn = withdraw_source_edition(actor=admin_user, edition_id=extra.id)
    assert withdrawn.register_status == SourceRegisterStatus.WITHDRAWN
    with pytest.raises(ValidationError, match="historically immutable"):
        withdraw_source_edition(actor=admin_user, edition_id=extra.id)
    close_compliance_gap(actor=admin_user, gap_id=gap.id)
    close_compliance_gap(actor=admin_user, gap_id=gap.id)
