"""Phase 10A — immutable QA review disposition foundation tests."""

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
from apps.quality.admin import QAReviewAdmin
from apps.quality.models import QAReview, QAReviewDecision
from apps.quality.selectors import list_qa_reviewable_submissions
from apps.quality.services import QA_REVIEW_CHECKLIST_SUBMISSION, create_qa_review
from apps.recording.correction_services import start_checklist_correction
from apps.recording.models import (
    ChecklistRecordStatus,
    ChecklistResponse,
)
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
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


def _supervisor(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"RVW{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RVWR{suffix}",
        name=f"Reviewer {suffix}",
        permission=_perm(SupervisorReview, "review_checklistsubmission"),
    )
    grant_role(user, role, organization=org)
    return user


def _qa_actor(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"QA{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"QAR{suffix}",
        name=f"QA Reviewer {suffix}",
        permission=_perm(QAReview, "qa_review_checklistsubmission"),
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
    yes_no_na = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="YNA1",
        label="Yes No NA Item",
        response_type=ChecklistResponseType.YES_NO_NA,
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
        "yes_no_na": yes_no_na,
        "number": number,
        "text": text,
        "select": select,
        "opt_a": opt_a,
    }


def _answers(defs: dict[str, Any]) -> dict[uuid.UUID, Any]:
    return {
        defs["yes_no"].id: "NO",
        defs["yes_no_na"].id: "NA",
        defs["number"].id: "99.5",
        defs["text"].id: "<b>note</b>",
        defs["select"].id: str(defs["opt_a"].id),
    }


def _approved_submission(*, org: Organization | None = None) -> dict[str, Any]:
    org = org or make_org(code=f"O{uuid.uuid4().hex[:6].upper()}")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    supervisor = _supervisor(org=org)
    qa = _qa_actor(org=org)
    defs = _make_published(actor=manager, org=org, code=f"Q{uuid.uuid4().hex[:6].upper()}")
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
    supervisor_review = create_supervisor_review(
        actor=supervisor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="Supervisor ok for QA",
    )
    return {
        "org": org,
        "manager": manager,
        "recorder": recorder,
        "supervisor": supervisor,
        "qa": qa,
        "defs": defs,
        "task": task,
        "record": record,
        "submission": submission,
        "supervisor_review": supervisor_review,
    }


@pytest.mark.django_db
def test_qa_permission_codename() -> None:
    assert QA_REVIEW_CHECKLIST_SUBMISSION == "quality.qa_review_checklistsubmission"


@pytest.mark.django_db
def test_model_and_decisions() -> None:
    ctx = _approved_submission()
    for decision in (
        QAReviewDecision.RELEASE,
        QAReviewDecision.HOLD,
        QAReviewDecision.REJECT,
    ):
        org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
        local = _approved_submission(org=org)
        review = create_qa_review(
            actor=local["qa"],
            submission_id=local["submission"].id,
            decision=decision,
        )
        assert review.decision == decision
        assert review.supervisor_review_id == local["supervisor_review"].id
        assert review.organization_id == org.id

    with pytest.raises(ValidationError):
        create_qa_review(
            actor=ctx["qa"],
            submission_id=ctx["submission"].id,
            decision="PASS",
        )


@pytest.mark.django_db
def test_eligibility_and_authorization() -> None:
    ctx = _approved_submission()
    queue = list(list_qa_reviewable_submissions(ctx["qa"]))
    assert any(s.id == ctx["submission"].id for s in queue)

    with pytest.raises(PermissionDenied):
        create_qa_review(
            actor=ctx["recorder"],
            submission_id=ctx["submission"].id,
            decision=QAReviewDecision.RELEASE,
        )
    with pytest.raises(PermissionDenied):
        create_qa_review(
            actor=ctx["supervisor"],
            submission_id=ctx["submission"].id,
            decision=QAReviewDecision.RELEASE,
        )
    with pytest.raises(PermissionDenied):
        create_qa_review(
            actor=ctx["manager"],
            submission_id=ctx["submission"].id,
            decision=QAReviewDecision.RELEASE,
        )

    foreign = _qa_actor(org=make_org(code=f"X{uuid.uuid4().hex[:6].upper()}"))
    with pytest.raises(PermissionDenied):
        create_qa_review(
            actor=foreign,
            submission_id=ctx["submission"].id,
            decision=QAReviewDecision.RELEASE,
        )


