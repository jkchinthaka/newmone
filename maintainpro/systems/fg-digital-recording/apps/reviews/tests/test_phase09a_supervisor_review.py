"""Phase 09A — immutable Supervisor review foundation tests."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import connection, transaction
from django.test import Client, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_item_option,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.organizations.models import Organization
from apps.quality.models import QAReview
from apps.recording.models import (
    ChecklistRecordStatus,
    ChecklistSubmission,
    ChecklistSubmissionResponse,
)
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.reviews.admin import SupervisorReviewAdmin
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.reviews.selectors import (
    get_supervisor_review,
    list_supervisor_reviewable_submissions,
    load_submission_review_context,
)
from apps.reviews.services import REVIEW_CHECKLIST_SUBMISSION, create_supervisor_review
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
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


def _recorder(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"REC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RECR{suffix}",
        name=f"Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    grant_role(user, role, organization=org)
    return user


def _reviewer(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"RVW{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RVWR{suffix}",
        name=f"Reviewer {suffix}",
        permission=_perm(SupervisorReview, "review_checklistsubmission"),
    )
    grant_role(user, role, organization=org)
    return user


def _make_published(*, actor: User, org: Organization, code: str) -> dict[str, Any]:
    _grant_checklist_manage(actor, org)
    template = create_checklist_template(
        actor=actor, organization=org, code=code, name=f"{code} Name"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Section A")
    yes_no = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="YN1",
        label="Yes No Item",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    number = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="NUM1",
        label="Number Item",
        response_type=ChecklistResponseType.NUMBER,
        unit="C",
        minimum_value=Decimal("0"),
        maximum_value=Decimal("10"),
        is_required=True,
    )
    text = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="TXT1",
        label="Text Item",
        response_type=ChecklistResponseType.TEXT,
        is_required=True,
    )
    select = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="SEL1",
        label="Select Item",
        response_type=ChecklistResponseType.SELECT,
        is_required=True,
    )
    opt_a = add_checklist_item_option(actor=actor, item_id=select.id, value="A", label="Option A")
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return {
        "template": template,
        "version": published,
        "yes_no": yes_no,
        "number": number,
        "text": text,
        "select": select,
        "opt_a": opt_a,
    }


def _pending_task(
    *, manager: User, org: Organization, published: dict[str, Any], batch: str
) -> ChecklistTask:
    return create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=published["template"].id,
        checklist_version_id=published["version"].id,
        batch_reference=batch,
    )


def _answers(published: dict[str, Any]) -> dict[uuid.UUID, Any]:
    return {
        published["yes_no"].id: "NO",
        published["number"].id: "99.5",
        published["text"].id: "<b>note</b>",
        published["select"].id: str(published["opt_a"].id),
    }


def _submitted(
    *, org: Organization, batch: str = "BATCH-R01", code: str = "CHK-R01"
) -> dict[str, Any]:
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    published = _make_published(actor=manager, org=org, code=code)
    task = _pending_task(manager=manager, org=org, published=published, batch=batch)
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers=_answers(published))
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    return {
        "manager": manager,
        "recorder": recorder,
        "published": published,
        "task": task,
        "record": submission.checklist_record,
        "submission": submission,
    }


@pytest.mark.django_db
def test_supervisor_review_model_and_permission_boundary() -> None:
    org = make_org(code="ORG-R01")
    fixture = _submitted(org=org, batch="BATCH-R01", code="CHK-R01")
    reviewer = _reviewer(org=org)
    assert REVIEW_CHECKLIST_SUBMISSION == "reviews.review_checklistsubmission"

    review = create_supervisor_review(
        actor=reviewer,
        submission_id=fixture["submission"].id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="  ok  ",
    )
    assert review.organization_id == org.id
    assert review.decision == SupervisorReviewDecision.APPROVED
    assert review.review_note == "ok"
    assert review.checklist_submission_id == fixture["submission"].id

    with pytest.raises(ValidationError):
        bad = SupervisorReview(
            organization=make_org(code="ORG-R01B"),
            checklist_submission=fixture["submission"],
            decision=SupervisorReviewDecision.APPROVED,
            reviewed_by=reviewer,
        )
        bad.full_clean()


@pytest.mark.django_db
def test_create_supervisor_review_authz_and_boundaries() -> None:
    org_a = make_org(code="ORG-R02A")
    org_b = make_org(code="ORG-R02B")
    fixture = _submitted(org=org_a, batch="BATCH-R02", code="CHK-R02")
    submission = fixture["submission"]
    reviewer = _reviewer(org=org_a)
    foreign_reviewer = _reviewer(org=org_b)
    recorder = fixture["recorder"]
    manager = fixture["manager"]

    with pytest.raises(PermissionDenied):
        create_supervisor_review(
            actor=recorder,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.APPROVED,
        )
    with pytest.raises(PermissionDenied):
        create_supervisor_review(
            actor=manager,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.APPROVED,
        )
    with pytest.raises(PermissionDenied):
        create_supervisor_review(
            actor=foreign_reviewer,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.APPROVED,
        )

    approved = create_supervisor_review(
        actor=reviewer,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    assert SupervisorReview.objects.filter(checklist_submission=submission).count() == 1

    same = create_supervisor_review(
        actor=reviewer,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    assert same.id == approved.id

    with pytest.raises(ValidationError) as exc:
        create_supervisor_review(
            actor=reviewer,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        )
    assert "immutable" in str(exc.value).lower() or "already" in str(exc.value).lower()

    # APPROVED must not create QA / HOLD / RELEASE / task completion / reopen.
    submission.refresh_from_db()
    record = submission.checklist_record
    record.refresh_from_db()
    task = record.checklist_task
    task.refresh_from_db()
    assert record.status == ChecklistRecordStatus.SUBMITTED
    assert task.status == ChecklistTaskStatus.PENDING
    assert not QAReview.objects.filter(supervisor_review_id=approved.id).exists()
    assert ChecklistSubmission.objects.filter(checklist_record=record).count() == 1

    event = SecurityAuditEvent.objects.filter(event_type="SUPERVISOR_REVIEW_COMPLETED").latest(
        "created_at"
    )
    meta = event.metadata
    assert meta["decision"] == SupervisorReviewDecision.APPROVED
    assert "review_note" not in meta
    assert "<b>note</b>" not in str(meta)
    assert "99.5" not in str(meta)


@pytest.mark.django_db
def test_returned_for_correction_does_not_mutate_submission() -> None:
    org = make_org(code="ORG-R03")
    fixture = _submitted(org=org, batch="BATCH-R03", code="CHK-R03")
    reviewer = _reviewer(org=org)
    submission = fixture["submission"]
    before_count = ChecklistSubmissionResponse.objects.filter(
        checklist_submission=submission
    ).count()
    text_snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission=submission, checklist_item=fixture["published"]["text"]
    )
    original_text = text_snap.text_value

    review = create_supervisor_review(
        actor=reviewer,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        review_note="<script>x</script>",
    )
    assert review.decision == SupervisorReviewDecision.RETURNED_FOR_CORRECTION

    submission.refresh_from_db()
    record = submission.checklist_record
    record.refresh_from_db()
    task = record.checklist_task
    task.refresh_from_db()
    text_snap.refresh_from_db()

    assert record.status == ChecklistRecordStatus.SUBMITTED
    assert task.status == ChecklistTaskStatus.PENDING
    assert ChecklistSubmission.objects.filter(checklist_record=record).count() == 1
    assert (
        ChecklistSubmissionResponse.objects.filter(checklist_submission=submission).count()
        == before_count
    )
    assert text_snap.text_value == original_text


@pytest.mark.django_db
def test_review_immutability_and_admin_readonly() -> None:
    org = make_org(code="ORG-R04")
    fixture = _submitted(org=org, batch="BATCH-R04", code="CHK-R04")
    reviewer = _reviewer(org=org)
    review = create_supervisor_review(
        actor=reviewer,
        submission_id=fixture["submission"].id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="first",
    )
    # No update/delete services — admin blocks writes.
    from django.contrib.admin.sites import AdminSite
    from django.test import RequestFactory

    admin = SupervisorReviewAdmin(SupervisorReview, AdminSite())
    request = RequestFactory().get("/admin/")
    request.user = reviewer
    assert admin.has_add_permission(request) is False
    assert admin.has_delete_permission(request, review) is False
    assert admin.has_change_permission(request, review) is True  # GET allowed
    post = RequestFactory().post("/admin/")
    post.user = reviewer
    assert admin.has_change_permission(post, review) is False

    # Service layer does not expose mutation; re-create with different decision conflicts.
    with pytest.raises(ValidationError):
        create_supervisor_review(
            actor=reviewer,
            submission_id=fixture["submission"].id,
            decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        )
    review.refresh_from_db()
    assert review.decision == SupervisorReviewDecision.APPROVED
    assert review.review_note == "first"


@pytest.mark.django_db
def test_queue_selectors_and_ui_csrf_idor() -> None:
    org_a = make_org(code="ORG-R05A")
    org_b = make_org(code="ORG-R05B")
    fixture_a = _submitted(org=org_a, batch="BATCH-R05A", code="CHK-R05A")
    fixture_b = _submitted(org=org_b, batch="BATCH-R05B", code="CHK-R05B")
    reviewer = _reviewer(org=org_a)
    recorder = fixture_a["recorder"]

    queue = list(list_supervisor_reviewable_submissions(reviewer))
    assert fixture_a["submission"] in queue
    assert fixture_b["submission"] not in queue
    assert list(list_supervisor_reviewable_submissions(recorder)) == []

    create_supervisor_review(
        actor=reviewer,
        submission_id=fixture_a["submission"].id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    assert fixture_a["submission"] not in list(list_supervisor_reviewable_submissions(reviewer))

    client = Client()
    client.force_login(reviewer)
    queue_resp = client.get(reverse("reviews:queue"))
    assert queue_resp.status_code == 200
    assert b"No submissions are waiting" in queue_resp.content or b"BATCH-R05" in queue_resp.content

    # Foreign submission IDOR
    foreign = client.get(
        reverse("reviews:submission_detail", kwargs={"submission_id": fixture_b["submission"].id})
    )
    assert foreign.status_code in {403, 404}

    # Fresh submission for UI approve path
    fixture_c = _submitted(org=org_a, batch="BATCH-R05C", code="CHK-R05C")
    detail = client.get(
        reverse("reviews:submission_detail", kwargs={"submission_id": fixture_c["submission"].id})
    )
    assert detail.status_code == 200
    body = detail.content
    assert b"#1" in body or b"Submission" in body
    assert b"<b>note</b>" not in body or b"&lt;b&gt;note&lt;/b&gt;" in body
    assert b"Approve" in body
    assert b"Return for correction" in body
    assert b"QA Approve" not in body
    assert b"Release" not in body
    assert b"Hold" not in body
    assert b"Reject" not in body

    confirm_url = reverse(
        "reviews:confirm_decision",
        kwargs={
            "submission_id": fixture_c["submission"].id,
            "decision": SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        },
    )
    get_confirm = client.get(confirm_url)
    assert get_confirm.status_code == 200
    assert b"csrfmiddlewaretoken" in get_confirm.content

    post = client.post(confirm_url, {"review_note": "<img src=x onerror=alert(1)>"})
    assert post.status_code == 302
    review = SupervisorReview.objects.get(checklist_submission=fixture_c["submission"])
    result = client.get(reverse("reviews:review_result", kwargs={"review_id": review.id}))
    assert result.status_code == 200
    assert b"SUPERVISOR REVIEW COMPLETED" in result.content
    assert b"RETURNED FOR CORRECTION" in result.content
    assert b"<img src=x" not in result.content
    assert b"Confirm Approve" not in result.content
    assert b"Confirm Return" not in result.content
    assert b"QA Approve" not in result.content
    assert b">Release<" not in result.content
    assert b">Hold<" not in result.content
    assert b">Reject<" not in result.content

    # Recorder cannot access review UUID
    rec_client = Client()
    rec_client.force_login(recorder)
    denied = rec_client.get(reverse("reviews:review_result", kwargs={"review_id": review.id}))
    assert denied.status_code in {403, 404}

    with CaptureQueriesContext(connection) as ctx:
        load_submission_review_context(reviewer, fixture_c["submission"].id)
    assert len(ctx) < 40


@pytest.mark.django_db
def test_fg_qa_001_remains_draft_after_phase09a() -> None:
    from apps.checklists.models import ChecklistTemplate, ChecklistVersionStatus

    assert not ChecklistTemplate.objects.filter(
        code="FG-QA-001", versions__status=ChecklistVersionStatus.PUBLISHED
    ).exists()


class ConcurrentSupervisorReviewTests(TransactionTestCase):
    def test_concurrent_review_creates_one_row(self) -> None:
        org = make_org(code="ORG-R06")
        fixture = _submitted(org=org, batch="BATCH-R06", code="CHK-R06")
        reviewer_a = _reviewer(org=org)
        reviewer_b = _reviewer(org=org)
        submission_id = fixture["submission"].id

        def _run(actor: User) -> str:
            try:
                with transaction.atomic():
                    review = create_supervisor_review(
                        actor=actor,
                        submission_id=submission_id,
                        decision=SupervisorReviewDecision.APPROVED,
                    )
                return str(review.id)
            except ValidationError:
                existing = SupervisorReview.objects.get(checklist_submission_id=submission_id)
                return str(existing.id)

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(_run, [reviewer_a, reviewer_b]))

        assert len(set(results)) == 1
        assert SupervisorReview.objects.filter(checklist_submission_id=submission_id).count() == 1


@pytest.mark.django_db
def test_get_supervisor_review_cross_org_denied() -> None:
    org_a = make_org(code="ORG-R07A")
    org_b = make_org(code="ORG-R07B")
    fixture = _submitted(org=org_a, batch="BATCH-R07", code="CHK-R07")
    reviewer_a = _reviewer(org=org_a)
    reviewer_b = _reviewer(org=org_b)
    review = create_supervisor_review(
        actor=reviewer_a,
        submission_id=fixture["submission"].id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    with pytest.raises(PermissionDenied):
        get_supervisor_review(reviewer_b, review.id)
