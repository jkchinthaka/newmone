"""Phase 44 — quality change control tests."""

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
from apps.change_control.admin import QualityChangeEventAdmin, SoftRetentionAdmin
from apps.change_control.historical_safety import change_is_historically_locked
from apps.change_control.models import (
    ChangeAffectedKind,
    ChangeImplementationKind,
    ChangeRequestStatus,
    QualityChangeEvent,
    QualityChangeRequest,
)
from apps.change_control.selectors import (
    get_quality_change_for_org,
    list_affected_links,
    list_change_events,
    list_implementation_links,
    list_quality_changes,
)
from apps.change_control.services import (
    add_affected_link,
    approve_quality_change,
    create_quality_change,
    record_change_impact_assessment,
    record_implementation_link,
    start_change_assessment,
    start_change_implementation,
    submit_change_for_verification,
    verify_and_close_quality_change,
)
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


def _cc_user(
    *,
    org: Organization,
    view: bool = True,
    create: bool = False,
    assess: bool = False,
    approve: bool = False,
    implement: bool = False,
    verify: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"CC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CC{suffix}",
        name=f"Change control {suffix}",
        permission=_perm(QualityChangeRequest, "view_qualitychange"),
    )
    if not view:
        role.permissions.remove(_perm(QualityChangeRequest, "view_qualitychange"))
    if create:
        role.permissions.add(_perm(QualityChangeRequest, "create_qualitychange"))
    if assess:
        role.permissions.add(_perm(QualityChangeRequest, "assess_qualitychange"))
    if approve:
        role.permissions.add(_perm(QualityChangeRequest, "approve_qualitychange"))
    if implement:
        role.permissions.add(_perm(QualityChangeRequest, "implement_qualitychange"))
    if verify:
        role.permissions.add(_perm(QualityChangeRequest, "verify_qualitychange"))
    grant_role(user, role, organization=org)
    return user


def _impact(actor: User, change: QualityChangeRequest) -> None:
    record_change_impact_assessment(
        actor=actor,
        change_id=change.id,
        quality_impact="Synthetic quality note",
        food_safety_impact="Synthetic food-safety note",
        technical_impact="Synthetic technical note",
        training_impact="Synthetic training note",
        validation_requirement="Synthetic validation note",
        data_migration_impact="Synthetic data-migration note",
        risk_impact_assessment="Synthetic residual risk note",
    )


def _to_verification(
    *,
    requester: User,
    assessor: User,
    approver: User,
    implementer: User,
    change: QualityChangeRequest,
) -> QualityChangeRequest:
    start_change_assessment(actor=assessor, change_id=change.id)
    _impact(assessor, change)
    approve_quality_change(actor=approver, change_id=change.id, approval_reference="APR-SYNTH-CC")
    start_change_implementation(actor=implementer, change_id=change.id)
    record_implementation_link(
        actor=implementer,
        change_id=change.id,
        implemented_kind=ChangeImplementationKind.DOCUMENT_VERSION,
        implemented_reference="SYN-DOC-REV-02",
        implemented_object_id=uuid.uuid4(),
    )
    return submit_change_for_verification(actor=implementer, change_id=change.id)


