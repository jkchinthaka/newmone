"""Phase 08B — immutable checklist submission snapshot tests."""

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
from apps.recording.models import (
    ChecklistRecordStatus,
    ChecklistResponse,
    ChecklistSubmission,
    ChecklistSubmissionResponse,
)
from apps.recording.selectors import get_checklist_submission, load_submitted_record_context
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
    validate_record_ready_for_submission,
)
from apps.scheduling.models import ChecklistTask
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


def _viewer(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"VEW{suffix}")
    role = make_role_with_permission(
        code=f"VIEW{suffix}",
        name=f"Viewer {suffix}",
        permission=_perm(ChecklistTask, "view_checklisttask"),
    )
    grant_role(user, role, organization=org)
    return user


def _make_rich_published(
    *, actor: User, org: Organization, code: str = "CHK-SUB"
) -> dict[str, Any]:
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
    optional = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="OPT1",
        label="Optional Text",
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
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
        "optional": optional,
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


def _complete_answers(published: dict[str, Any]) -> dict[uuid.UUID, Any]:
    return {
        published["yes_no"].id: "NO",
        published["yes_no_na"].id: "NA",
        published["number"].id: "99.5",
        published["text"].id: "<b>note</b>",
        published["select"].id: str(published["opt_a"].id),
    }


@pytest.mark.django_db
def test_completeness_and_semantic_allowances() -> None:
    org = make_org(code="ORG-S01")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    published = _make_rich_published(actor=manager, org=org, code="CHK-S01")
    task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-S01")
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    assert record.status == ChecklistRecordStatus.DRAFT

    with pytest.raises(ValidationError):
        validate_record_ready_for_submission(record=record)

    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers=_complete_answers(published),
    )
    validate_record_ready_for_submission(record=record)

    # Whitespace-only required TEXT is not complete.
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={published["text"].id: "   "},
    )
    with pytest.raises(ValidationError):
        validate_record_ready_for_submission(record=record)


@pytest.mark.django_db
def test_submit_creates_immutable_snapshot_and_blocks_edits() -> None:
    org = make_org(code="ORG-S02")
    org_b = make_org(code="ORG-S02B")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    viewer = _viewer(org=org)
    manage_only = _task_manager(org=org)
    published = _make_rich_published(actor=manager, org=org, code="CHK-S02")
    task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-S02")
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={
            **_complete_answers(published),
            published["optional"].id: "optional answer",
        },
    )

    with pytest.raises(PermissionDenied):
        submit_checklist_record(actor=viewer, record_id=record.id)
    with pytest.raises(PermissionDenied):
        submit_checklist_record(actor=manage_only, record_id=record.id)

    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    assert submission.submission_number == 1
    record.refresh_from_db()
    assert record.status == ChecklistRecordStatus.SUBMITTED
    assert ChecklistSubmissionResponse.objects.filter(checklist_submission=submission).count() == 6

    again = submit_checklist_record(actor=recorder, record_id=record.id)
    assert again.id == submission.id
    assert ChecklistSubmission.objects.filter(checklist_record=record).count() == 1

    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={published["yes_no"].id: "YES"},
        )

    # Snapshot survives working-response fixture mutation.
    working = ChecklistResponse.objects.get(
        checklist_record=record, checklist_item=published["yes_no"]
    )
    ChecklistResponse.objects.filter(pk=working.id).update(choice_value="YES")
    snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission=submission, checklist_item=published["yes_no"]
    )
    assert snap.choice_value == "NO"
    number_snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission=submission, checklist_item=published["number"]
    )
    assert number_snap.number_value == Decimal("99.5")

    event = SecurityAuditEvent.objects.filter(event_type="CHECKLIST_RECORD_SUBMITTED").latest(
        "created_at"
    )
    assert "99.5" not in str(event.metadata)
    assert "NO" not in str(event.metadata)
    assert event.metadata.get("submission_number") == 1
    assert event.metadata.get("answered_item_count") == 6

    cancelled_task = _pending_task(
        manager=manager, org=org, published=published, batch="BATCH-S02C"
    )
    cancelled_record = start_checklist_recording(actor=recorder, task_id=cancelled_task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=cancelled_record.id,
        answers=_complete_answers(published),
    )
    cancel_checklist_task(actor=manager, task_id=cancelled_task.id)
    with pytest.raises(ValidationError):
        submit_checklist_record(actor=recorder, record_id=cancelled_record.id)

    recorder_b = _recorder(org=org_b)
    with pytest.raises(PermissionDenied):
        submit_checklist_record(actor=recorder_b, record_id=record.id)
    with pytest.raises(PermissionDenied):
        get_checklist_submission(recorder_b, submission.id)


