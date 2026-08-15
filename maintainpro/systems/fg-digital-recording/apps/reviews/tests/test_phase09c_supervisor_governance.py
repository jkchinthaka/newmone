"""Phase 09C — Supervisor review governance hardening tests."""

from __future__ import annotations

import datetime as dt
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import connection, transaction
from django.test import Client, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
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
from apps.organizations.models import Organization
from apps.recording.correction_services import (
    resubmit_checklist_correction,
    start_checklist_correction,
)
from apps.recording.models import ChecklistSubmission
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.reviews.governance import (
    QUEUE_OVERDUE,
    QUEUE_PENDING,
    QUEUE_RESUBMISSION,
    evaluate_self_review,
    grant_temporary_supervisor_review_delegation,
    resolve_review_due,
    upsert_supervisor_review_governance_policy,
)
from apps.reviews.models import (
    SelfReviewPolicyMode,
    SupervisorReview,
    SupervisorReviewDecision,
)
from apps.reviews.selectors import (
    list_supervisor_review_queue,
    list_supervisor_reviewable_submissions,
)
from apps.reviews.services import create_supervisor_review
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
    user = make_user(employee_code=f"REV{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"REVR{suffix}",
        name=f"Reviewer {suffix}",
        permission=_perm(SupervisorReview, "review_checklistsubmission"),
    )
    grant_role(user, role, organization=org)
    return user


def _published_submission(
    *,
    manager: User,
    recorder: User,
    org: Organization,
    batch: str,
    answers: dict[Any, Any] | None = None,
) -> ChecklistSubmission:
    _grant_checklist_manage(manager, org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T{batch[-6:]}", name=f"Tpl {batch}"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="YN1",
        label="Yes No",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    published = publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference=batch,
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers=answers or {item.id: "YES"},
    )
    return submit_checklist_record(actor=recorder, record_id=record.id)