@pytest.mark.django_db
def test_affected_record_links() -> None:
    org = make_org(code="CC-L")
    requester = _cc_user(org=org, create=True)
    change = create_quality_change(
        actor=requester,
        organization_id=org.id,
        change_code="SYN-CC-001",
        title="Synthetic checklist revision",
        description="Describe the proposed change.",
        reason="Reason recorded for audit.",
    )
    product_id = uuid.uuid4()
    link = add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.PRODUCT,
        linked_object_id=product_id,
    )
    again = add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.PRODUCT,
        linked_object_id=product_id,
    )
    assert again.id == link.id
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.PROCESS,
        linked_reference="SYN-PROCESS-A",
    )
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.ERP_MAPPING,
        linked_reference="SYN-ERP-MAP-1",
    )
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.SITE_LINE,
        linked_reference="SYN-LINE-REF",
    )
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.CHECKLIST,
        linked_reference="SYN-CL-REF",
    )
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.HACCP_PLAN,
        linked_reference="SYN-HACCP-REF",
    )
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.EQUIPMENT,
        linked_reference="SYN-EQ-REF",
    )
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.TRAINING,
        linked_reference="SYN-TRN-REF",
    )
    kinds = set(list_affected_links(change=change).values_list("linked_kind", flat=True))
    assert kinds == {
        ChangeAffectedKind.PRODUCT,
        ChangeAffectedKind.PROCESS,
        ChangeAffectedKind.ERP_MAPPING,
        ChangeAffectedKind.SITE_LINE,
        ChangeAffectedKind.CHECKLIST,
        ChangeAffectedKind.HACCP_PLAN,
        ChangeAffectedKind.EQUIPMENT,
        ChangeAffectedKind.TRAINING,
    }
    with pytest.raises(ValidationError, match="Unknown affected-area kind"):
        add_affected_link(
            actor=requester,
            change_id=change.id,
            linked_kind="NELNA_SECRET_AREA",
            linked_reference="x",
        )
    with pytest.raises(ValidationError, match="linked object id or an opaque reference"):
        add_affected_link(
            actor=requester,
            change_id=change.id,
            linked_kind=ChangeAffectedKind.DOCUMENT,
        )


@pytest.mark.django_db
def test_approval_verification_and_closure() -> None:
    org = make_org(code="CC-A")
    requester = _cc_user(org=org, create=True)
    assessor = _cc_user(org=org, assess=True)
    approver = _cc_user(org=org, approve=True)
    implementer = _cc_user(org=org, implement=True)
    verifier = _cc_user(org=org, verify=True)
    change = create_quality_change(
        actor=requester,
        organization_id=org.id,
        change_code="SYN-CC-010",
        title="Synthetic HACCP binding update",
        description="Description",
        reason="Reason",
    )
    assert str(change)
    with pytest.raises(ValidationError, match="Cannot transition"):
        approve_quality_change(actor=approver, change_id=change.id, approval_reference="TOO-EARLY")
    start_change_assessment(actor=assessor, change_id=change.id)
    with pytest.raises(ValidationError, match="Impact assessment is required"):
        approve_quality_change(actor=approver, change_id=change.id, approval_reference="APR-X")
    _impact(assessor, change)
    with pytest.raises(PermissionDenied):
        approve_quality_change(actor=requester, change_id=change.id, approval_reference="SELF")
    with pytest.raises(ValidationError, match="Approval reference is required"):
        approve_quality_change(actor=approver, change_id=change.id, approval_reference=" ")
    approve_quality_change(actor=approver, change_id=change.id, approval_reference="APR-SYNTH")
    change.refresh_from_db()
    assert change.status == ChangeRequestStatus.APPROVED
    with pytest.raises(ValidationError, match="after approval"):
        add_affected_link(
            actor=requester,
            change_id=change.id,
            linked_kind=ChangeAffectedKind.CHECKLIST,
            linked_reference="too-late",
        )
    start_change_implementation(actor=implementer, change_id=change.id)
    with pytest.raises(ValidationError, match="implementation link"):
        submit_change_for_verification(actor=implementer, change_id=change.id)
    impl = record_implementation_link(
        actor=implementer,
        change_id=change.id,
        implemented_kind=ChangeImplementationKind.HACCP_PLAN_VERSION,
        implemented_reference="SYN-HACCP-V2",
    )
    assert impl.does_not_constitute_approval is True
    change.refresh_from_db()
    assert change.engineering_complete is True
    assert change.status == ChangeRequestStatus.IMPLEMENTING
    submit_change_for_verification(actor=implementer, change_id=change.id)
    with pytest.raises(PermissionDenied):
        verify_and_close_quality_change(
            actor=approver, change_id=change.id, verification_reference="VER-1"
        )
    with pytest.raises(ValidationError, match="Verification reference is required"):
        verify_and_close_quality_change(
            actor=verifier, change_id=change.id, verification_reference=" "
        )
    closed = verify_and_close_quality_change(
        actor=verifier, change_id=change.id, verification_reference="VER-SYNTH"
    )
    assert closed.status == ChangeRequestStatus.CLOSED
    assert change_is_historically_locked(closed.status)
    assert list_implementation_links(change=closed).count() == 1
    assert list_change_events(change=closed).filter(event_type="CHANGE_CLOSED").exists()
    with pytest.raises(ValidationError, match="historically immutable"):
        start_change_assessment(actor=assessor, change_id=closed.id)


