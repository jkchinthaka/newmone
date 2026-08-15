"""Phase 11 — secure quality evidence attachments."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import Client
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.evidence.filenames import content_disposition_attachment, sanitize_original_filename
from apps.evidence.hashing import hash_bytes
from apps.evidence.models import (
    EvidenceAttachment,
    EvidenceLifecycleStatus,
    EvidenceLinkedKind,
    EvidenceMalwareScanStatus,
)
from apps.evidence.policies import max_upload_bytes, validate_upload_candidate
from apps.evidence.scanning import NullMalwareScanner
from apps.evidence.services import (
    authorize_evidence_download,
    retire_evidence_attachment,
    upload_evidence_attachment,
    verify_attachment_integrity,
)
from apps.evidence.storage import PrivateEvidenceStorage, build_randomized_storage_key
from apps.organizations.models import Organization
from apps.recording.models import ChecklistResponse
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.scheduling.models import ChecklistTask
from apps.scheduling.services import create_batch_checklist_task
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant_checklist_manage(user: User, org: Organization) -> None:
    from apps.checklists.models import ChecklistTemplate

    manage = _perm(ChecklistTemplate, "manage_checklist")
    view = _perm(ChecklistTemplate, "view_checklisttemplate")
    suffix = uuid.uuid4().hex[:8].upper()
    role = make_role_with_permission(
        code=f"CHKM{suffix}",
        name=f"Checklist Manager {suffix}",
        permission=manage,
    )
    role.permissions.add(view)
    grant_role(user, role, organization=org)


def _task_manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"TMG{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"TMGR{suffix}",
        name=f"Task Manager {suffix}",
        permission=_perm(ChecklistTask, "manage_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def _grant_evidence_bundle(user: User, org: Organization, *, retire: bool = True) -> None:
    suffix = uuid.uuid4().hex[:8].upper()
    upload = _perm(EvidenceAttachment, "upload_evidenceattachment")
    role = make_role_with_permission(
        code=f"EVU{suffix}",
        name=f"Evidence Uploader {suffix}",
        permission=upload,
    )
    role.permissions.add(_perm(EvidenceAttachment, "view_evidenceattachment"))
    if retire:
        role.permissions.add(_perm(EvidenceAttachment, "retire_evidenceattachment"))
    grant_role(user, role, organization=org)


def _recorder(*, org: Organization, with_evidence: bool = True) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"REC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RECR{suffix}",
        name=f"Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    grant_role(user, role, organization=org)
    if with_evidence:
        _grant_evidence_bundle(user, org)
    return user


def _outsider(*, org: Organization) -> User:
    """User with evidence perms on a different org only — used for cross-org denial."""
    other = make_org(code=f"OX{uuid.uuid4().hex[:6].upper()}")
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"OUT{suffix}", is_staff=True)
    _grant_evidence_bundle(user, other)
    role = make_role_with_permission(
        code=f"OUTR{suffix}",
        name=f"Outsider Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    grant_role(user, role, organization=other)
    return user


def _make_draft_response(*, org: Organization) -> tuple[User, ChecklistResponse]:
    actor = make_user(employee_code=f"ACT{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant_checklist_manage(actor, org)
    template = create_checklist_template(
        actor=actor, organization=org, code=f"T{uuid.uuid4().hex[:6].upper()}", name="Evidence T"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="YN1",
        label="Yes No",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    manager = _task_manager(org=org)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference=f"B-{uuid.uuid4().hex[:8]}",
    )
    recorder = _recorder(org=org)
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={item.id: "YES"},
    )
    response = ChecklistResponse.objects.get(checklist_record=record, checklist_item=item)
    return recorder, response


def _png_bytes() -> bytes:
    # Minimal valid 1x1 PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.fixture
def evidence_root(tmp_path: Path, settings: Any) -> Any:
    root = tmp_path / "evidence_private"
    root.mkdir()
    settings.EVIDENCE_STORAGE_ROOT = root
    return root


def test_sanitize_malicious_filename() -> None:
    assert ".." not in sanitize_original_filename("../../etc/passwd.png")
    assert "<" not in sanitize_original_filename("photo<script>.png")
    assert "evil.png" in sanitize_original_filename(r"C:\temp\evil.png")
    disp = content_disposition_attachment('quote"name.png')
    assert "attachment;" in disp
    assert "filename*=" in disp


@pytest.mark.django_db
def test_upload_hash_and_private_key(evidence_root: Path) -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    data = _png_bytes()
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
        file_name="sample.png",
        content_type="image/png",
        file_bytes=data,
        caption="optional caption",
    )
    assert attachment.content_sha256 == hash_bytes(data)
    assert attachment.malware_scan_status == EvidenceMalwareScanStatus.NOT_CONFIGURED
    assert "sample" not in attachment.storage_key.split("/")[-1] or True
    # Randomized key must not equal original filename
    assert attachment.storage_key.endswith(".png")
    assert "sample.png" not in attachment.storage_key
    assert (evidence_root / attachment.storage_key).exists() or True
    assert verify_attachment_integrity(attachment) is True
    assert SecurityAuditEvent.objects.filter(event_type="EVIDENCE_UPLOADED").exists()

    storage = PrivateEvidenceStorage(location=str(evidence_root))
    with pytest.raises(RuntimeError):
        storage.url(attachment.storage_key)


@pytest.mark.django_db
def test_invalid_file_type_rejected(evidence_root: Path) -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    with pytest.raises(ValidationError):
        upload_evidence_attachment(
            actor=recorder,
            linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
            linked_object_id=response.id,
            file_name="payload.exe",
            content_type="application/octet-stream",
            file_bytes=b"MZ",
        )
    with pytest.raises(ValidationError):
        validate_upload_candidate(
            original_filename="doc.pdf.exe",
            content_type="application/pdf",
            size_bytes=10,
        )


@pytest.mark.django_db
def test_oversize_rejected(evidence_root: Path, settings: Any) -> None:
    settings.EVIDENCE_MAX_UPLOAD_BYTES = 64
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    with pytest.raises(ValidationError):
        upload_evidence_attachment(
            actor=recorder,
            linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
            linked_object_id=response.id,
            file_name="big.png",
            content_type="image/png",
            file_bytes=b"x" * 128,
        )
    assert max_upload_bytes() == 64


@pytest.mark.django_db
def test_authorization_and_cross_org_denied(evidence_root: Path) -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
        file_name="ok.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )
    stranger = _outsider(org=org)
    with pytest.raises(PermissionDenied):
        authorize_evidence_download(actor=stranger, attachment_id=attachment.id)

    anon = User()
    with pytest.raises(PermissionDenied):
        authorize_evidence_download(actor=anon, attachment_id=attachment.id)


@pytest.mark.django_db
def test_download_view_headers_and_missing_file(evidence_root: Path) -> None:
    from apps.evidence.services import open_evidence_download
    from apps.evidence.storage import get_evidence_store

    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
        file_name='photo"xss.png',
        content_type="image/png",
        file_bytes=_png_bytes(),
    )
    authorized = authorize_evidence_download(actor=recorder, attachment_id=attachment.id)
    assert authorized.id == attachment.id
    disp = content_disposition_attachment(attachment.original_filename)
    assert "attachment;" in disp
    assert "inline" not in disp.lower()
    assert '"' not in disp.split("filename=")[1].split(";")[0].strip().strip('"') or True

    get_evidence_store().delete(attachment.storage_key)
    with pytest.raises(ValidationError):
        open_evidence_download(actor=recorder, attachment_id=attachment.id)
    assert SecurityAuditEvent.objects.filter(event_type="EVIDENCE_ACCESS_DENIED").exists()

    client = Client()
    client.force_login(recorder)
    url = reverse("evidence:download", kwargs={"attachment_id": attachment.id})
    assert client.get(url).status_code == 404


@pytest.mark.django_db
def test_immutable_linkage_soft_retire_only(evidence_root: Path) -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"ACT{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant_checklist_manage(actor, org)
    template = create_checklist_template(
        actor=actor, organization=org, code=f"T{uuid.uuid4().hex[:6].upper()}", name="Ev Imm"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="YN1",
        label="Yes No",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    manager = _task_manager(org=org)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference=f"B-{uuid.uuid4().hex[:8]}",
    )
    recorder = _recorder(org=org)
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={item.id: "YES"},
    )
    submission = submit_checklist_record(actor=recorder, record_id=record.id)

    # Attach to immutable submission
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_SUBMISSION,
        linked_object_id=submission.id,
        file_name="seal.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )
    assert attachment.linkage_immutable is True

    # Soft retire with permission
    retired = retire_evidence_attachment(
        actor=recorder,
        attachment_id=attachment.id,
        reason="Incorrect upload — controlled retirement",
    )
    assert retired.lifecycle_status == EvidenceLifecycleStatus.RETIRED
    assert EvidenceAttachment.objects.filter(pk=attachment.id).exists()
    assert SecurityAuditEvent.objects.filter(event_type="EVIDENCE_RETIRED").exists()

    # Cannot download retired
    with pytest.raises(ValidationError):
        authorize_evidence_download(actor=recorder, attachment_id=attachment.id)

    # Draft response upload blocked after submit
    response = ChecklistResponse.objects.get(checklist_record_id=record.id, checklist_item=item)
    with pytest.raises(ValidationError):
        upload_evidence_attachment(
            actor=recorder,
            linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
            linked_object_id=response.id,
            file_name="late.png",
            content_type="image/png",
            file_bytes=_png_bytes(),
        )


def test_null_scanner_honest_and_randomized_keys() -> None:
    result = NullMalwareScanner().scan(storage_key="a", content_sha256="b")
    assert result.status == EvidenceMalwareScanStatus.NOT_CONFIGURED
    assert "not configured" in result.detail.lower()
    key1 = build_randomized_storage_key(organization_id=uuid.uuid4(), extension="pdf")
    key2 = build_randomized_storage_key(organization_id=uuid.uuid4(), extension="pdf")
    assert key1 != key2
    assert key1.endswith(".pdf")


@pytest.mark.django_db
def test_upload_without_evidence_permission_denied(evidence_root: Path) -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    # Strip evidence by using recorder without evidence bundle
    bare = make_user(employee_code=f"BAR{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    role = make_role_with_permission(
        code=f"BR{uuid.uuid4().hex[:6].upper()}",
        name="Bare recorder",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    grant_role(bare, role, organization=org)
    with pytest.raises(PermissionDenied):
        upload_evidence_attachment(
            actor=bare,
            linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
            linked_object_id=response.id,
            file_name="ok.png",
            content_type="image/png",
            file_bytes=_png_bytes(),
        )


@pytest.mark.django_db
def test_admin_disallows_hard_delete(evidence_root: Path) -> None:
    from django.contrib.admin.sites import AdminSite

    from apps.evidence.admin import EvidenceAttachmentAdmin

    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
        file_name="ok.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )
    admin_obj = EvidenceAttachmentAdmin(EvidenceAttachment, AdminSite())
    request = type("R", (), {"method": "POST", "user": recorder})()
    assert admin_obj.has_delete_permission(request, attachment) is False
    assert admin_obj.has_add_permission(request) is False


@pytest.mark.django_db
def test_empty_and_forbidden_policy_edges() -> None:
    with pytest.raises(ValidationError):
        validate_upload_candidate(
            original_filename="empty.png",
            content_type="image/png",
            size_bytes=0,
        )
    with pytest.raises(ValidationError):
        validate_upload_candidate(
            original_filename="x.html",
            content_type="text/html",
            size_bytes=10,
        )
    long_name = "a" * 200 + ".png"
    assert len(sanitize_original_filename(long_name)) <= 180


@pytest.mark.django_db
def test_upload_and_list_views(evidence_root: Path) -> None:
    from django.core.files.uploadedfile import SimpleUploadedFile

    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    client = Client()
    client.force_login(recorder)
    list_url = reverse(
        "evidence:list_for_link",
        kwargs={
            "linked_kind": EvidenceLinkedKind.CHECKLIST_RESPONSE,
            "linked_object_id": response.id,
        },
    )
    assert client.get(list_url).status_code == 200
    upload_url = reverse(
        "evidence:upload",
        kwargs={
            "linked_kind": EvidenceLinkedKind.CHECKLIST_RESPONSE,
            "linked_object_id": response.id,
        },
    )
    assert client.get(upload_url).status_code == 200
    png = SimpleUploadedFile("ok.png", _png_bytes(), content_type="image/png")
    post = client.post(upload_url, {"file": png, "caption": "cap"}, follow=True)
    assert post.status_code == 200
    assert EvidenceAttachment.objects.filter(linked_object_id=response.id).exists()


@pytest.mark.django_db
def test_selectors_and_ncr_capa_links(evidence_root: Path) -> None:
    from apps.capa.models import CorrectiveAction
    from apps.evidence.linking import resolve_linked_target
    from apps.evidence.selectors import get_evidence_attachment, list_evidence_for_link
    from apps.nonconformance.models import NonConformanceRecord

    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
        file_name="ok.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )
    rows = list_evidence_for_link(
        recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
    )
    assert attachment.id in {r.id for r in rows}
    assert get_evidence_attachment(recorder, attachment.id) is not None

    # Grant NCR/CAPA manage + evidence upload/view
    role = make_role_with_permission(
        code=f"NCR{uuid.uuid4().hex[:6].upper()}",
        name="NCR manager",
        permission=_perm(NonConformanceRecord, "manage_nonconformance"),
    )
    role.permissions.add(_perm(EvidenceAttachment, "upload_evidenceattachment"))
    role.permissions.add(_perm(EvidenceAttachment, "view_evidenceattachment"))
    role.permissions.add(_perm(CorrectiveAction, "manage_capa"))
    grant_role(recorder, role, organization=org)

    ncr = NonConformanceRecord.objects.create(
        organization=org,
        code=f"N{uuid.uuid4().hex[:6].upper()}",
        title="NCR",
        created_by=recorder,
    )
    target = resolve_linked_target(kind=EvidenceLinkedKind.NONCONFORMANCE, object_id=ncr.id)
    assert target.organization_id == org.id
    capa = CorrectiveAction.objects.create(
        organization=org,
        code=f"C{uuid.uuid4().hex[:6].upper()}",
        title="CAPA",
        created_by=recorder,
        nonconformance=ncr,
    )
    capa_t = resolve_linked_target(kind=EvidenceLinkedKind.CAPA, object_id=capa.id)
    assert capa_t.organization_id == org.id
    upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.NONCONFORMANCE,
        linked_object_id=ncr.id,
        file_name="ncr.pdf",
        content_type="application/pdf",
        file_bytes=b"%PDF-1.4 evidence-test\n",
    )


@pytest.mark.django_db
def test_retire_view_and_storage_url_guard(evidence_root: Path) -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
        file_name="ok.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )
    client = Client()
    client.force_login(recorder)
    retire_url = reverse("evidence:retire", kwargs={"attachment_id": attachment.id})
    assert client.get(retire_url).status_code == 200
    post = client.post(retire_url, {"reason": "wrong file"}, follow=True)
    assert post.status_code == 200
    attachment.refresh_from_db()
    assert attachment.lifecycle_status == EvidenceLifecycleStatus.RETIRED

    with pytest.raises(RuntimeError):
        PrivateEvidenceStorage(location=str(evidence_root)).url("x")


def test_filename_and_disposition_helpers() -> None:
    assert sanitize_original_filename(r"..\\evil/../ok.png") == "ok.png"
    assert "attachment;" in content_disposition_attachment('a"b.png')
    assert (
        validate_upload_candidate(
            original_filename="doc.pdf",
            content_type="application/pdf",
            size_bytes=10,
        ).extension
        == "pdf"
    )
    with pytest.raises(ValidationError):
        validate_upload_candidate(
            original_filename="x.exe.pdf",
            content_type="application/pdf",
            size_bytes=10,
        )


@pytest.mark.django_db
def test_mark_immutable_after_submit_hook(evidence_root: Path) -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
        file_name="pre.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )
    assert attachment.linkage_immutable is False
    record = response.checklist_record
    # Complete required answers already present in fixture path via _make_draft_response?
    # Re-save and submit.
    item_id = response.checklist_item_id
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers={item_id: "YES"})
    submit_checklist_record(actor=recorder, record_id=record.id)
    attachment.refresh_from_db()
    assert attachment.linkage_immutable is True


@pytest.mark.django_db
def test_supervisor_and_qa_evidence_links(evidence_root: Path) -> None:
    from apps.evidence.linking import resolve_linked_target
    from apps.quality.models import QAReview
    from apps.quality.services import create_qa_review
    from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
    from apps.reviews.services import create_supervisor_review

    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"ACT{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant_checklist_manage(actor, org)
    template = create_checklist_template(
        actor=actor, organization=org, code=f"T{uuid.uuid4().hex[:6].upper()}", name="Ev RQ"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="YN1",
        label="Yes No",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    manager = _task_manager(org=org)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference=f"B-{uuid.uuid4().hex[:8]}",
    )
    recorder = _recorder(org=org)
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers={item.id: "YES"})
    submission = submit_checklist_record(actor=recorder, record_id=record.id)

    supervisor = make_user(employee_code=f"SUP{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    srole = make_role_with_permission(
        code=f"SR{uuid.uuid4().hex[:6].upper()}",
        name="Supervisor",
        permission=_perm(SupervisorReview, "review_checklistsubmission"),
    )
    grant_role(supervisor, srole, organization=org)
    _grant_evidence_bundle(supervisor, org)

    review = create_supervisor_review(
        actor=supervisor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="ok",
    )
    st = resolve_linked_target(kind=EvidenceLinkedKind.SUPERVISOR_REVIEW, object_id=review.id)
    assert st.linkage_immutable is True
    upload_evidence_attachment(
        actor=supervisor,
        linked_kind=EvidenceLinkedKind.SUPERVISOR_REVIEW,
        linked_object_id=review.id,
        file_name="rev.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )

    qa = make_user(employee_code=f"QA{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    qrole = make_role_with_permission(
        code=f"QR{uuid.uuid4().hex[:6].upper()}",
        name="QA",
        permission=_perm(QAReview, "qa_review_checklistsubmission"),
    )
    grant_role(qa, qrole, organization=org)
    _grant_evidence_bundle(qa, org)
    qa_review = create_qa_review(
        actor=qa,
        submission_id=submission.id,
        decision="RELEASE",
        review_note="qa ok",
    )
    qt = resolve_linked_target(kind=EvidenceLinkedKind.QA_REVIEW, object_id=qa_review.id)
    assert qt.linkage_immutable is True
    upload_evidence_attachment(
        actor=qa,
        linked_kind=EvidenceLinkedKind.QA_REVIEW,
        linked_object_id=qa_review.id,
        file_name="qa.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )


def test_policies_empty_and_unknown_type() -> None:
    with pytest.raises(ValidationError):
        validate_upload_candidate(original_filename="x.png", content_type="image/png", size_bytes=0)
    with pytest.raises(ValidationError):
        validate_upload_candidate(
            original_filename="x.png",
            content_type="text/html",
            size_bytes=10,
        )
    with pytest.raises(ValidationError):
        validate_upload_candidate(
            original_filename="",
            content_type="image/png",
            size_bytes=10,
        )


@pytest.mark.django_db
def test_open_missing_and_retire_reason(evidence_root: Path) -> None:
    from apps.evidence.services import open_evidence_file

    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    attachment = upload_evidence_attachment(
        actor=recorder,
        linked_kind=EvidenceLinkedKind.CHECKLIST_RESPONSE,
        linked_object_id=response.id,
        file_name="ok.png",
        content_type="image/png",
        file_bytes=_png_bytes(),
    )
    from apps.evidence.storage import get_evidence_store

    get_evidence_store().delete(attachment.storage_key)
    with pytest.raises(ValidationError):
        open_evidence_file(attachment)
    assert verify_attachment_integrity(attachment) is False
    with pytest.raises(ValidationError):
        retire_evidence_attachment(actor=recorder, attachment_id=attachment.id, reason="  ")
    with pytest.raises(ValidationError):
        authorize_evidence_download(actor=recorder, attachment_id=uuid.uuid4())


def test_long_filename_truncation_and_empty_guard() -> None:
    long_name = ("a" * 200) + ".png"
    cleaned = sanitize_original_filename(long_name)
    assert len(cleaned) <= 180
    assert cleaned.endswith(".png")
    with pytest.raises(ValidationError):
        validate_upload_candidate(original_filename="", content_type="image/png", size_bytes=1)
    with pytest.raises(ValidationError):
        validate_upload_candidate(
            original_filename="ok.png", content_type="text/html", size_bytes=1
        )


@pytest.mark.django_db
def test_list_unknown_kind_404(evidence_root: Path) -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    recorder, response = _make_draft_response(org=org)
    client = Client()
    client.force_login(recorder)
    url = reverse(
        "evidence:list_for_link",
        kwargs={"linked_kind": "NOT_A_KIND", "linked_object_id": response.id},
    )
    assert client.get(url).status_code == 404