@pytest.mark.django_db
def test_rejects_returned_unreviewed_cancelled_and_old() -> None:
    # RETURNED
    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    supervisor = _supervisor(org=org)
    qa = _qa_actor(org=org)
    defs = _make_published(actor=manager, org=org, code=f"RT{uuid.uuid4().hex[:5].upper()}")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=defs["template"].id,
        checklist_version_id=defs["version"].id,
        batch_reference=f"B-RT-{uuid.uuid4().hex[:6]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers=_answers(defs))
    returned = submit_checklist_record(actor=recorder, record_id=record.id)
    create_supervisor_review(
        actor=supervisor,
        submission_id=returned.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
    )
    with pytest.raises(ValidationError):
        create_qa_review(actor=qa, submission_id=returned.id, decision=QAReviewDecision.RELEASE)
    assert returned.id not in {s.id for s in list_qa_reviewable_submissions(qa)}

    # Unreviewed
    ctx = _approved_submission()
    # create another org unreviewed
    org2 = make_org(code=f"U{uuid.uuid4().hex[:6].upper()}")
    manager = _task_manager(org=org2)
    recorder = _recorder(org=org2)
    qa2 = _qa_actor(org=org2)
    defs = _make_published(actor=manager, org=org2, code=f"UR{uuid.uuid4().hex[:5].upper()}")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org2.id,
        checklist_template_id=defs["template"].id,
        checklist_version_id=defs["version"].id,
        batch_reference=f"B-UR-{uuid.uuid4().hex[:6]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers=_answers(defs))
    unreviewed = submit_checklist_record(actor=recorder, record_id=record.id)
    with pytest.raises(ValidationError):
        create_qa_review(
            actor=qa2,
            submission_id=unreviewed.id,
            decision=QAReviewDecision.HOLD,
        )

    # Cancelled
    ctx = _approved_submission()
    cancel_checklist_task(actor=ctx["manager"], task_id=ctx["task"].id)
    with pytest.raises(ValidationError):
        create_qa_review(
            actor=ctx["qa"],
            submission_id=ctx["submission"].id,
            decision=QAReviewDecision.RELEASE,
        )


@pytest.mark.django_db
def test_release_boundaries_idempotency_audit_and_no_auto_disposition() -> None:
    ctx = _approved_submission()
    # Manual disposition only — responses include NO/NA/out-of-range/text and do not auto-create QA
    assert not QAReview.objects.filter(checklist_submission_id=ctx["submission"].id).exists()
    assert ChecklistResponse.objects.filter(checklist_record_id=ctx["record"].id).exists()

    review = create_qa_review(
        actor=ctx["qa"],
        submission_id=ctx["submission"].id,
        decision=QAReviewDecision.RELEASE,
        review_note="Provisional release note",
    )
    again = create_qa_review(
        actor=ctx["qa"],
        submission_id=ctx["submission"].id,
        decision=QAReviewDecision.RELEASE,
    )
    assert again.id == review.id
    with pytest.raises(ValidationError):
        create_qa_review(
            actor=ctx["qa"],
            submission_id=ctx["submission"].id,
            decision=QAReviewDecision.HOLD,
        )

    ctx["record"].refresh_from_db()
    ctx["task"].refresh_from_db()
    ctx["submission"].refresh_from_db()
    ctx["supervisor_review"].refresh_from_db()
    assert ctx["record"].status == ChecklistRecordStatus.SUBMITTED
    assert ctx["task"].status == ChecklistTaskStatus.PENDING
    assert ctx["supervisor_review"].decision == SupervisorReviewDecision.APPROVED

    # Correction not eligible from APPROVED+QA RELEASE
    with pytest.raises(ValidationError):
        start_checklist_correction(actor=ctx["recorder"], source_submission_id=ctx["submission"].id)

    event = SecurityAuditEvent.objects.filter(event_type="QA_REVIEW_COMPLETED").latest("created_at")
    blob = str(event.metadata)
    assert event.metadata["decision"] == "RELEASE"
    assert "Provisional release note" not in blob
    assert "Supervisor ok" not in blob
    assert "<b>note</b>" not in blob
    assert "99.5" not in blob

    assert review.id not in {s.id for s in list_qa_reviewable_submissions(ctx["qa"])}