@pytest.mark.django_db
def test_authorization_and_no_auto_approval() -> None:
    org = make_org(code="CC-P")
    requester = _cc_user(org=org, create=True)
    viewer = _cc_user(org=org, view=True)
    stranger = _cc_user(org=org, view=False)
    implementer = _cc_user(org=org, implement=True)
    change = create_quality_change(
        actor=requester,
        organization_id=org.id,
        change_code="SYN-CC-020",
        title="Synthetic equipment mapping",
        description="Description",
        reason="Reason",
    )
    with pytest.raises(PermissionDenied):
        list_quality_changes(actor=stranger, organization_id=org.id)
    assert list_quality_changes(actor=viewer, organization_id=org.id).filter(pk=change.id).exists()
    with pytest.raises(PermissionDenied):
        start_change_assessment(actor=viewer, change_id=change.id)
    with pytest.raises(ValidationError, match="Cannot transition"):
        start_change_implementation(actor=implementer, change_id=change.id)
    with pytest.raises(ValidationError, match="only after approval"):
        record_implementation_link(
            actor=implementer,
            change_id=change.id,
            implemented_kind=ChangeImplementationKind.CONFIGURATION,
            implemented_reference="cfg-1",
        )


@pytest.mark.django_db
def test_cross_org_isolation() -> None:
    org_a = make_org(code="CC-A2")
    org_b = make_org(code="CC-B2")
    requester_a = _cc_user(org=org_a, create=True)
    viewer_b = _cc_user(org=org_b, view=True)
    requester_b = _cc_user(org=org_b, create=True)
    change = create_quality_change(
        actor=requester_a,
        organization_id=org_a.id,
        change_code="SYN-CC-030",
        title="Org A change",
        description="Description",
        reason="Reason",
    )
    with pytest.raises(PermissionDenied):
        list_quality_changes(actor=viewer_b, organization_id=org_a.id)
    with pytest.raises(PermissionDenied):
        add_affected_link(
            actor=requester_b,
            change_id=change.id,
            linked_kind=ChangeAffectedKind.TRAINING,
            linked_reference="cross-org",
        )
    with pytest.raises(QualityChangeRequest.DoesNotExist):
        get_quality_change_for_org(actor=viewer_b, organization_id=org_b.id, change_id=change.id)
    assert (
        not list_quality_changes(actor=viewer_b, organization_id=org_b.id)
        .filter(pk=change.id)
        .exists()
    )


@pytest.mark.django_db
def test_historical_integrity_and_audit() -> None:
    org = make_org(code="CC-H")
    requester = _cc_user(org=org, create=True)
    assessor = _cc_user(org=org, assess=True)
    approver = _cc_user(org=org, approve=True)
    implementer = _cc_user(org=org, implement=True)
    verifier = _cc_user(org=org, verify=True)
    change = create_quality_change(
        actor=requester,
        organization_id=org.id,
        change_code="SYN-CC-040",
        title="Synthetic specification change",
        description="Description",
        reason="Reason",
    )
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.SPECIFICATION,
        linked_object_id=uuid.uuid4(),
    )
    add_affected_link(
        actor=requester,
        change_id=change.id,
        linked_kind=ChangeAffectedKind.DOCUMENT,
        linked_reference="SYN-SOP-REF",
    )
    _to_verification(
        requester=requester,
        assessor=assessor,
        approver=approver,
        implementer=implementer,
        change=change,
    )
    verify_and_close_quality_change(
        actor=verifier, change_id=change.id, verification_reference="VER-HIST"
    )
    change.refresh_from_db()
    event_types = set(list_change_events(change=change).values_list("event_type", flat=True))
    assert {
        "CHANGE_REQUESTED",
        "CHANGE_ASSESSMENT_STARTED",
        "CHANGE_IMPACT_RECORDED",
        "CHANGE_AFFECTED_LINKED",
        "CHANGE_APPROVED",
        "CHANGE_IMPLEMENTATION_STARTED",
        "CHANGE_IMPLEMENTATION_LINKED",
        "CHANGE_VERIFICATION_STARTED",
        "CHANGE_CLOSED",
    }.issubset(event_types)
    assert SecurityAuditEvent.objects.filter(event_type="CHANGE_APPROVED").exists()
    assert change.events.filter(payload__does_not_constitute_approval=True).exists()
    with pytest.raises(ValidationError, match="historically immutable"):
        record_implementation_link(
            actor=implementer,
            change_id=change.id,
            implemented_kind=ChangeImplementationKind.OTHER,
            implemented_reference="late",
        )
    event = QualityChangeEvent.objects.filter(change_request=change).first()
    assert event is not None
    assert str(event)


