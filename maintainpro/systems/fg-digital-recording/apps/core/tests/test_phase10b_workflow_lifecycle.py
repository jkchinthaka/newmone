"""Phase 10B — derived checklist operational workflow lifecycle tests."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.test import Client
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
from apps.core.checklist_workflow import (
    QA_TERMINAL_SEMANTICS_NOTE,
    derive_checklist_workflow,
    detect_workflow_inconsistencies,
    filter_tasks_by_workflow_state,
    prefetch_workflow_graph,
    workflow_prefilter_queryset,
)
from apps.core.checklist_workflow import (
    ChecklistOperationalWorkflowState as S,
)
from apps.organizations.models import Organization
from apps.quality.models import QAReview, QAReviewDecision
from apps.quality.services import create_qa_review
from apps.recording.correction_services import (
    resubmit_checklist_correction,
    start_checklist_correction,
)
from apps.recording.models import ChecklistCorrection, ChecklistRecordStatus
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.reviews.services import create_supervisor_review
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
from apps.scheduling.services import cancel_checklist_task, create_batch_checklist_task


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
        defs["number"].id: "5.0",
        defs["text"].id: "note",
        defs["select"].id: str(defs["opt_a"].id),
    }


def _fixture() -> dict[str, Any]:
    org = make_org(code=f"O{uuid.uuid4().hex[:6].upper()}")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    supervisor = _supervisor(org=org)
    qa = _qa_actor(org=org)
    defs = _make_published(actor=manager, org=org, code=f"W{uuid.uuid4().hex[:6].upper()}")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=defs["template"].id,
        checklist_version_id=defs["version"].id,
        batch_reference=f"BATCH-{uuid.uuid4().hex[:8].upper()}",
    )
    return {
        "org": org,
        "manager": manager,
        "recorder": recorder,
        "supervisor": supervisor,
        "qa": qa,
        "defs": defs,
        "task": task,
    }


@pytest.mark.django_db
def test_every_existing_happy_path_state() -> None:
    fx = _fixture()
    task = fx["task"]
    assert derive_checklist_workflow(task).state == S.PENDING

    record = start_checklist_recording(actor=fx["recorder"], task_id=task.id)
    task.refresh_from_db()
    assert derive_checklist_workflow(task).state == S.IN_RECORDING

    save_checklist_draft_responses(
        actor=fx["recorder"], record_id=record.id, answers=_answers(fx["defs"])
    )
    submission = submit_checklist_record(actor=fx["recorder"], record_id=record.id)
    task.refresh_from_db()
    assert derive_checklist_workflow(task).state == S.AWAITING_SUPERVISOR

    create_supervisor_review(
        actor=fx["supervisor"],
        submission_id=submission.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        review_note="fix",
    )
    task.refresh_from_db()
    assert derive_checklist_workflow(task).state == S.RETURNED_FOR_CORRECTION

    correction = start_checklist_correction(
        actor=fx["recorder"], source_submission_id=submission.id
    )
    task.refresh_from_db()
    assert derive_checklist_workflow(task).state == S.CORRECTION_DRAFT

    save_checklist_draft_responses(
        actor=fx["recorder"], record_id=record.id, answers=_answers(fx["defs"])
    )
    submission2 = resubmit_checklist_correction(actor=fx["recorder"], correction_id=correction.id)
    task.refresh_from_db()
    assert derive_checklist_workflow(task).state == S.AWAITING_SUPERVISOR_RESUBMISSION
    assert submission2.submission_number == 2

    create_supervisor_review(
        actor=fx["supervisor"],
        submission_id=submission2.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="ok",
    )
    task.refresh_from_db()
    snap = derive_checklist_workflow(task)
    assert snap.state == S.AWAITING_QA
    assert snap.qa_closes_downstream is False

    create_qa_review(
        actor=fx["qa"],
        submission_id=submission2.id,
        decision=QAReviewDecision.RELEASE,
        review_note="release note",
    )
    task.refresh_from_db()
    snap = derive_checklist_workflow(task)
    assert snap.state == S.QA_RELEASED
    assert snap.is_qa_terminal is True
    assert snap.qa_closes_downstream is False
    assert "warehouse" in QA_TERMINAL_SEMANTICS_NOTE.lower()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "decision,expected",
    [
        (QAReviewDecision.HOLD, S.QA_HELD),
        (QAReviewDecision.REJECT, S.QA_REJECTED),
    ],
)
def test_qa_hold_and_reject_terminals(decision: str, expected: str) -> None:
    fx = _fixture()
    record = start_checklist_recording(actor=fx["recorder"], task_id=fx["task"].id)
    save_checklist_draft_responses(
        actor=fx["recorder"], record_id=record.id, answers=_answers(fx["defs"])
    )
    submission = submit_checklist_record(actor=fx["recorder"], record_id=record.id)
    create_supervisor_review(
        actor=fx["supervisor"],
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="ok",
    )
    create_qa_review(
        actor=fx["qa"],
        submission_id=submission.id,
        decision=decision,
        review_note="disposition",
    )
    snap = derive_checklist_workflow(fx["task"])
    assert snap.state == expected
    assert snap.qa_closes_downstream is False


@pytest.mark.django_db
def test_cancelled_and_missed_map_to_cancelled_workflow() -> None:
    fx = _fixture()
    cancel_checklist_task(actor=fx["manager"], task_id=fx["task"].id)
    fx["task"].refresh_from_db()
    assert derive_checklist_workflow(fx["task"]).state == S.CANCELLED

    fx2 = _fixture()
    ChecklistTask.objects.filter(pk=fx2["task"].id).update(status=ChecklistTaskStatus.MISSED)
    fx2["task"].refresh_from_db()
    assert derive_checklist_workflow(fx2["task"]).state == S.CANCELLED


@pytest.mark.django_db
def test_impossible_combinations_are_detected() -> None:
    fx = _fixture()
    record = start_checklist_recording(actor=fx["recorder"], task_id=fx["task"].id)
    save_checklist_draft_responses(
        actor=fx["recorder"], record_id=record.id, answers=_answers(fx["defs"])
    )
    submission = submit_checklist_record(actor=fx["recorder"], record_id=record.id)
    create_supervisor_review(
        actor=fx["supervisor"],
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="ok",
    )
    ChecklistCorrection.objects.create(
        organization=fx["org"],
        checklist_record=record,
        source_submission=submission,
        started_by=fx["recorder"],
    )
    task = prefetch_workflow_graph(ChecklistTask.objects.filter(pk=fx["task"].id)).get()
    snap = derive_checklist_workflow(task)
    assert "CORRECTION_DRAFT_WITH_LATEST_APPROVED" in snap.inconsistencies

    issues = detect_workflow_inconsistencies(
        task=task,
        record=record,
        latest=submission,
        supervisor=submission.supervisor_review,
        correction_draft=record.corrections.filter(status="DRAFT").first(),
        qa=None,
    )
    assert "CORRECTION_DRAFT_WITH_LATEST_APPROVED" in issues


@pytest.mark.django_db
def test_draft_with_submission_inconsistency() -> None:
    fx = _fixture()
    record = start_checklist_recording(actor=fx["recorder"], task_id=fx["task"].id)
    save_checklist_draft_responses(
        actor=fx["recorder"], record_id=record.id, answers=_answers(fx["defs"])
    )
    submission = submit_checklist_record(actor=fx["recorder"], record_id=record.id)
    type(record).objects.filter(pk=record.id).update(status=ChecklistRecordStatus.DRAFT)
    record.refresh_from_db()
    task = ChecklistTask.objects.get(pk=fx["task"].id)
    snap = derive_checklist_workflow(task)
    assert "DRAFT_RECORD_WITH_SUBMISSION" in snap.inconsistencies
    assert snap.state == S.IN_RECORDING
    assert submission.submission_number == 1


@pytest.mark.django_db
def test_workflow_filter_and_task_list_ui() -> None:
    fx = _fixture()
    pending = fx["task"]
    record = start_checklist_recording(actor=fx["recorder"], task_id=pending.id)
    save_checklist_draft_responses(
        actor=fx["recorder"], record_id=record.id, answers=_answers(fx["defs"])
    )
    submit_checklist_record(actor=fx["recorder"], record_id=record.id)

    qs = prefetch_workflow_graph(ChecklistTask.objects.filter(organization=fx["org"]))
    awaiting = filter_tasks_by_workflow_state(
        workflow_prefilter_queryset(qs, workflow_state=S.AWAITING_SUPERVISOR),
        workflow_state=S.AWAITING_SUPERVISOR,
    )
    assert any(t.id == pending.id for t in awaiting)

    client = Client()
    client.force_login(fx["manager"])
    resp = client.get(reverse("scheduling:task_list"), {"workflow": S.AWAITING_SUPERVISOR})
    assert resp.status_code == 200
    body = resp.content.decode()
    assert "Awaiting Supervisor" in body
    assert pending.batch_reference in body

    detail = client.get(reverse("scheduling:task_detail", args=[pending.id]))
    assert detail.status_code == 200
    assert "Awaiting Supervisor" in detail.content.decode()


@pytest.mark.django_db
def test_no_duplicated_workflow_status_column() -> None:
    """Guard: workflow lifecycle must not invent persisted columns on owners."""
    from django.db import connection

    owner_tables = {
        "scheduling_checklisttask",
        "recording_checklistrecord",
        "recording_checklistsubmission",
        "reviews_supervisorreview",
        "recording_checklistcorrection",
        "quality_qareview",
    }
    with connection.cursor() as cursor:
        for table in owner_tables:
            columns = {
                row.name.lower()
                for row in connection.introspection.get_table_description(cursor, table)
            }
            assert "workflow_state" not in columns
            assert "operational_workflow" not in columns
            assert "lifecycle_state" not in columns