@pytest.mark.django_db
def test_pending_policy_allows_self_review_explicitly() -> None:
    org = make_org(code="ORG09C1")
    manager = _task_manager(org=org)
    actor = _reviewer(org=org)
    # Same user also has record permission for self-submit path.
    role = make_role_with_permission(
        code=f"RREC{uuid.uuid4().hex[:6].upper()}",
        name="Recorder also",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    grant_role(actor, role, organization=org)
    submission = _published_submission(
        manager=manager, recorder=actor, org=org, batch="BATCH-09C-1"
    )
    eval_ = evaluate_self_review(actor=actor, submission=submission)
    assert eval_.mode == SelfReviewPolicyMode.PENDING
    assert eval_.blocked is False
    assert eval_.is_self_review is True
    assert eval_.enforcement == "NOT_ENFORCED"
    review = create_supervisor_review(
        actor=actor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    assert review.decision == SupervisorReviewDecision.APPROVED


@pytest.mark.django_db
def test_prohibit_blocks_self_review_requires_evidence() -> None:
    org = make_org(code="ORG09C2")
    manager = _task_manager(org=org)
    reviewer = _reviewer(org=org)
    recorder = _recorder(org=org)
    with pytest.raises(ValidationError, match="evidence_reference"):
        upsert_supervisor_review_governance_policy(
            actor=reviewer,
            organization_id=org.id,
            self_review_mode=SelfReviewPolicyMode.PROHIBIT,
            evidence_reference="",
        )
    upsert_supervisor_review_governance_policy(
        actor=reviewer,
        organization_id=org.id,
        self_review_mode=SelfReviewPolicyMode.PROHIBIT,
        evidence_reference="APR-010-TEST",
    )
    # Self path: grant record + review to same user.
    grant_role(
        recorder,
        make_role_with_permission(
            code=f"RX{uuid.uuid4().hex[:6].upper()}",
            name="Review also",
            permission=_perm(SupervisorReview, "review_checklistsubmission"),
        ),
        organization=org,
    )
    submission = _published_submission(
        manager=manager, recorder=recorder, org=org, batch="BATCH-09C-2"
    )
    with pytest.raises(ValidationError, match="Self-review is prohibited"):
        create_supervisor_review(
            actor=recorder,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.APPROVED,
        )
    # Non-self still allowed.
    review = create_supervisor_review(
        actor=reviewer,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    assert review.reviewed_by_id == reviewer.id


@pytest.mark.django_db
def test_configured_sla_overdue_and_null_never_overdue() -> None:
    org = make_org(code="ORG09C3")
    manager = _task_manager(org=org)
    reviewer = _reviewer(org=org)
    recorder = _recorder(org=org)
    submission = _published_submission(
        manager=manager, recorder=recorder, org=org, batch="BATCH-09C-3"
    )
    due_none = resolve_review_due(submission=submission)
    assert due_none.due_at is None
    assert due_none.is_overdue is False
    assert due_none.overdue_reason == "NO_CONFIGURED_SLA"

    upsert_supervisor_review_governance_policy(
        actor=reviewer,
        organization_id=org.id,
        self_review_mode=SelfReviewPolicyMode.PENDING,
        review_sla_minutes=30,
    )
    within = resolve_review_due(
        submission=submission, as_of=submission.submitted_at + dt.timedelta(minutes=10)
    )
    assert within.is_overdue is False
    past = resolve_review_due(
        submission=submission, as_of=submission.submitted_at + dt.timedelta(minutes=30)
    )
    assert past.is_overdue is True
    assert past.due_at is not None


@pytest.mark.django_db
def test_queues_pending_overdue_resubmission() -> None:
    org = make_org(code="ORG09C4")
    manager = _task_manager(org=org)
    reviewer = _reviewer(org=org)
    recorder = _recorder(org=org)
    upsert_supervisor_review_governance_policy(
        actor=reviewer,
        organization_id=org.id,
        review_sla_minutes=5,
    )
    sub1 = _published_submission(manager=manager, recorder=recorder, org=org, batch="BATCH-09C-4A")
    # Force submitted_at into the past for overdue.
    ChecklistSubmission.objects.filter(pk=sub1.id).update(
        submitted_at=timezone.now() - dt.timedelta(minutes=30)
    )
    sub1.refresh_from_db()

    pending = list_supervisor_review_queue(reviewer, queue=QUEUE_PENDING)
    assert sub1.id in {s.id for s in pending}
    overdue = list_supervisor_review_queue(reviewer, queue=QUEUE_OVERDUE)
    assert sub1.id in {s.id for s in overdue}

    # Return + correct + resubmit → submission #2 in resubmission queue.
    create_supervisor_review(
        actor=reviewer,
        submission_id=sub1.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
    )
    correction = start_checklist_correction(actor=recorder, source_submission_id=sub1.id)
    # Answer required item again via correction workspace uses same draft path on record.
    from apps.recording.models import ChecklistRecord

    record = ChecklistRecord.objects.get(pk=sub1.checklist_record_id)
    section = record.checklist_task.checklist_version.sections.first()
    assert section is not None
    item = section.items.first()
    assert item is not None
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers={item.id: "NO"})
    sub2 = resubmit_checklist_correction(actor=recorder, correction_id=correction.id)
    assert sub2.submission_number == 2
    resub = list_supervisor_review_queue(reviewer, queue=QUEUE_RESUBMISSION)
    assert sub2.id in {s.id for s in resub}
    assert sub1.id not in {s.id for s in list_supervisor_reviewable_submissions(reviewer)}


@pytest.mark.django_db
def test_duplicate_and_conflicting_review() -> None:
    org = make_org(code="ORG09C5")
    manager = _task_manager(org=org)
    reviewer = _reviewer(org=org)
    recorder = _recorder(org=org)
    submission = _published_submission(
        manager=manager, recorder=recorder, org=org, batch="BATCH-09C-5"
    )
    first = create_supervisor_review(
        actor=reviewer,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    same = create_supervisor_review(
        actor=reviewer,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    assert same.id == first.id
    with pytest.raises(ValidationError, match="already"):
        create_supervisor_review(
            actor=reviewer,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        )


@pytest.mark.django_db
def test_cross_org_and_latest_submission_only() -> None:
    org_a = make_org(code="ORG09CA")
    org_b = make_org(code="ORG09CB")
    manager_a = _task_manager(org=org_a)
    manager_b = _task_manager(org=org_b)
    reviewer_a = _reviewer(org=org_a)
    recorder_a = _recorder(org=org_a)
    recorder_b = _recorder(org=org_b)
    sub_a = _published_submission(
        manager=manager_a, recorder=recorder_a, org=org_a, batch="BATCH-A"
    )
    sub_b = _published_submission(
        manager=manager_b, recorder=recorder_b, org=org_b, batch="BATCH-B"
    )
    ids_a = {s.id for s in list_supervisor_reviewable_submissions(reviewer_a)}
    assert sub_a.id in ids_a
    assert sub_b.id not in ids_a

    create_supervisor_review(
        actor=reviewer_a,
        submission_id=sub_a.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
    )
    correction = start_checklist_correction(actor=recorder_a, source_submission_id=sub_a.id)
    record = sub_a.checklist_record
    section = record.checklist_task.checklist_version.sections.first()
    assert section is not None
    item = section.items.first()
    assert item is not None
    save_checklist_draft_responses(actor=recorder_a, record_id=record.id, answers={item.id: "YES"})
    sub2 = resubmit_checklist_correction(actor=recorder_a, correction_id=correction.id)
    with pytest.raises(ValidationError, match="latest"):
        create_supervisor_review(
            actor=reviewer_a,
            submission_id=sub_a.id,
            decision=SupervisorReviewDecision.APPROVED,
        )
    create_supervisor_review(
        actor=reviewer_a,
        submission_id=sub2.id,
        decision=SupervisorReviewDecision.APPROVED,
    )


@pytest.mark.django_db
def test_temporary_delegation_requires_valid_until_and_audits() -> None:
    org = make_org(code="ORG09C6")
    reviewer = _reviewer(org=org)
    delegate = make_user(employee_code=f"DEL{uuid.uuid4().hex[:6].upper()}")
    with pytest.raises(ValidationError):
        grant_temporary_supervisor_review_delegation(
            actor=reviewer,
            organization_id=org.id,
            delegate_user_id=delegate.id,
            valid_until=None,  # type: ignore[arg-type]
        )
    until = timezone.now() + dt.timedelta(hours=2)
    assignment = grant_temporary_supervisor_review_delegation(
        actor=reviewer,
        organization_id=org.id,
        delegate_user_id=delegate.id,
        valid_until=until,
        reason_code="TEMPORARY_COVERAGE",
    )
    assert assignment.valid_until is not None
    assert assignment.is_active is True
    assert str(assignment.role.code).upper().startswith("TECH_REV_DELG_")
    assert not any(
        token in assignment.role.code.upper() for token in ("SUPERVISOR", "QA_MANAGER", "FOREMAN")
    )
    event = (
        SecurityAuditEvent.objects.filter(event_type="SUPERVISOR_REVIEW_DELEGATION_GRANTED")
        .order_by("-created_at")
        .first()
    )
    assert event is not None
    assert event.metadata.get("permanent") is False


@pytest.mark.django_db
def test_policy_set_audit_and_ui_queues() -> None:
    org = make_org(code="ORG09C7")
    manager = _task_manager(org=org)
    reviewer = _reviewer(org=org)
    recorder = _recorder(org=org)
    upsert_supervisor_review_governance_policy(
        actor=reviewer,
        organization_id=org.id,
        self_review_mode=SelfReviewPolicyMode.ALLOW,
        evidence_reference="APR-010-ALLOW",
        review_sla_minutes=60,
    )
    event = (
        SecurityAuditEvent.objects.filter(event_type="SUPERVISOR_REVIEW_GOVERNANCE_POLICY_SET")
        .order_by("-created_at")
        .first()
    )
    assert event is not None
    assert event.metadata.get("self_review_mode") == SelfReviewPolicyMode.ALLOW
    assert "review_note" not in (event.metadata or {})

    _published_submission(manager=manager, recorder=recorder, org=org, batch="BATCH-09C-7")
    client = Client()
    client.force_login(reviewer)
    resp = client.get(reverse("reviews:queue"), {"queue": QUEUE_PENDING})
    assert resp.status_code == 200
    assert b"Pending" in resp.content
    assert b"Overdue" in resp.content
    assert b"Resubmission" in resp.content
    assert b"SUPERVISOR" not in resp.content or b"Supervisor Review Queue" in resp.content


class ConcurrentReviewTests(TransactionTestCase):
    def test_concurrent_review_one_row(self) -> None:
        org = make_org(code="ORG09CC")
        manager = _task_manager(org=org)
        reviewer_a = _reviewer(org=org)
        reviewer_b = _reviewer(org=org)
        recorder = _recorder(org=org)
        submission = _published_submission(
            manager=manager, recorder=recorder, org=org, batch="BATCH-09CC"
        )

        results: list[uuid.UUID] = []
        errors: list[str] = []

        def _run(actor: User) -> None:
            connection.close()
            try:
                with transaction.atomic():
                    review = create_supervisor_review(
                        actor=actor,
                        submission_id=submission.id,
                        decision=SupervisorReviewDecision.APPROVED,
                    )
                    results.append(review.id)
            except ValidationError as exc:
                errors.append("; ".join(exc.messages))

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(_run, reviewer_a)
            f2 = pool.submit(_run, reviewer_b)
            f1.result()
            f2.result()

        assert SupervisorReview.objects.filter(checklist_submission=submission).count() == 1
        assert len(set(results)) == 1
