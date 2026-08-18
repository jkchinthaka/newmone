"""Phase 08A — checklist draft recording foundation tests."""

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
from apps.checklists.models import ChecklistItem, ChecklistItemOption, ChecklistResponseType
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_item_option,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.organizations.models import Organization
from apps.recording.forms import response_field_name
from apps.recording.models import ChecklistRecord, ChecklistResponse
from apps.recording.selectors import (
    get_checklist_record,
    list_recordable_checklist_tasks,
    load_record_editor_context,
)
from apps.recording.services import save_checklist_draft_responses, start_checklist_recording
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
    *, actor: User, org: Organization, code: str = "CHK-REC"
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
    text = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="TXT1",
        label="Text Item",
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
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
    opt_b = add_checklist_item_option(actor=actor, item_id=select.id, value="B", label="Option B")
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return {
        "template": template,
        "version": published,
        "section": section,
        "yes_no": yes_no,
        "yes_no_na": yes_no_na,
        "number": number,
        "text": text,
        "select": select,
        "opt_a": opt_a,
        "opt_b": opt_b,
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


@pytest.mark.django_db
def test_start_recording_authz_and_idempotency() -> None:
    org = make_org(code="ORG-R01")
    org_b = make_org(code="ORG-R01B")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    viewer = _viewer(org=org)
    manage_only = _task_manager(org=org)
    published = _make_rich_published(actor=manager, org=org, code="CHK-R01")
    task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-R01")

    with pytest.raises(PermissionDenied):
        start_checklist_recording(actor=viewer, task_id=task.id)
    with pytest.raises(PermissionDenied):
        start_checklist_recording(actor=manage_only, task_id=task.id)

    record = start_checklist_recording(actor=recorder, task_id=task.id)
    again = start_checklist_recording(actor=recorder, task_id=task.id)
    assert again.id == record.id
    assert ChecklistRecord.objects.filter(checklist_task=task).count() == 1
    assert record.started_by_id == recorder.id
    assert record.organization_id == org.id

    cancelled = cancel_checklist_task(actor=manager, task_id=task.id)
    with pytest.raises(ValidationError):
        start_checklist_recording(actor=recorder, task_id=cancelled.id)

    other_task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-R01-X")
    recorder_b = _recorder(org=org_b)
    with pytest.raises(PermissionDenied):
        start_checklist_recording(actor=recorder_b, task_id=other_task.id)


@pytest.mark.django_db
def test_response_typed_storage_and_partial_draft() -> None:
    org = make_org(code="ORG-R02")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    published = _make_rich_published(actor=manager, org=org, code="CHK-R02")
    task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-R02")
    record = start_checklist_recording(actor=recorder, task_id=task.id)

    saved = save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={
            published["yes_no"].id: "YES",
            published["number"].id: "",
            published["select"].id: "",
            published["text"].id: "<b>not html safe intent</b>",
        },
    )
    assert saved.id == record.id
    assert ChecklistResponse.objects.filter(checklist_record=record).count() == 2

    yn = ChecklistResponse.objects.get(checklist_record=record, checklist_item=published["yes_no"])
    assert yn.choice_value == "YES"
    assert yn.number_value is None
    assert yn.text_value == ""
    assert yn.selected_option_id is None

    text = ChecklistResponse.objects.get(checklist_record=record, checklist_item=published["text"])
    assert text.text_value == "<b>not html safe intent</b>"

    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={published["yes_no"].id: "NA"},
        )
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={published["yes_no_na"].id: "NA"},
    )
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={published["number"].id: "99.5"},
    )
    number = ChecklistResponse.objects.get(
        checklist_record=record, checklist_item=published["number"]
    )
    assert number.number_value == Decimal("99.5")

    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={published["number"].id: "not-a-number"},
        )

    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={published["select"].id: str(published["opt_a"].id)},
    )

    foreign_item = ChecklistItem(
        section=published["section"],
        code="OTHER",
        label="Other",
        position=99,
        response_type=ChecklistResponseType.SELECT,
    )
    foreign_item.save()
    foreign_opt = ChecklistItemOption.objects.create(
        item=foreign_item, value="X", label="X", position=1
    )
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={published["select"].id: str(foreign_opt.id)},
        )

    other_version = create_checklist_version(actor=manager, template_id=published["template"].id)
    other_section = add_checklist_section(actor=manager, version_id=other_version.id, title="Other")
    other_item = add_checklist_item(
        actor=manager,
        section_id=other_section.id,
        code="FOREIGN",
        label="Foreign",
        response_type=ChecklistResponseType.YES_NO,
    )
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={other_item.id: "YES"},
        )


