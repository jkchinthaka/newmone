"""Phase 45 — QMS quality audit management tests."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import connection
from django.test import RequestFactory
from django.test.utils import CaptureQueriesContext
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.checklists.models import (
    ChecklistResponseType,
    ChecklistTemplate,
    ChecklistVersion,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.evidence.linking import (
    assert_can_upload_to_target,
    assert_can_view_target,
    resolve_linked_target,
)
from apps.evidence.models import EvidenceAttachment, EvidenceLinkedKind
from apps.nonconformance.models import NonConformanceRecord
from apps.organizations.models import Organization
from apps.quality_audits.admin import QualityAuditEventAdmin, SoftRetentionAdmin
from apps.quality_audits.models import (
    QualityAudit,
    QualityAuditEvent,
    QualityAuditFinding,
    QualityAuditFindingCodeConfig,
    QualityAuditFindingStatus,
    QualityAuditStatus,
    QualityAuditType,
)
from apps.quality_audits.selectors import (
    get_quality_audit_for_org,
    list_audit_events,
    list_findings_for_audit,
    list_quality_audits,
    report_audit_status,
    report_capa_links,
    report_open_findings,
    report_overdue_findings,
    report_site_process_trends,
)
from apps.quality_audits.services import (
    add_audit_participant,
    bind_audit_checklist,
    cancel_quality_audit,
    close_audit_finding,
    close_quality_audit,
    complete_finding_action,
    create_audit_finding,
    create_quality_audit,
    link_finding_quality_case,
    register_audit_checklist_template,
    reopen_finding_action,
    start_quality_audit,
    upsert_finding_code,
    verify_audit_finding,
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


def _audit_user(
    *,
    org: Organization,
    view: bool = True,
    plan: bool = False,
    execute: bool = False,
    close: bool = False,
    link: bool = False,
    config: bool = False,
    checklist: bool = False,
    ncr: bool = False,
    capa: bool = False,
    evidence: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"QA{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"QA{suffix}",
        name=f"QMS audit {suffix}",
        permission=_perm(QualityAudit, "view_qualityaudit"),
    )
    if not view:
        role.permissions.remove(_perm(QualityAudit, "view_qualityaudit"))
    if plan:
        role.permissions.add(_perm(QualityAudit, "plan_qualityaudit"))
    if execute:
        role.permissions.add(_perm(QualityAudit, "execute_qualityaudit"))
    if close:
        role.permissions.add(_perm(QualityAudit, "close_qualityaudit"))
    if link:
        role.permissions.add(_perm(QualityAudit, "link_audit_quality_case"))
    if config:
        role.permissions.add(_perm(QualityAudit, "manage_auditfindingconfig"))
    if checklist:
        role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    if ncr:
        role.permissions.add(_perm(NonConformanceRecord, "create_nonconformance"))
    if capa:
        role.permissions.add(_perm(CorrectiveAction, "create_capa"))
    if evidence:
        role.permissions.add(_perm(EvidenceAttachment, "view_evidenceattachment"))
        role.permissions.add(_perm(EvidenceAttachment, "upload_evidenceattachment"))
    grant_role(user, role, organization=org)
    return user


def _published_audit_checklist(
    actor: User, org: Organization
) -> tuple[ChecklistTemplate, ChecklistVersion]:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"AUD-{uuid.uuid4().hex[:6].upper()}",
        name="Synthetic QMS audit checklist",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Audit")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="AUD-1",
        label="Synthetic audit question",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    return template, publish_checklist_version(actor=actor, version_id=version.id)


@pytest.mark.django_db
def test_audit_lifecycle_and_findings() -> None:
    org = make_org(code="AU-L")
    planner = _audit_user(org=org, plan=True, checklist=True)
    executor = _audit_user(org=org, execute=True)
    closer = _audit_user(org=org, close=True)
    participant = _audit_user(org=org, view=True)
    audit = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-001",
        title="Synthetic internal audit",
        scope_summary="Packaging process scope (synthetic).",
        audit_type=QualityAuditType.INTERNAL,
        site_reference="SITE-SYN",
        department_reference="DEPT-SYN",
        process_reference="PROC-SYN",
        planned_date=date.today() + timedelta(days=7),
    )
    assert audit.status == QualityAuditStatus.PLANNED
    assert str(audit)
    add_audit_participant(
        actor=planner, audit_id=audit.id, user=participant, role_reference="observer"
    )
    add_audit_participant(actor=planner, audit_id=audit.id, user=participant)
    template, version = _published_audit_checklist(planner, org)
    with pytest.raises(ValidationError, match="registered as quality-audit"):
        bind_audit_checklist(
            actor=planner,
            audit_id=audit.id,
            checklist_template_id=template.id,
            checklist_version_id=version.id,
        )
    register_audit_checklist_template(
        actor=planner, organization_id=org.id, checklist_template_id=template.id
    )
    bind_audit_checklist(
        actor=planner,
        audit_id=audit.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
    )
    with pytest.raises(ValidationError, match="during execution"):
        create_audit_finding(actor=executor, audit_id=audit.id, description="Too early")
    start_quality_audit(actor=executor, audit_id=audit.id)
    finding = create_audit_finding(
        actor=executor,
        audit_id=audit.id,
        description="Synthetic finding description",
        reference="CL-1",
        due_date=date.today() + timedelta(days=14),
        owner=participant,
    )
    audit.refresh_from_db()
    assert audit.status == QualityAuditStatus.FINDINGS
    assert finding.status == QualityAuditFindingStatus.OPEN
    complete_finding_action(actor=executor, finding_id=finding.id)
    reopen_finding_action(actor=executor, finding_id=finding.id)
    complete_finding_action(actor=executor, finding_id=finding.id)
    verify_audit_finding(actor=closer, finding_id=finding.id)
    close_audit_finding(actor=closer, finding_id=finding.id)
    closed = close_quality_audit(actor=closer, audit_id=audit.id)
    assert closed.status == QualityAuditStatus.CLOSED
    with pytest.raises(ValidationError, match="historically immutable"):
        create_audit_finding(actor=executor, audit_id=audit.id, description="After close")
    assert list_findings_for_audit(audit=closed).count() == 1
    assert list_audit_events(audit=closed).filter(event_type="QUALITY_AUDIT_CLOSED").exists()


@pytest.mark.django_db
def test_capa_link_requires_explicit_action() -> None:
    org = make_org(code="AU-C")
    planner = _audit_user(org=org, plan=True)
    executor = _audit_user(org=org, execute=True)
    linker = _audit_user(org=org, link=True, ncr=True, capa=True)
    audit = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-010",
        title="CAPA link audit",
        scope_summary="Scope",
        audit_type=QualityAuditType.PROCESS,
    )
    start_quality_audit(actor=executor, audit_id=audit.id)
    finding = create_audit_finding(actor=executor, audit_id=audit.id, description="Finding")
    assert finding.corrective_action_id is None
    with pytest.raises(ValidationError, match="explicit_user_action"):
        link_finding_quality_case(
            actor=linker,
            finding_id=finding.id,
            explicit_user_action=False,
            create_quality_case=True,
            link_kind="CAPA",
            capa_code="SYN-CAPA-001",
        )
    with pytest.raises(ValidationError, match="Owner-supplied CAPA code"):
        link_finding_quality_case(
            actor=linker,
            finding_id=finding.id,
            explicit_user_action=True,
            create_quality_case=True,
            link_kind="CAPA",
        )
    link_finding_quality_case(
        actor=linker,
        finding_id=finding.id,
        explicit_user_action=True,
        create_quality_case=True,
        link_kind="NCR",
        ncr_code="SYN-NCR-001",
    )
    linked = link_finding_quality_case(
        actor=linker,
        finding_id=finding.id,
        explicit_user_action=True,
        create_quality_case=True,
        link_kind="CAPA",
        capa_code="SYN-CAPA-001",
    )
    assert linked.nonconformance_id is not None
    assert linked.corrective_action_id is not None
    assert report_capa_links(actor=planner, organization_id=org.id).filter(pk=finding.id).exists()


@pytest.mark.django_db
def test_authorization_separate_from_operational_qa() -> None:
    org = make_org(code="AU-P")
    planner = _audit_user(org=org, plan=True)
    viewer = _audit_user(org=org, view=True)
    stranger = _audit_user(org=org, view=False)
    audit = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-020",
        title="Auth audit",
        scope_summary="Scope",
        audit_type=QualityAuditType.SYSTEM,
    )
    with pytest.raises(PermissionDenied):
        list_quality_audits(actor=stranger, organization_id=org.id)
    assert list_quality_audits(actor=viewer, organization_id=org.id).filter(pk=audit.id).exists()
    with pytest.raises(PermissionDenied):
        start_quality_audit(actor=viewer, audit_id=audit.id)
    with pytest.raises(PermissionDenied):
        create_audit_finding(actor=viewer, audit_id=audit.id, description="No execute grant")


@pytest.mark.django_db
def test_cross_org_isolation() -> None:
    org_a = make_org(code="AU-A")
    org_b = make_org(code="AU-B")
    planner_a = _audit_user(org=org_a, plan=True)
    viewer_b = _audit_user(org=org_b, view=True)
    executor_b = _audit_user(org=org_b, execute=True)
    audit = create_quality_audit(
        actor=planner_a,
        organization_id=org_a.id,
        audit_code="SYN-AUD-030",
        title="Org A audit",
        scope_summary="Scope",
        audit_type=QualityAuditType.EXTERNAL,
    )
    with pytest.raises(PermissionDenied):
        list_quality_audits(actor=viewer_b, organization_id=org_a.id)
    with pytest.raises(PermissionDenied):
        start_quality_audit(actor=executor_b, audit_id=audit.id)
    with pytest.raises(QualityAudit.DoesNotExist):
        get_quality_audit_for_org(actor=viewer_b, organization_id=org_b.id, audit_id=audit.id)


@pytest.mark.django_db
def test_evidence_and_finding_codes() -> None:
    org = make_org(code="AU-E")
    planner = _audit_user(org=org, plan=True, config=True)
    executor = _audit_user(org=org, execute=True, evidence=True)
    viewer = _audit_user(org=org, view=True, evidence=True)
    upsert_finding_code(
        actor=planner,
        organization_id=org.id,
        kind=QualityAuditFindingCodeConfig.Kind.SEVERITY,
        code="SYN-SEV-1",
        label="Synthetic severity shell",
    )
    upsert_finding_code(
        actor=planner,
        organization_id=org.id,
        kind=QualityAuditFindingCodeConfig.Kind.CLASSIFICATION,
        code="SYN-CLS-1",
        label="Synthetic classification shell",
    )
    audit = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-040",
        title="Evidence audit",
        scope_summary="Scope",
        audit_type=QualityAuditType.INTERNAL,
    )
    start_quality_audit(actor=executor, audit_id=audit.id)
    with pytest.raises(ValidationError, match="owner-configured"):
        create_audit_finding(
            actor=executor,
            audit_id=audit.id,
            description="Invented severity",
            severity_code="CRITICAL",
        )
    finding = create_audit_finding(
        actor=executor,
        audit_id=audit.id,
        description="Coded finding",
        severity_code="SYN-SEV-1",
        classification_code="SYN-CLS-1",
    )
    target = resolve_linked_target(
        kind=EvidenceLinkedKind.QUALITY_AUDIT_FINDING, object_id=finding.id
    )
    assert target.organization_id == org.id
    assert_can_upload_to_target(actor=executor, target=target)
    assert_can_view_target(actor=viewer, target=target)


@pytest.mark.django_db
def test_closure_reports_and_query_performance() -> None:
    org = make_org(code="AU-R")
    planner = _audit_user(org=org, plan=True)
    executor = _audit_user(org=org, execute=True)
    closer = _audit_user(org=org, close=True)
    audit = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-050",
        title="Report audit",
        scope_summary="Scope",
        audit_type=QualityAuditType.SUPPLIER,
        site_reference="SITE-R",
        process_reference="PROC-R",
    )
    start_quality_audit(actor=executor, audit_id=audit.id)
    open_finding = create_audit_finding(
        actor=executor,
        audit_id=audit.id,
        description="Open",
        due_date=date.today() + timedelta(days=3),
    )
    overdue = create_audit_finding(
        actor=executor,
        audit_id=audit.id,
        description="Overdue",
        due_date=date.today() - timedelta(days=2),
    )
    complete_finding_action(actor=executor, finding_id=open_finding.id)
    assert report_open_findings(actor=planner, organization_id=org.id).count() == 2
    assert (
        report_overdue_findings(actor=planner, organization_id=org.id)
        .filter(pk=overdue.id)
        .exists()
    )
    statuses = {row["status"] for row in report_audit_status(actor=planner, organization_id=org.id)}
    assert QualityAuditStatus.FINDINGS in statuses
    trends = report_site_process_trends(actor=planner, organization_id=org.id)
    assert any(row["site_reference"] == "SITE-R" for row in trends)
    with CaptureQueriesContext(connection) as ctx:
        list(report_open_findings(actor=planner, organization_id=org.id))
        list(report_overdue_findings(actor=planner, organization_id=org.id))
        report_audit_status(actor=planner, organization_id=org.id)
        report_site_process_trends(actor=planner, organization_id=org.id)
    assert len(ctx.captured_queries) <= 20
    cancel_target = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-051",
        title="Cancel me",
        scope_summary="Scope",
        audit_type=QualityAuditType.INTERNAL,
    )
    cancelled = cancel_quality_audit(actor=closer, audit_id=cancel_target.id)
    assert cancelled.status == QualityAuditStatus.CANCELLED
    assert SecurityAuditEvent.objects.filter(event_type="QUALITY_AUDIT_PLANNED").exists()


@pytest.mark.django_db
def test_validation_and_admin_retention() -> None:
    org = make_org(code="AU-G")
    planner = _audit_user(org=org, plan=True)
    with pytest.raises(ValidationError, match="Unknown architectural audit type"):
        create_quality_audit(
            actor=planner,
            organization_id=org.id,
            audit_code="SYN-AUD-060",
            title="Bad",
            scope_summary="Scope",
            audit_type="SECRET_NELNA_TYPE",
        )
    with pytest.raises(ValidationError, match="Title is required"):
        create_quality_audit(
            actor=planner,
            organization_id=org.id,
            audit_code="SYN-AUD-060",
            title=" ",
            scope_summary="Scope",
            audit_type=QualityAuditType.INTERNAL,
        )
    audit = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-060",
        title="Guard",
        scope_summary="Scope",
        audit_type=QualityAuditType.INTERNAL,
    )
    with pytest.raises(ValidationError, match="already exists"):
        create_quality_audit(
            actor=planner,
            organization_id=org.id,
            audit_code="syn-aud-060",
            title="Dup",
            scope_summary="Scope",
            audit_type=QualityAuditType.INTERNAL,
        )
    request = RequestFactory().get("/")
    request.user = planner
    admin = SoftRetentionAdmin(QualityAudit, AdminSite())
    assert admin.has_delete_permission(request) is False
    event_admin = QualityAuditEventAdmin(QualityAuditEvent, AdminSite())
    assert event_admin.has_add_permission(request) is False
    assert event_admin.has_change_permission(request) is False
    assert event_admin.has_delete_permission(request) is False
    event = QualityAuditEvent.objects.filter(audit=audit).first()
    assert event is not None
    assert str(event)
    assert str(
        QualityAuditFinding(audit=audit, status=QualityAuditFindingStatus.OPEN, description="x")
    )
    assert str(QualityAuditFindingCodeConfig(kind="SEVERITY", code="X"))
    from apps.quality_audits.historical_safety import audit_is_historically_locked

    assert audit_is_historically_locked(QualityAuditStatus.CLOSED) is True
    assert audit_is_historically_locked(QualityAuditStatus.PLANNED) is False


@pytest.mark.django_db
def test_operational_qa_cannot_execute_quality_audit() -> None:
    from apps.quality.models import QAReview

    org = make_org(code="AU-Q")
    planner = _audit_user(org=org, plan=True)
    ops_qa = make_user(employee_code=f"OPS{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    role = make_role_with_permission(
        code=f"OPS{uuid.uuid4().hex[:6].upper()}",
        name="Operational QA only",
        permission=_perm(QAReview, "qa_review_checklistsubmission"),
    )
    grant_role(ops_qa, role, organization=org)
    audit = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-070",
        title="Ops QA must not execute",
        scope_summary="Scope",
        audit_type=QualityAuditType.INTERNAL,
    )
    with pytest.raises(PermissionDenied):
        start_quality_audit(actor=ops_qa, audit_id=audit.id)
    with pytest.raises(PermissionDenied):
        close_quality_audit(actor=ops_qa, audit_id=audit.id)


@pytest.mark.django_db
def test_existing_case_link_and_guardrails() -> None:
    org = make_org(code="AU-X")
    planner = _audit_user(org=org, plan=True, checklist=True, config=True)
    executor = _audit_user(org=org, execute=True)
    linker = _audit_user(org=org, link=True, ncr=True, capa=True)
    closer = _audit_user(org=org, close=True)
    audit = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-080",
        title="Existing case link",
        scope_summary="Scope",
        audit_type=QualityAuditType.INTERNAL,
    )
    start_quality_audit(actor=executor, audit_id=audit.id)
    finding = create_audit_finding(actor=executor, audit_id=audit.id, description="Link existing")
    with pytest.raises(ValidationError, match="NCR or CAPA"):
        link_finding_quality_case(
            actor=linker,
            finding_id=finding.id,
            explicit_user_action=True,
            create_quality_case=False,
            link_kind="HOLD",
        )
    with pytest.raises(ValidationError, match="existing_ncr_id"):
        link_finding_quality_case(
            actor=linker,
            finding_id=finding.id,
            explicit_user_action=True,
            create_quality_case=False,
            link_kind="NCR",
        )
    with pytest.raises(ValidationError, match="not found in organization"):
        link_finding_quality_case(
            actor=linker,
            finding_id=finding.id,
            explicit_user_action=True,
            create_quality_case=False,
            link_kind="NCR",
            existing_ncr_id=uuid.uuid4(),
        )
    first = link_finding_quality_case(
        actor=linker,
        finding_id=finding.id,
        explicit_user_action=True,
        create_quality_case=True,
        link_kind="NCR",
        ncr_code="SYN-NCR-080",
    )
    other = create_audit_finding(actor=executor, audit_id=audit.id, description="Second")
    link_finding_quality_case(
        actor=linker,
        finding_id=other.id,
        explicit_user_action=True,
        create_quality_case=False,
        link_kind="NCR",
        existing_ncr_id=first.nonconformance_id,
    )
    capa_linked = link_finding_quality_case(
        actor=linker,
        finding_id=other.id,
        explicit_user_action=True,
        create_quality_case=True,
        link_kind="CAPA",
        capa_code="SYN-CAPA-080",
    )
    third = create_audit_finding(actor=executor, audit_id=audit.id, description="Third")
    link_finding_quality_case(
        actor=linker,
        finding_id=third.id,
        explicit_user_action=True,
        create_quality_case=False,
        link_kind="CAPA",
        existing_capa_id=capa_linked.corrective_action_id,
    )
    with pytest.raises(ValidationError, match="not found in organization"):
        link_finding_quality_case(
            actor=linker,
            finding_id=third.id,
            explicit_user_action=True,
            create_quality_case=False,
            link_kind="CAPA",
            existing_capa_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError, match="existing_capa_id"):
        link_finding_quality_case(
            actor=linker,
            finding_id=third.id,
            explicit_user_action=True,
            create_quality_case=False,
            link_kind="CAPA",
        )
    planned_only = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-082",
        title="Cannot close from planned",
        scope_summary="Scope",
        audit_type=QualityAuditType.INTERNAL,
    )
    with pytest.raises(ValidationError, match="Cannot transition"):
        close_quality_audit(actor=closer, audit_id=planned_only.id)
    template, version = _published_audit_checklist(planner, org)
    first_bind = register_audit_checklist_template(
        actor=planner, organization_id=org.id, checklist_template_id=template.id
    )
    again = register_audit_checklist_template(
        actor=planner, organization_id=org.id, checklist_template_id=template.id
    )
    assert first_bind.id == again.id
    other_template, other_version = _published_audit_checklist(planner, org)
    register_audit_checklist_template(
        actor=planner, organization_id=org.id, checklist_template_id=other_template.id
    )
    with pytest.raises(ValidationError, match="does not belong"):
        bind_audit_checklist(
            actor=planner,
            audit_id=audit.id,
            checklist_template_id=other_template.id,
            checklist_version_id=version.id,
        )
    with pytest.raises(ValidationError, match="Kind must be"):
        upsert_finding_code(
            actor=planner,
            organization_id=org.id,
            kind="MADE_UP",
            code="X",
            label="X",
        )
    with pytest.raises(ValidationError, match="Code is required"):
        upsert_finding_code(
            actor=planner,
            organization_id=org.id,
            kind=QualityAuditFindingCodeConfig.Kind.SEVERITY,
            code=" ",
            label="X",
        )
    upsert_finding_code(
        actor=planner,
        organization_id=org.id,
        kind=QualityAuditFindingCodeConfig.Kind.SEVERITY,
        code="SYN-SEV-2",
        label="Shell",
    )
    upsert_finding_code(
        actor=planner,
        organization_id=org.id,
        kind=QualityAuditFindingCodeConfig.Kind.SEVERITY,
        code="SYN-SEV-2",
        label="Updated",
        is_active=False,
    )
    list_quality_audits(actor=planner, organization_id=org.id, status=QualityAuditStatus.FINDINGS)
    get_quality_audit_for_org(actor=planner, organization_id=org.id, audit_id=audit.id)
    started = create_quality_audit(
        actor=planner,
        organization_id=org.id,
        audit_code="SYN-AUD-081",
        title="Cancel in progress",
        scope_summary="Scope",
        audit_type=QualityAuditType.EXTERNAL,
    )
    start_quality_audit(actor=executor, audit_id=started.id)
    cancel_quality_audit(actor=closer, audit_id=started.id)
    with pytest.raises(ValidationError, match="Finding description"):
        create_audit_finding(actor=executor, audit_id=audit.id, description=" ")
    with pytest.raises(ValidationError, match="owner-configured"):
        create_audit_finding(
            actor=executor,
            audit_id=audit.id,
            description="Invented class",
            classification_code="MAJOR",
        )