@pytest.mark.django_db
def test_hold_and_reject_boundaries() -> None:
    hold_ctx = _approved_submission()
    hold = create_qa_review(
        actor=hold_ctx["qa"],
        submission_id=hold_ctx["submission"].id,
        decision=QAReviewDecision.HOLD,
    )
    hold_ctx["record"].refresh_from_db()
    hold_ctx["task"].refresh_from_db()
    assert hold.decision == QAReviewDecision.HOLD
    assert hold_ctx["record"].status == ChecklistRecordStatus.SUBMITTED
    assert hold_ctx["task"].status == ChecklistTaskStatus.PENDING
    with pytest.raises(ValidationError):
        start_checklist_correction(
            actor=hold_ctx["recorder"],
            source_submission_id=hold_ctx["submission"].id,
        )

    reject_ctx = _approved_submission()
    reject = create_qa_review(
        actor=reject_ctx["qa"],
        submission_id=reject_ctx["submission"].id,
        decision=QAReviewDecision.REJECT,
    )
    reject_ctx["record"].refresh_from_db()
    reject_ctx["task"].refresh_from_db()
    assert reject.decision == QAReviewDecision.REJECT
    assert reject_ctx["record"].status == ChecklistRecordStatus.SUBMITTED
    assert reject_ctx["task"].status == ChecklistTaskStatus.PENDING
    assert reject_ctx["task"].status != ChecklistTaskStatus.CANCELLED


@pytest.mark.django_db
def test_ui_flow_csrf_admin_and_queries(client: Client) -> None:
    ctx = _approved_submission()
    client.force_login(ctx["qa"])
    queue = client.get(reverse("quality:queue"))
    assert queue.status_code == 200
    assert b"QA Review Queue" in queue.content
    detail = client.get(
        reverse("quality:submission_detail", kwargs={"submission_id": ctx["submission"].id})
    )
    assert detail.status_code == 200
    assert b"RELEASE" in detail.content
    assert b"&lt;b&gt;note&lt;/b&gt;" in detail.content
    assert b"<b>note</b>" not in detail.content
    assert b"Supervisor ok for QA" in detail.content

    assert (
        client.get(
            reverse(
                "quality:confirm_decision",
                kwargs={
                    "submission_id": ctx["submission"].id,
                    "decision": QAReviewDecision.RELEASE,
                },
            )
        ).status_code
        == 200
    )
    confirm = client.post(
        reverse(
            "quality:confirm_decision",
            kwargs={
                "submission_id": ctx["submission"].id,
                "decision": QAReviewDecision.RELEASE,
            },
        ),
        {"review_note": "Confirmed release"},
    )
    assert confirm.status_code == 302
    review = QAReview.objects.get(checklist_submission_id=ctx["submission"].id)
    result = client.get(reverse("quality:qa_result", kwargs={"review_id": review.id}))
    assert result.status_code == 200
    assert b"QA REVIEW COMPLETED" in result.content
    assert b"Confirmed release" in result.content
    assert b"Change Decision" not in result.content

    admin = QAReviewAdmin(QAReview, AdminSite())
    request = type("R", (), {"method": "GET", "user": ctx["qa"]})()
    assert admin.has_add_permission(request) is False
    assert admin.has_delete_permission(request) is False
    assert (
        admin.has_change_permission(type("R", (), {"method": "POST", "user": ctx["qa"]})()) is False
    )

    foreign = _qa_actor(org=make_org(code=f"Z{uuid.uuid4().hex[:6].upper()}"))
    client.force_login(foreign)
    assert (
        client.get(
            reverse("quality:submission_detail", kwargs={"submission_id": ctx["submission"].id})
        ).status_code
        == 403
    )

    # Query bound on queue for another eligible set
    ctx2 = _approved_submission()
    client.force_login(ctx2["qa"])
    with CaptureQueriesContext(connection) as ctxq:
        response = client.get(reverse("quality:queue"))
    assert response.status_code == 200
    assert len(ctxq) < 80


class ConcurrentQAReviewTests(TransactionTestCase):
    def test_concurrent_decisions_one_winner(self) -> None:
        ctx = _approved_submission()
        results: list[uuid.UUID] = []
        errors: list[Exception] = []

        def _decide(decision: str) -> None:
            try:
                with transaction.atomic():
                    review = create_qa_review(
                        actor=ctx["qa"],
                        submission_id=ctx["submission"].id,
                        decision=decision,
                    )
                    results.append(review.id)
            except Exception as exc:  # noqa: BLE001 — capture race losers
                errors.append(exc)

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [
                pool.submit(_decide, QAReviewDecision.RELEASE),
                pool.submit(_decide, QAReviewDecision.HOLD),
            ]
            for future in futures:
                future.result()

        assert QAReview.objects.filter(checklist_submission_id=ctx["submission"].id).count() == 1
        assert len(set(results)) == 1
        winner = QAReview.objects.get(checklist_submission_id=ctx["submission"].id)
        assert winner.decision in {
            QAReviewDecision.RELEASE,
            QAReviewDecision.HOLD,
        }
        # Conflicting decision from the loser must not overwrite the winner.
        for err in errors:
            assert isinstance(err, ValidationError)
