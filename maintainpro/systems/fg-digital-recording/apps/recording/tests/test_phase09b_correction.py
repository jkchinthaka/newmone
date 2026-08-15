"""Phase 09B — controlled checklist correction and resubmission tests."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.admin.sites import AdminSite
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
from apps.recording.admin import ChecklistCorrectionAdmin
from apps.recording.correction_services import (
    resubmit_checklist_correction,
    start_checklist_correction,
)
from apps.recording.models import (
    ChecklistCorrection,
    ChecklistCorrectionStatus,
    ChecklistRecordStatus,
    ChecklistResponse,
    ChecklistSubmission,
    ChecklistSubmissionResponse,
)
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.reviews.selectors import list_supervisor_reviewable_submissions
from apps.reviews.services import create_supervisor_review
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
from apps.scheduling.services import cancel_checklist_task, create_batch_checklist_task
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
    optional = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="OPT1",
        label="Optional Text",
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
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
        "optional": optional,
        "number": number,
        "select": select,
        "opt_a": opt_a,
    }


def _answers(defs: dict[str, Any], *, number: str = "5") -> dict[uuid.UUID, Any]:
    return {
        defs["yes_no"].id: "YES",
        defs["number"].id: number,
        defs["select"].id: str(defs["opt_a"].id),
    }


def _returned_submission(*, org: Organization | None = None) -> dict[str, Any]:
    org = org or make_org()
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    reviewer = _reviewer(org=org)
    defs = _make_published(actor=manager, org=org, code=f"C{uuid.uuid4().hex[:6].upper()}")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=defs["template"].id,
        checklist_version_id=defs["version"].id,
        batch_reference=f"BATCH-{uuid.uuid4().hex[:8].upper()}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers=_answers(defs))
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    review = create_supervisor_review(
        actor=reviewer,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        review_note="Please correct temperature entry.",
    )
    return {
        "org": org,
        "manager": manager,
        "recorder": recorder,
        "reviewer": reviewer,
        "defs": defs,
        "task": task,
        "record": record,
        "submission": submission,
        "review": review,
    }


@pytest.mark.django_db
def test_correction_model_defaults_and_identity() -> None:
    ctx = _returned_submission()
    correction = start_checklist_correction(
        actor=ctx["recorder"], source_submission_id=ctx["submission"].id
    )
    assert correction.status == ChecklistCorrectionStatus.DRAFT
    assert correction.source_submission_id == ctx["submission"].id
    assert correction.organization_id == ctx["org"].id
    assert correction.checklist_record_id == ctx["record"].id
    assert correction.resulting_submission_id is None
    with pytest.raises(ValidationError):
        ChecklistCorrection(
            organization=ctx["org"],
            checklist_record=ctx["record"],
            source_submission=ctx["submission"],
            started_by=ctx["recorder"],
        ).full_clean()


@pytest.mark.django_db
def test_start_correction_clones_snapshot_and_is_idempotent() -> None:
    ctx = _returned_submission()
    snap_count = ChecklistSubmissionResponse.objects.filter(
        checklist_submission_id=ctx["submission"].id
    ).count()
    correction = start_checklist_correction(
        actor=ctx["recorder"], source_submission_id=ctx["submission"].id
    )
    working = list(ChecklistResponse.objects.filter(checklist_record_id=ctx["record"].id))
    assert len(working) == snap_count
    # Optional unanswered remains unanswered.
    assert not any(r.checklist_item_id == ctx["defs"]["optional"].id for r in working)

    save_checklist_draft_responses(
        actor=ctx["recorder"],
        record_id=ctx["record"].id,
        answers={ctx["defs"]["yes_no"].id: "NO"},
    )
    again = start_checklist_correction(
        actor=ctx["recorder"], source_submission_id=ctx["submission"].id
    )
    assert again.id == correction.id
    yn = ChecklistResponse.objects.get(
        checklist_record_id=ctx["record"].id,
        checklist_item_id=ctx["defs"]["yes_no"].id,
    )
    assert yn.choice_value == "NO"


@pytest.mark.django_db
def test_start_rejects_approved_unreviewed_non_latest_and_wrong_perms() -> None:
    ctx = _returned_submission()
    other_org = make_org(code=f"O{uuid.uuid4().hex[:6].upper()}")
    foreign_recorder = _recorder(org=other_org)
    manager_only = ctx["manager"]
    reviewer_only = ctx["reviewer"]

    with pytest.raises(PermissionDenied):
        start_checklist_correction(actor=manager_only, source_submission_id=ctx["submission"].id)
    with pytest.raises(PermissionDenied):
        start_checklist_correction(actor=reviewer_only, source_submission_id=ctx["submission"].id)
    with pytest.raises((PermissionDenied, ValidationError)):
        start_checklist_correction(
            actor=foreign_recorder, source_submission_id=ctx["submission"].id
        )

    # APPROVED path
    org2 = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    manager = _task_manager(org=org2)
    recorder = _recorder(org=org2)
    reviewer = _reviewer(org=org2)
    defs = _make_published(actor=manager, org=org2, code=f"AP{uuid.uuid4().hex[:5].upper()}")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org2.id,
        checklist_template_id=defs["template"].id,
        checklist_version_id=defs["version"].id,
        batch_reference=f"B-AP-{uuid.uuid4().hex[:6]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers=_answers(defs))
    approved_sub = submit_checklist_record(actor=recorder, record_id=record.id)
    create_supervisor_review(
        actor=reviewer,
        submission_id=approved_sub.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    with pytest.raises(ValidationError):
        start_checklist_correction(actor=recorder, source_submission_id=approved_sub.id)

    # Unreviewed submission
    org3 = make_org(code=f"U{uuid.uuid4().hex[:6].upper()}")
    manager = _task_manager(org=org3)
    recorder = _recorder(org=org3)
    defs = _make_published(actor=manager, org=org3, code=f"UR{uuid.uuid4().hex[:5].upper()}")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org3.id,
        checklist_template_id=defs["template"].id,
        checklist_version_id=defs["version"].id,
        batch_reference=f"B-UR-{uuid.uuid4().hex[:6]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers=_answers(defs))
    unreviewed = submit_checklist_record(actor=recorder, record_id=record.id)
    with pytest.raises(ValidationError):
        start_checklist_correction(actor=recorder, source_submission_id=unreviewed.id)


@pytest.mark.django_db
def test_cancelled_task_cannot_start_correction() -> None:
    ctx = _returned_submission()
    cancel_checklist_task(actor=ctx["manager"], task_id=ctx["task"].id)
    with pytest.raises(ValidationError):
        start_checklist_correction(actor=ctx["recorder"], source_submission_id=ctx["submission"].id)


@pytest.mark.django_db
def test_submitted_without_correction_cannot_save() -> None:
    ctx = _returned_submission()
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=ctx["recorder"],
            record_id=ctx["record"].id,
            answers={ctx["defs"]["yes_no"].id: "NO"},
        )


@pytest.mark.django_db
def test_correction_save_and_resubmit_full_snapshot() -> None:
    ctx = _returned_submission()
    source = ctx["submission"]
    source_snap = list(
        ChecklistSubmissionResponse.objects.filter(checklist_submission_id=source.id).values_list(
            "id", "choice_value", "number_value", "text_value"
        )
    )
    review_note = ctx["review"].review_note

    correction = start_checklist_correction(actor=ctx["recorder"], source_submission_id=source.id)
    save_checklist_draft_responses(
        actor=ctx["recorder"],
        record_id=ctx["record"].id,
        answers={
            ctx["defs"]["yes_no"].id: "NO",
            ctx["defs"]["number"].id: "99",  # out of range allowed
            ctx["defs"]["select"].id: str(ctx["defs"]["opt_a"].id),
            ctx["defs"]["optional"].id: "optional now answered",
        },
    )
    # Incomplete if required cleared
    save_checklist_draft_responses(
        actor=ctx["recorder"],
        record_id=ctx["record"].id,
        answers={ctx["defs"]["yes_no"].id: ""},
    )
    with pytest.raises(ValidationError):
        resubmit_checklist_correction(actor=ctx["recorder"], correction_id=correction.id)

    save_checklist_draft_responses(
        actor=ctx["recorder"],
        record_id=ctx["record"].id,
        answers={
            ctx["defs"]["yes_no"].id: "NO",
            ctx["defs"]["number"].id: "99",
            ctx["defs"]["select"].id: str(ctx["defs"]["opt_a"].id),
            ctx["defs"]["optional"].id: "optional now answered",
        },
    )
    resulting = resubmit_checklist_correction(actor=ctx["recorder"], correction_id=correction.id)
    assert resulting.submission_number == 2
    correction.refresh_from_db()
    assert correction.status == ChecklistCorrectionStatus.RESUBMITTED
    assert correction.resulting_submission_id == resulting.id

    ctx["record"].refresh_from_db()
    ctx["task"].refresh_from_db()
    assert ctx["record"].status == ChecklistRecordStatus.SUBMITTED
    assert ctx["task"].status == ChecklistTaskStatus.PENDING

    source.refresh_from_db()
    assert source.submission_number == 1
    assert (
        list(
            ChecklistSubmissionResponse.objects.filter(
                checklist_submission_id=source.id
            ).values_list("id", "choice_value", "number_value", "text_value")
        )
        == source_snap
    )
    ctx["review"].refresh_from_db()
    assert ctx["review"].decision == SupervisorReviewDecision.RETURNED_FOR_CORRECTION
    assert ctx["review"].review_note == review_note

    snap2 = ChecklistSubmissionResponse.objects.filter(checklist_submission_id=resulting.id)
    assert snap2.count() == 4  # includes answered optional
    assert snap2.filter(checklist_item_id=ctx["defs"]["optional"].id).exists()
    yn2 = snap2.get(checklist_item_id=ctx["defs"]["yes_no"].id)
    assert yn2.choice_value == "NO"
    num2 = snap2.get(checklist_item_id=ctx["defs"]["number"].id)
    assert num2.number_value == Decimal("99.0000")

    # Idempotent resubmit
    again = resubmit_checklist_correction(actor=ctx["recorder"], correction_id=correction.id)
    assert again.id == resulting.id
    assert ChecklistSubmission.objects.filter(checklist_record_id=ctx["record"].id).count() == 2

    # Queue: #1 out, #2 in
    queue = list(list_supervisor_reviewable_submissions(ctx["reviewer"]))
    assert all(s.id != source.id for s in queue)
    assert any(s.id == resulting.id for s in queue)

    # Post-resubmit edits blocked until new return cycle
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=ctx["recorder"],
            record_id=ctx["record"].id,
            answers={ctx["defs"]["yes_no"].id: "YES"},
        )

    # Old source cannot start another correction
    with pytest.raises(ValidationError):
        start_checklist_correction(actor=ctx["recorder"], source_submission_id=source.id)

    # Audit events omit note/values
    started = SecurityAuditEvent.objects.filter(event_type="CHECKLIST_CORRECTION_STARTED").latest(
        "created_at"
    )
    resubmitted = SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_CORRECTION_RESUBMITTED"
    ).latest("created_at")
    for event in (started, resubmitted):
        blob = str(event.metadata)
        assert "Please correct" not in blob
        assert "optional now answered" not in blob
        assert "temperature entry" not in blob


@pytest.mark.django_db
def test_chain_submission_two_to_three() -> None:
    ctx = _returned_submission()
    c1 = start_checklist_correction(
        actor=ctx["recorder"], source_submission_id=ctx["submission"].id
    )
    save_checklist_draft_responses(
        actor=ctx["recorder"],
        record_id=ctx["record"].id,
        answers=_answers(ctx["defs"], number="6"),
    )
    sub2 = resubmit_checklist_correction(actor=ctx["recorder"], correction_id=c1.id)
    assert sub2.submission_number == 2
    create_supervisor_review(
        actor=ctx["reviewer"],
        submission_id=sub2.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
    )
    c2 = start_checklist_correction(actor=ctx["recorder"], source_submission_id=sub2.id)
    save_checklist_draft_responses(
        actor=ctx["recorder"],
        record_id=ctx["record"].id,
        answers=_answers(ctx["defs"], number="7"),
    )
    sub3 = resubmit_checklist_correction(actor=ctx["recorder"], correction_id=c2.id)
    assert sub3.submission_number == 3
    assert ChecklistSubmission.objects.filter(checklist_record_id=ctx["record"].id).count() == 3


@pytest.mark.django_db
def test_ui_flow_csrf_and_admin_readonly(client: Client) -> None:
    ctx = _returned_submission()
    client.force_login(ctx["recorder"])
    returned_url = reverse(
        "recording:returned_submission", kwargs={"submission_id": ctx["submission"].id}
    )
    assert client.get(returned_url).status_code == 200
    assert (
        client.get(
            reverse("recording:start_correction", kwargs={"submission_id": ctx["submission"].id})
        ).status_code
        == 405
    )
    start = client.post(
        reverse("recording:start_correction", kwargs={"submission_id": ctx["submission"].id})
    )
    assert start.status_code == 302
    correction = ChecklistCorrection.objects.get(source_submission_id=ctx["submission"].id)
    editor = client.get(
        reverse("recording:correction_detail", kwargs={"correction_id": correction.id})
    )
    assert editor.status_code == 200
    assert b"CORRECTION DRAFT" in editor.content
    assert b"Please correct temperature entry." in editor.content

    # Completeness path then resubmit POST only
    assert (
        client.get(
            reverse("recording:correction_resubmit", kwargs={"correction_id": correction.id})
        ).status_code
        == 200
    )
    save_checklist_draft_responses(
        actor=ctx["recorder"],
        record_id=ctx["record"].id,
        answers=_answers(ctx["defs"], number="4"),
    )
    resubmit = client.post(
        reverse("recording:correction_resubmit", kwargs={"correction_id": correction.id})
    )
    assert resubmit.status_code == 302
    history = client.get(
        reverse("recording:record_history", kwargs={"record_id": ctx["record"].id})
    )
    assert history.status_code == 200
    assert b"Submission #1" in history.content
    assert b"Submission #2" in history.content

    admin = ChecklistCorrectionAdmin(ChecklistCorrection, AdminSite())
    request = type("R", (), {"method": "GET", "user": ctx["recorder"]})()
    assert admin.has_add_permission(request) is False
    assert admin.has_delete_permission(request) is False
    assert admin.has_change_permission(request) is True
    request_post = type("R", (), {"method": "POST", "user": ctx["recorder"]})()
    assert admin.has_change_permission(request_post) is False

    # Cross-org IDOR
    foreign = _recorder(org=make_org(code=f"X{uuid.uuid4().hex[:6].upper()}"))
    client.force_login(foreign)
    assert client.get(returned_url).status_code == 403


@pytest.mark.django_db
def test_correction_editor_query_bound(client: Client) -> None:
    ctx = _returned_submission()
    correction = start_checklist_correction(
        actor=ctx["recorder"], source_submission_id=ctx["submission"].id
    )
    client.force_login(ctx["recorder"])
    url = reverse("recording:correction_detail", kwargs={"correction_id": correction.id})
    with CaptureQueriesContext(connection) as ctxq:
        response = client.get(url)
    assert response.status_code == 200
    assert len(ctxq) < 75


@pytest.mark.django_db
def test_resubmitted_correction_is_read_only() -> None:
    ctx = _returned_submission()
    correction = start_checklist_correction(
        actor=ctx["recorder"], source_submission_id=ctx["submission"].id
    )
    save_checklist_draft_responses(
        actor=ctx["recorder"],
        record_id=ctx["record"].id,
        answers=_answers(ctx["defs"]),
    )
    resulting = resubmit_checklist_correction(actor=ctx["recorder"], correction_id=correction.id)
    correction.refresh_from_db()
    assert correction.status == ChecklistCorrectionStatus.RESUBMITTED
    assert correction.resulting_submission_id == resulting.id
    # Reverse DRAFT reopen is not provided — duplicate resubmit stays idempotent.
    again = resubmit_checklist_correction(actor=ctx["recorder"], correction_id=correction.id)
    assert again.id == resulting.id
    assert ChecklistSubmission.objects.filter(checklist_record_id=ctx["record"].id).count() == 2


class ConcurrentCorrectionTests(TransactionTestCase):
    def test_concurrent_start_one_correction(self) -> None:
        ctx = _returned_submission()
        results: list[uuid.UUID] = []

        def _start() -> None:
            with transaction.atomic():
                correction = start_checklist_correction(
                    actor=ctx["recorder"], source_submission_id=ctx["submission"].id
                )
                results.append(correction.id)

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(_start), pool.submit(_start)]
            for future in futures:
                future.result()
        assert len(set(results)) == 1
        assert (
            ChecklistCorrection.objects.filter(source_submission_id=ctx["submission"].id).count()
            == 1
        )

    def test_concurrent_resubmit_one_submission(self) -> None:
        ctx = _returned_submission()
        correction = start_checklist_correction(
            actor=ctx["recorder"], source_submission_id=ctx["submission"].id
        )
        save_checklist_draft_responses(
            actor=ctx["recorder"],
            record_id=ctx["record"].id,
            answers=_answers(ctx["defs"]),
        )
        results: list[uuid.UUID] = []

        def _resubmit() -> None:
            with transaction.atomic():
                submission = resubmit_checklist_correction(
                    actor=ctx["recorder"], correction_id=correction.id
                )
                results.append(submission.id)

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(_resubmit), pool.submit(_resubmit)]
            for future in futures:
                future.result()
        assert len(set(results)) == 1
        assert ChecklistSubmission.objects.filter(checklist_record_id=ctx["record"].id).count() == 2
