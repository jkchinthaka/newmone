"""Phase 43 — controlled quality document management tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.document_control.historical_safety import version_is_immutable
from apps.document_control.models import (
    DocumentKind,
    DocumentVersionStatus,
    QualityDocument,
    QualityDocumentAcknowledgement,
    QualityDocumentEvent,
    QualityDocumentVersion,
)
from apps.document_control.selectors import (
    get_effective_version,
    list_controlled_versions,
    list_effective_documents,
    list_record_document_links,
    operator_may_view_version,
)
from apps.document_control.services import (
    acknowledge_document_version,
    approve_document_version,
    assert_can_access_document_file,
    create_document_version,
    create_quality_document,
    link_quality_record_to_document_version,
    make_version_effective,
    retire_document_version,
    return_version_to_draft,
    submit_version_for_review,
    update_draft_version,
)
from apps.evidence.linking import (
    assert_can_upload_to_target,
    assert_can_view_target,
    resolve_linked_target,
)
from apps.evidence.models import EvidenceAttachment, EvidenceLinkedKind
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


def _doc_user(
    *,
    org: Organization,
    view_effective: bool = False,
    edit: bool = False,
    approve: bool = False,
    publish: bool = False,
    ack: bool = False,
    link: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"DC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"DC{suffix}",
        name=f"Doc control {suffix}",
        permission=_perm(QualityDocument, "view_effectivedocument"),
    )
    if not view_effective:
        role.permissions.remove(_perm(QualityDocument, "view_effectivedocument"))
    if edit:
        role.permissions.add(_perm(QualityDocument, "edit_qualitydocument"))
    if approve:
        role.permissions.add(_perm(QualityDocument, "approve_qualitydocument"))
    if publish:
        role.permissions.add(_perm(QualityDocument, "publish_qualitydocument"))
    if ack:
        role.permissions.add(_perm(QualityDocument, "acknowledge_qualitydocument"))
    if link:
        role.permissions.add(_perm(QualityDocument, "link_qualitydocumentversion"))
    grant_role(user, role, organization=org)
    return user


def _grant_evidence(user: User, org: Organization) -> None:
    role = make_role_with_permission(
        code=f"EV{uuid.uuid4().hex[:6].upper()}",
        name="Evidence file access",
        permission=_perm(EvidenceAttachment, "view_evidenceattachment"),
    )
    role.permissions.add(_perm(EvidenceAttachment, "upload_evidenceattachment"))
    grant_role(user, role, organization=org)


def _advance_to_effective(
    *,
    editor: User,
    approver: User,
    publisher: User,
    version: QualityDocumentVersion,
    approval_reference: str = "APR-SYNTH-001",
) -> QualityDocumentVersion:
    submit_version_for_review(actor=editor, version_id=version.id)
    approve_document_version(
        actor=approver,
        version_id=version.id,
        approval_reference=approval_reference,
    )
    return make_version_effective(actor=publisher, version_id=version.id)


@pytest.mark.django_db
def test_versioning_and_immutability() -> None:
    org = make_org(code="DC-V")
    editor = _doc_user(org=org, edit=True)
    approver = _doc_user(org=org, approve=True)
    publisher = _doc_user(org=org, publish=True)
    document, v1 = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-SOP-001",
        title="Synthetic SOP",
        document_kind=DocumentKind.SOP,
        first_revision="01",
    )
    update_draft_version(
        actor=editor,
        version_id=v1.id,
        title="Synthetic SOP revised",
        change_summary="Initial draft",
        approval_reference="pending",
        evidence_attachment_id=uuid.uuid4(),
    )
    update_draft_version(actor=editor, version_id=v1.id, clear_evidence=True)
    v1.refresh_from_db()
    assert v1.evidence_attachment_id is None
    assert v1.document.title == "Synthetic SOP revised"
    assert str(document)
    assert str(v1)
    _advance_to_effective(editor=editor, approver=approver, publisher=publisher, version=v1)
    v1.refresh_from_db()
    assert v1.status == DocumentVersionStatus.EFFECTIVE
    assert version_is_immutable(v1.status)
    with pytest.raises(ValidationError, match="cannot be silently edited"):
        update_draft_version(actor=editor, version_id=v1.id, title="Silent edit")
    v2 = create_document_version(
        actor=editor, document_id=document.id, revision="02", change_summary="Rev 2"
    )
    assert v2.status == DocumentVersionStatus.DRAFT
    with pytest.raises(ValidationError, match="already exists"):
        create_document_version(actor=editor, document_id=document.id, revision="02")


@pytest.mark.django_db
def test_retirement_and_effective_lookup() -> None:
    org = make_org(code="DC-E")
    editor = _doc_user(org=org, edit=True)
    approver = _doc_user(org=org, approve=True)
    publisher = _doc_user(org=org, publish=True)
    operator = _doc_user(org=org, view_effective=True)
    document, v1 = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-TM-001",
        title="Synthetic test method",
        document_kind=DocumentKind.TEST_METHOD,
    )
    first = _advance_to_effective(editor=editor, approver=approver, publisher=publisher, version=v1)
    assert list_effective_documents(actor=operator, organization_id=org.id).get().id == document.id
    current = get_effective_version(document=document)
    assert current is not None
    assert current.id == first.id

    v2 = create_document_version(actor=editor, document_id=document.id, revision="02")
    second = _advance_to_effective(
        editor=editor,
        approver=approver,
        publisher=publisher,
        version=v2,
        approval_reference="APR-SYNTH-002",
    )
    first.refresh_from_db()
    assert first.status == DocumentVersionStatus.RETIRED
    successor = get_effective_version(document=document)
    assert successor is not None
    assert successor.id == second.id
    historical = get_effective_version(document=document, as_of=first.effective_from)
    assert historical is not None
    assert historical.id == first.id

    retire_document_version(actor=publisher, version_id=second.id)
    second.refresh_from_db()
    assert second.status == DocumentVersionStatus.RETIRED
    assert list_effective_documents(actor=operator, organization_id=org.id).count() == 0


@pytest.mark.django_db
def test_permissions_and_operator_visibility() -> None:
    org = make_org(code="DC-P")
    editor = _doc_user(org=org, edit=True)
    approver = _doc_user(org=org, approve=True)
    publisher = _doc_user(org=org, publish=True)
    operator = _doc_user(org=org, view_effective=True)
    stranger = _doc_user(org=org)
    document, version = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-WI-001",
        title="Synthetic WI",
        document_kind=DocumentKind.WORK_INSTRUCTION,
    )
    with pytest.raises(PermissionDenied):
        list_effective_documents(actor=stranger, organization_id=org.id)
    with pytest.raises(PermissionDenied):
        list_controlled_versions(actor=operator, organization_id=org.id)
    assert (
        list_controlled_versions(
            actor=editor, organization_id=org.id, document_id=document.id
        ).count()
        == 1
    )
    assert not operator_may_view_version(actor=operator, version=version)
    with pytest.raises(PermissionDenied):
        assert_can_access_document_file(actor=operator, version=version)
    with pytest.raises(PermissionDenied):
        submit_version_for_review(actor=operator, version_id=version.id)
    submit_version_for_review(actor=editor, version_id=version.id)
    with pytest.raises(PermissionDenied):
        approve_document_version(actor=editor, version_id=version.id, approval_reference="SELF")
    approve_document_version(actor=approver, version_id=version.id, approval_reference="APR-SYNTH")
    make_version_effective(actor=publisher, version_id=version.id)
    version.refresh_from_db()
    assert operator_may_view_version(actor=operator, version=version)
    assert_can_access_document_file(actor=operator, version=version)
    assert (
        list_effective_documents(
            actor=operator,
            organization_id=org.id,
            document_kind=DocumentKind.WORK_INSTRUCTION,
        )
        .filter(pk=document.id)
        .exists()
    )


@pytest.mark.django_db
def test_historical_links_and_acknowledgement() -> None:
    org = make_org(code="DC-L")
    editor = _doc_user(org=org, edit=True)
    approver = _doc_user(org=org, approve=True)
    publisher = _doc_user(org=org, publish=True)
    linker = _doc_user(org=org, link=True)
    reader = _doc_user(org=org, ack=True, view_effective=True)
    _document, version = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-POL-001",
        title="Synthetic policy",
        document_kind=DocumentKind.POLICY,
    )
    with pytest.raises(ValidationError, match="approved, effective, or retired"):
        link_quality_record_to_document_version(
            actor=linker,
            organization_id=org.id,
            document_version_id=version.id,
            linked_kind="CHECKLIST_SUBMISSION",
            linked_object_id=uuid.uuid4(),
        )
    _advance_to_effective(editor=editor, approver=approver, publisher=publisher, version=version)
    record_id = uuid.uuid4()
    link = link_quality_record_to_document_version(
        actor=linker,
        organization_id=org.id,
        document_version_id=version.id,
        linked_kind="CHECKLIST_SUBMISSION",
        linked_object_id=record_id,
    )
    again = link_quality_record_to_document_version(
        actor=linker,
        organization_id=org.id,
        document_version_id=version.id,
        linked_kind="CHECKLIST_SUBMISSION",
        linked_object_id=record_id,
    )
    assert again.id == link.id
    assert (
        list_record_document_links(
            organization_id=org.id,
            linked_kind="CHECKLIST_SUBMISSION",
            linked_object_id=record_id,
        )
        .get()
        .document_version_id
        == version.id
    )

    ack = acknowledge_document_version(actor=reader, version_id=version.id)
    assert ack.is_not_competency_training is True
    assert QualityDocumentAcknowledgement.objects.filter(version=version).count() == 1
    acknowledge_document_version(actor=reader, version_id=version.id)
    assert QualityDocumentAcknowledgement.objects.filter(version=version).count() == 1


@pytest.mark.django_db
def test_file_access_and_evidence_kind() -> None:
    org = make_org(code="DC-F")
    editor = _doc_user(org=org, edit=True)
    operator = _doc_user(org=org, view_effective=True)
    _document, version = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-FR-001",
        title="Synthetic form reference",
        document_kind=DocumentKind.FORM_REFERENCE,
    )
    target = resolve_linked_target(
        kind=EvidenceLinkedKind.QUALITY_DOCUMENT_VERSION, object_id=version.id
    )
    assert target.organization_id == org.id
    assert target.linkage_immutable is False
    assert_can_access_document_file(actor=editor, version=version)
    with pytest.raises(PermissionDenied):
        assert_can_access_document_file(actor=operator, version=version)


@pytest.mark.django_db
def test_cross_org_isolation() -> None:
    org_a = make_org(code="DC-A")
    org_b = make_org(code="DC-B")
    editor_a = _doc_user(org=org_a, edit=True)
    editor_b = _doc_user(org=org_b, edit=True)
    operator_b = _doc_user(org=org_b, view_effective=True)
    linker_b = _doc_user(org=org_b, link=True)
    document, version = create_quality_document(
        actor=editor_a,
        organization_id=org_a.id,
        code="SYN-SPEC-001",
        title="Synthetic specification",
        document_kind=DocumentKind.SPECIFICATION,
    )
    with pytest.raises(PermissionDenied):
        update_draft_version(actor=editor_b, version_id=version.id, title="Cross org")
    with pytest.raises(PermissionDenied):
        list_effective_documents(actor=operator_b, organization_id=org_a.id)
    with pytest.raises(PermissionDenied):
        link_quality_record_to_document_version(
            actor=linker_b,
            organization_id=org_a.id,
            document_version_id=version.id,
            linked_kind="QA_REVIEW",
            linked_object_id=uuid.uuid4(),
        )
    assert (
        not list_effective_documents(actor=operator_b, organization_id=org_b.id)
        .filter(pk=document.id)
        .exists()
    )


@pytest.mark.django_db
def test_lifecycle_audit_and_return_to_draft() -> None:
    org = make_org(code="DC-U")
    editor = _doc_user(org=org, edit=True)
    approver = _doc_user(org=org, approve=True)
    _document, version = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-SOP-009",
        title="Synthetic review loop",
        document_kind=DocumentKind.SOP,
    )
    submit_version_for_review(actor=editor, version_id=version.id)
    return_version_to_draft(actor=approver, version_id=version.id)
    version.refresh_from_db()
    assert version.status == DocumentVersionStatus.DRAFT
    types = set(
        QualityDocumentEvent.objects.filter(document=_document).values_list("event_type", flat=True)
    )
    assert "DOCUMENT_CREATED" in types
    assert "DOCUMENT_SUBMITTED_FOR_REVIEW" in types
    assert "DOCUMENT_RETURNED_TO_DRAFT" in types
    assert SecurityAuditEvent.objects.filter(event_type="DOCUMENT_CREATED").exists()
    with pytest.raises(ValidationError, match="Unknown architectural document kind"):
        create_quality_document(
            actor=editor,
            organization_id=org.id,
            code="SYN-BAD",
            title="Bad",
            document_kind="NELNA_SECRET_CODE",
        )
    with pytest.raises(ValidationError, match="Document code is required"):
        create_quality_document(
            actor=editor,
            organization_id=org.id,
            code="  ",
            title="X",
            document_kind=DocumentKind.SOP,
        )
    with pytest.raises(ValidationError, match="Document title is required"):
        create_quality_document(
            actor=editor,
            organization_id=org.id,
            code="SYN-EMPTY-TITLE",
            title=" ",
            document_kind=DocumentKind.SOP,
        )
    with pytest.raises(ValidationError, match="already exists"):
        create_quality_document(
            actor=editor,
            organization_id=org.id,
            code="SYN-SOP-009",
            title="Dup",
            document_kind=DocumentKind.SOP,
        )
    with pytest.raises(ValidationError, match="Revision is required"):
        create_document_version(actor=editor, document_id=_document.id, revision=" ")
    with pytest.raises(ValidationError, match="Document title is required"):
        update_draft_version(actor=editor, version_id=version.id, title=" ")
    with pytest.raises(ValidationError, match="Cannot transition"):
        approve_document_version(
            actor=approver, version_id=version.id, approval_reference="TOO-EARLY"
        )
    submit_version_for_review(actor=editor, version_id=version.id)
    with pytest.raises(ValidationError, match="Approval reference is required"):
        approve_document_version(actor=approver, version_id=version.id, approval_reference=" ")
    return_version_to_draft(actor=approver, version_id=version.id)
    draft = QualityDocument(
        organization=_document.organization,
        code=" ",
        title=" ",
        document_kind="NOT_A_KIND",
        created_by=editor,
    )
    with pytest.raises(ValidationError):
        draft.full_clean()
    empty_rev = QualityDocumentVersion(document=_document, revision=" ", created_by=editor)
    with pytest.raises(ValidationError):
        empty_rev.full_clean()
    assert str(QualityDocumentEvent.objects.filter(document=_document).first())


@pytest.mark.django_db
def test_validation_guards_and_controlled_selectors() -> None:
    org = make_org(code="DC-G")
    editor = _doc_user(org=org, edit=True)
    approver = _doc_user(org=org, approve=True)
    publisher = _doc_user(org=org, publish=True)
    linker = _doc_user(org=org, link=True)
    reader = _doc_user(org=org, ack=True)
    with pytest.raises(ValidationError, match="Document code is required"):
        create_quality_document(
            actor=editor,
            organization_id=org.id,
            code="  ",
            title="T",
            document_kind=DocumentKind.SOP,
        )
    with pytest.raises(ValidationError, match="Document title is required"):
        create_quality_document(
            actor=editor,
            organization_id=org.id,
            code="SYN-G-001",
            title=" ",
            document_kind=DocumentKind.SOP,
        )
    document, version = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-G-001",
        title="Guard SOP",
        document_kind=DocumentKind.SOP,
    )
    assert str(document)
    assert str(version)
    with pytest.raises(ValidationError, match="already exists"):
        create_quality_document(
            actor=editor,
            organization_id=org.id,
            code="syn-g-001",
            title="Dup",
            document_kind=DocumentKind.SOP,
        )
    with pytest.raises(ValidationError, match="Revision is required"):
        create_document_version(actor=editor, document_id=document.id, revision="  ")
    update_draft_version(
        actor=editor,
        version_id=version.id,
        title="Guard SOP revised",
        approval_reference="pending",
        evidence_attachment_id=uuid.uuid4(),
    )
    update_draft_version(actor=editor, version_id=version.id, clear_evidence=True)
    version.refresh_from_db()
    assert version.evidence_attachment_id is None
    assert version.document.title == "Guard SOP revised"
    submit_version_for_review(actor=editor, version_id=version.id)
    with pytest.raises(ValidationError, match="Approval reference is required"):
        approve_document_version(actor=approver, version_id=version.id, approval_reference=" ")
    approve_document_version(actor=approver, version_id=version.id, approval_reference="APR-G")
    with pytest.raises(ValidationError, match="cannot be silently edited"):
        update_draft_version(actor=editor, version_id=version.id, title="After approve")
    approved = QualityDocumentVersion.objects.get(pk=version.id)
    retired_approved = retire_document_version(actor=publisher, version_id=approved.id)
    assert retired_approved.status == DocumentVersionStatus.RETIRED
    assert (
        list_controlled_versions(actor=editor, organization_id=org.id, document_id=document.id)
        .filter(pk=version.id)
        .exists()
    )
    with pytest.raises(ValidationError, match="Only effective"):
        acknowledge_document_version(actor=reader, version_id=version.id)
    with pytest.raises(ValidationError, match="Linked kind is required"):
        link_quality_record_to_document_version(
            actor=linker,
            organization_id=org.id,
            document_version_id=version.id,
            linked_kind=" ",
            linked_object_id=uuid.uuid4(),
        )


@pytest.mark.django_db
def test_evidence_parent_access_for_document_files() -> None:
    org = make_org(code="DC-EV")
    editor = _doc_user(org=org, edit=True)
    approver = _doc_user(org=org, approve=True)
    publisher = _doc_user(org=org, publish=True)
    operator = _doc_user(org=org, view_effective=True)
    _grant_evidence(editor, org)
    _grant_evidence(operator, org)
    _document, version = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-EV-001",
        title="Evidence SOP",
        document_kind=DocumentKind.SOP,
    )
    target = resolve_linked_target(
        kind=EvidenceLinkedKind.QUALITY_DOCUMENT_VERSION, object_id=version.id
    )
    assert_can_upload_to_target(actor=editor, target=target)
    with pytest.raises(PermissionDenied):
        assert_can_view_target(actor=operator, target=target)
    _advance_to_effective(editor=editor, approver=approver, publisher=publisher, version=version)
    version.refresh_from_db()
    effective_target = resolve_linked_target(
        kind=EvidenceLinkedKind.QUALITY_DOCUMENT_VERSION, object_id=version.id
    )
    assert effective_target.linkage_immutable is True
    with pytest.raises(ValidationError, match="cannot be attached"):
        assert_can_upload_to_target(actor=editor, target=effective_target)
    assert_can_view_target(actor=operator, target=effective_target)
    assert (
        list_effective_documents(
            actor=operator,
            organization_id=org.id,
            document_kind=DocumentKind.SOP,
        )
        .filter(pk=_document.id)
        .exists()
    )


@pytest.mark.django_db
def test_model_admin_and_transition_edges() -> None:
    from django.contrib.admin.sites import AdminSite
    from django.test import RequestFactory

    from apps.document_control.admin import (
        QualityDocumentEventAdmin,
        SoftRetentionAdmin,
    )

    org = make_org(code="DC-X")
    editor = _doc_user(org=org, edit=True)
    publisher = _doc_user(org=org, publish=True)
    document, version = create_quality_document(
        actor=editor,
        organization_id=org.id,
        code="SYN-X-001",
        title="Edge SOP",
        document_kind=DocumentKind.SOP,
    )
    document.document_kind = "NOT_A_KIND"
    with pytest.raises(ValidationError, match="Unknown architectural document kind"):
        document.full_clean()
    version.revision = "  "
    with pytest.raises(ValidationError, match="Revision is required"):
        version.full_clean()
    event = QualityDocumentEvent.objects.filter(document=document).first()
    assert event is not None
    assert str(event)
    assert version.is_content_immutable is False
    with pytest.raises(ValidationError, match="Cannot transition"):
        make_version_effective(actor=publisher, version_id=version.id)
    with pytest.raises(ValidationError, match="Document title is required"):
        update_draft_version(actor=editor, version_id=version.id, title="  ")
    assert operator_may_view_version(actor=editor, version=version)
    assert list_controlled_versions(actor=editor, organization_id=org.id).exists()

    request = RequestFactory().get("/")
    request.user = editor
    admin = SoftRetentionAdmin(QualityDocument, AdminSite())
    assert admin.has_delete_permission(request) is False
    event_admin = QualityDocumentEventAdmin(QualityDocumentEvent, AdminSite())
    assert event_admin.has_add_permission(request) is False
    assert event_admin.has_change_permission(request) is False
    assert event_admin.has_delete_permission(request) is False