@pytest.mark.django_db
def test_cross_org_idor_and_audit_minimization() -> None:
    org_a = make_org(code="ORG-R03A")
    org_b = make_org(code="ORG-R03B")
    manager_a = _task_manager(org=org_a)
    recorder_a = _recorder(org=org_a)
    recorder_b = _recorder(org=org_b)
    published = _make_rich_published(actor=manager_a, org=org_a, code="CHK-R03")
    task = _pending_task(manager=manager_a, org=org_a, published=published, batch="BATCH-R03")
    record = start_checklist_recording(actor=recorder_a, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder_a,
        record_id=record.id,
        answers={published["yes_no"].id: "NO"},
    )

    assert list_recordable_checklist_tasks(recorder_b).count() == 0
    with pytest.raises(PermissionDenied):
        get_checklist_record(recorder_b, record.id)
    with pytest.raises(PermissionDenied):
        save_checklist_draft_responses(
            actor=recorder_b,
            record_id=record.id,
            answers={published["yes_no"].id: "YES"},
        )

    started = SecurityAuditEvent.objects.filter(event_type="CHECKLIST_RECORD_STARTED").latest(
        "created_at"
    )
    saved = SecurityAuditEvent.objects.filter(event_type="CHECKLIST_RECORD_DRAFT_SAVED").latest(
        "created_at"
    )
    assert "YES" not in str(started.metadata)
    assert "NO" not in str(saved.metadata)
    assert "choice_value" not in saved.metadata
    assert "text_value" not in saved.metadata
    assert saved.metadata.get("changed_item_count") is not None


@pytest.mark.django_db
def test_recording_ui_save_draft_and_csrf() -> None:
    org = make_org(code="ORG-R04")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    viewer = _viewer(org=org)
    published = _make_rich_published(actor=manager, org=org, code="CHK-R04")
    task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-R04")

    client = Client(enforce_csrf_checks=True)
    client.force_login(recorder)
    list_resp = client.get(reverse("recording:task_list"))
    assert list_resp.status_code == 200
    assert b"BATCH-R04" in list_resp.content
    assert b"Pending recording" in list_resp.content
    assert b"Submit" not in list_resp.content
    assert b"Release" not in list_resp.content
    assert b"Hold" not in list_resp.content
    assert b"Reject" not in list_resp.content

    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(recorder)
    bad = csrf_client.post(reverse("recording:start_recording", args=[task.id]))
    assert bad.status_code == 403

    # Authenticated client without enforce reuses session cookies with CSRF from GET.
    ok_client = Client()
    ok_client.force_login(recorder)
    start = ok_client.post(reverse("recording:start_recording", args=[task.id]))
    assert start.status_code == 302
    record = ChecklistRecord.objects.get(checklist_task=task)
    editor = ok_client.get(reverse("recording:record_detail", args=[record.id]))
    assert editor.status_code == 200
    assert b"Save Draft" in editor.content
    assert b"Submit Checklist" in editor.content
    assert b"Configured range" in editor.content
    assert b"Unit: C" in editor.content
    assert b"Release" not in editor.content
    assert b"Hold" not in editor.content
    assert b"Reject" not in editor.content
    assert b"Supervisor" not in editor.content
    assert b"QA Approve" not in editor.content
    assert b"status-pill" not in editor.content

    payload = {
        "expected_draft_version": str(record.draft_version),
        response_field_name(published["yes_no"].id): "YES",
        response_field_name(published["yes_no_na"].id): "",
        response_field_name(published["number"].id): "12",
        response_field_name(published["text"].id): "<script>x</script>",
        response_field_name(published["select"].id): str(published["opt_b"].id),
    }
    saved = ok_client.post(reverse("recording:record_detail", args=[record.id]), data=payload)
    assert saved.status_code == 302
    assert ChecklistResponse.objects.filter(checklist_record=record).count() == 4
    text = ChecklistResponse.objects.get(checklist_record=record, checklist_item=published["text"])
    assert text.text_value == "<script>x</script>"
    redraw = ok_client.get(reverse("recording:record_detail", args=[record.id]))
    assert b"<script>x</script>" not in redraw.content

    viewer_client = Client()
    viewer_client.force_login(viewer)
    assert viewer_client.get(reverse("recording:task_list")).status_code == 403

    manage_client = Client()
    manage_client.force_login(manager)
    assert manage_client.get(reverse("recording:task_list")).status_code == 403


@pytest.mark.django_db
def test_editor_query_budget_and_admin_readonly() -> None:
    org = make_org(code="ORG-R05")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    published = _make_rich_published(actor=manager, org=org, code="CHK-R05")
    task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-R05")
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={
            published["yes_no"].id: "YES",
            published["select"].id: str(published["opt_a"].id),
        },
    )
    with CaptureQueriesContext(connection) as ctx:
        payload = load_record_editor_context(recorder, record.id)
    assert payload is not None
    assert len(ctx) < 25

    client = Client()
    admin_user = make_user(employee_code=f"ADM{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    admin_user.is_superuser = True
    admin_user.save(update_fields=["is_superuser"])
    client.force_login(admin_user)
    changelist = client.get(reverse("admin:recording_checklistrecord_changelist"))
    assert changelist.status_code == 200
    delete = client.get(reverse("admin:recording_checklistrecord_delete", args=[record.id]))
    assert delete.status_code == 403


class ChecklistRecordRaceTests(TransactionTestCase):
    def test_concurrent_start_produces_one_record(self) -> None:
        org = make_org(code="ORG-R06")
        manager = _task_manager(org=org)
        recorder = _recorder(org=org)
        published = _make_rich_published(actor=manager, org=org, code="CHK-R06")
        task = _pending_task(manager=manager, org=org, published=published, batch="BATCH-R06")

        def _start() -> str:
            connection.close()
            with transaction.atomic():
                started = start_checklist_recording(actor=recorder, task_id=task.id)
            return str(started.id)

        with ThreadPoolExecutor(max_workers=2) as pool:
            ids = list(pool.map(lambda _: _start(), range(2)))
        assert len(set(ids)) == 1
        assert ChecklistRecord.objects.filter(checklist_task=task).count() == 1