@pytest.mark.django_db
def test_validation_guards_and_admin_retention() -> None:
    org = make_org(code="CC-G")
    requester = _cc_user(org=org, create=True)
    assessor = _cc_user(org=org, assess=True)
    implementer = _cc_user(org=org, implement=True)
    with pytest.raises(ValidationError, match="Title is required"):
        create_quality_change(
            actor=requester,
            organization_id=org.id,
            change_code="SYN-CC-050",
            title=" ",
            description="D",
            reason="R",
        )
    with pytest.raises(ValidationError, match="Change identifier is required"):
        create_quality_change(
            actor=requester,
            organization_id=org.id,
            change_code=" ",
            title="T",
            description="D",
            reason="R",
        )
    change = create_quality_change(
        actor=requester,
        organization_id=org.id,
        change_code="SYN-CC-050",
        title="Guard change",
        description="D",
        reason="R",
    )
    with pytest.raises(ValidationError, match="already exists"):
        create_quality_change(
            actor=requester,
            organization_id=org.id,
            change_code="syn-cc-050",
            title="Dup",
            description="D",
            reason="R",
        )
    start_change_assessment(actor=assessor, change_id=change.id)
    with pytest.raises(ValidationError):
        record_change_impact_assessment(
            actor=assessor,
            change_id=change.id,
            quality_impact=" ",
            food_safety_impact="a",
            technical_impact="a",
            training_impact="a",
            validation_requirement="a",
            data_migration_impact="a",
        )
    with pytest.raises(ValidationError, match="Unknown implementation kind"):
        record_implementation_link(
            actor=implementer,
            change_id=change.id,
            implemented_kind="SECRET_DEPLOY",
            implemented_reference="x",
        )
    request = RequestFactory().get("/")
    request.user = requester
    admin = SoftRetentionAdmin(QualityChangeRequest, AdminSite())
    assert admin.has_delete_permission(request) is False
    event_admin = QualityChangeEventAdmin(QualityChangeEvent, AdminSite())
    assert event_admin.has_add_permission(request) is False
    assert event_admin.has_change_permission(request) is False
    assert event_admin.has_delete_permission(request) is False
    draft = QualityChangeRequest(
        organization=org,
        change_code=" ",
        title=" ",
        description="",
        reason="",
        requester=requester,
        created_by=requester,
    )
    with pytest.raises(ValidationError):
        draft.full_clean()
    loaded = get_quality_change_for_org(
        actor=requester, organization_id=org.id, change_id=change.id
    )
    assert loaded.id == change.id
    assert (
        list_quality_changes(
            actor=requester, organization_id=org.id, status=ChangeRequestStatus.ASSESSMENT
        )
        .filter(pk=change.id)
        .exists()
    )
    with pytest.raises(ValidationError, match="Description is required"):
        create_quality_change(
            actor=requester,
            organization_id=org.id,
            change_code="SYN-CC-051",
            title="T",
            description=" ",
            reason="R",
        )
    with pytest.raises(ValidationError, match="during assessment"):
        record_change_impact_assessment(
            actor=assessor,
            change_id=create_quality_change(
                actor=requester,
                organization_id=org.id,
                change_code="SYN-CC-052",
                title="T",
                description="D",
                reason="R",
            ).id,
            quality_impact="a",
            food_safety_impact="a",
            technical_impact="a",
            training_impact="a",
            validation_requirement="a",
            data_migration_impact="a",
        )