@pytest.mark.django_db
def test_submission_ui_csrf_and_read_only_view() -> None:
    org = make_org(code="ORG-S03")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    published = _make_rich_published(actor=manager, org=org, code="CHK-S03")
    task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-S03")
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers=_complete_answers(published),
    )

    client = Client(enforce_csrf_checks=True)
    client.force_login(recorder)
    bad = client.post(reverse("recording:submit_confirm", args=[record.id]))
    assert bad.status_code == 403

    ok = Client()
    ok.force_login(recorder)
    editor = ok.get(reverse("recording:record_detail", args=[record.id]))
    assert editor.status_code == 200
    assert b"Save Draft" in editor.content
    assert b"Submit Checklist" in editor.content
    assert b"Supervisor" not in editor.content
    assert b"Release" not in editor.content
    assert b"Hold" not in editor.content

    confirm = ok.get(reverse("recording:submit_confirm", args=[record.id]))
    assert confirm.status_code == 200
    assert b"Confirm Submit" in confirm.content
    submitted = ok.post(reverse("recording:submit_confirm", args=[record.id]))
    assert submitted.status_code == 302

    view = ok.get(reverse("recording:record_submitted", args=[record.id]))
    assert view.status_code == 200
    assert b"SUBMITTED" in view.content
    assert b"Read-only submitted record" in view.content
    assert b"Save Draft" not in view.content
    assert b"Submit Checklist" not in view.content
    assert b"Confirm Submit" not in view.content
    assert b"&lt;b&gt;note&lt;/b&gt;" in view.content or b"<b>note</b>" not in view.content
    assert b"99.5" in view.content
    assert b"NO" in view.content

    # Direct POST save after submit is rejected by service (redirect/editor blocked).
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={published["yes_no"].id: "YES"},
        )

    with CaptureQueriesContext(connection) as ctx:
        payload = load_submitted_record_context(recorder, record.id)
    assert payload is not None
    assert len(ctx) < 25

    admin_user = make_user(employee_code=f"ADM{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    admin_user.is_superuser = True
    admin_user.save(update_fields=["is_superuser"])
    admin_client = Client()
    admin_client.force_login(admin_user)
    submission = ChecklistSubmission.objects.get(checklist_record=record)
    changelist = admin_client.get(reverse("admin:recording_checklistsubmission_changelist"))
    assert changelist.status_code == 200
    delete = admin_client.get(
        reverse("admin:recording_checklistsubmission_delete", args=[submission.id])
    )
    assert delete.status_code == 403


class ChecklistSubmissionRaceTests(TransactionTestCase):
    def test_concurrent_submit_produces_one_submission(self) -> None:
        org = make_org(code="ORG-S04")
        manager = _task_manager(org=org)
        recorder = _recorder(org=org)
        published = _make_rich_published(actor=manager, org=org, code="CHK-S04")
        task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-S04")
        record = start_checklist_recording(actor=recorder, task_id=task.id)
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers=_complete_answers(published),
        )

        def _submit() -> str:
            connection.close()
            with transaction.atomic():
                submission = submit_checklist_record(actor=recorder, record_id=record.id)
            return str(submission.id)

        with ThreadPoolExecutor(max_workers=2) as pool:
            ids = list(pool.map(lambda _: _submit(), range(2)))
        assert len(set(ids)) == 1
        assert ChecklistSubmission.objects.filter(checklist_record=record).count() == 1
        record.refresh_from_db()
        assert record.status == ChecklistRecordStatus.SUBMITTED
