"""Phase 08C — shop-floor checklist recording hardening tests."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.instruments.models import Equipment, EquipmentType
from apps.organizations.models import Organization
from apps.recording.concurrency import DraftConcurrencyConflict
from apps.recording.forms import response_field_name
from apps.recording.models import ChecklistRecord, ChecklistResponse
from apps.recording.services import save_checklist_draft_responses, start_checklist_recording
from apps.scheduling.models import ChecklistTask
from apps.scheduling.services import create_batch_checklist_task


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant_checklist_manage(user: User, org: Organization) -> None:
    manage = _perm(ChecklistTemplate, "manage_checklist")
    view = _perm(ChecklistTemplate, "view_checklisttemplate")
    suffix = uuid.uuid4().hex[:8].upper()
    role = make_role_with_permission(
        code=f"CHKM{suffix}", name=f"Checklist Manager {suffix}", permission=manage
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


def _published(*, actor: User, org: Organization, code: str = "CHK08C") -> dict[str, Any]:
    _grant_checklist_manage(actor, org)
    template = create_checklist_template(
        actor=actor, organization=org, code=code, name=f"{code} Name"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Core")
    yes_no = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="YN1",
        label="Gate check",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    number = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="NUM1",
        label="Measure",
        response_type=ChecklistResponseType.NUMBER,
        unit="C",
        is_required=False,
        requires_equipment_reference=True,
    )
    group = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="REP1",
        label="Samples",
        response_type="",
        item_kind="REPEATING_GROUP",
        repeat_min=1,
        repeat_max=5,
        is_required=False,
    )
    child = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="S1",
        label="Sample note",
        response_type=ChecklistResponseType.TEXT,
        parent_item_id=group.id,
        is_required=False,
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return {
        "template": template,
        "version": published,
        "section": section,
        "yes_no": yes_no,
        "number": number,
        "group": group,
        "child": child,
    }


def _start_record(
    *, org: Organization, batch: str
) -> tuple[User, User, dict[str, Any], ChecklistRecord]:
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    published = _published(actor=manager, org=org, code=f"C{batch[-4:]}")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=published["template"].id,
        checklist_version_id=published["version"].id,
        batch_reference=batch,
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    return manager, recorder, published, record


@pytest.mark.django_db
def test_manual_save_increments_draft_version() -> None:
    org = make_org(code="ORG08C1")
    _, recorder, published, record = _start_record(org=org, batch="BATCH-08C-1")
    assert record.draft_version == 1
    saved = save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={(published["yes_no"].id, 1): "YES"},
        expected_draft_version=1,
        save_mode="manual",
    )
    assert saved.draft_version == 2


@pytest.mark.django_db
def test_autosave_and_conflict_no_last_write_wins() -> None:
    org = make_org(code="ORG08C2")
    _, recorder, published, record = _start_record(org=org, batch="BATCH-08C-2")
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={(published["yes_no"].id, 1): "YES"},
        expected_draft_version=1,
        save_mode="autosave",
    )
    record.refresh_from_db()
    assert record.draft_version == 2

    with pytest.raises(DraftConcurrencyConflict) as excinfo:
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={(published["yes_no"].id, 1): "NO"},
            expected_draft_version=1,  # stale tab
            save_mode="autosave",
        )
    assert excinfo.value.current_version == 2
    record.refresh_from_db()
    assert record.draft_version == 2
    response = ChecklistResponse.objects.get(
        checklist_record=record, checklist_item=published["yes_no"]
    )
    assert response.choice_value == "YES"  # stale write rejected


@pytest.mark.django_db
def test_autosave_endpoint_and_session_resume_cookie() -> None:
    org = make_org(code="ORG08C3")
    _, recorder, published, record = _start_record(org=org, batch="BATCH-08C-3")
    client = Client()
    client.force_login(recorder)
    detail = client.get(reverse("recording:record_detail", args=[record.id]))
    assert detail.status_code == 200
    assert client.session.get("recording_resume_url") == reverse(
        "recording:record_detail", args=[record.id]
    )
    assert b"expected_draft_version" in detail.content
    assert b"recording-sticky-actions" in detail.content

    payload = {
        "expected_draft_version": "1",
        response_field_name(published["yes_no"].id): "YES",
    }
    resp = client.post(reverse("recording:record_autosave", args=[record.id]), data=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["draft_version"] == 2
    assert body["server_authoritative"] is True

    conflict = client.post(
        reverse("recording:record_autosave", args=[record.id]),
        data={"expected_draft_version": "1", response_field_name(published["yes_no"].id): "NO"},
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"] == "conflict"


@pytest.mark.django_db
def test_validation_summary_and_repeating_fields_render() -> None:
    org = make_org(code="ORG08C4")
    _, recorder, published, record = _start_record(org=org, batch="BATCH-08C-4")
    client = Client()
    client.force_login(recorder)
    # Add a sample row via sample_action
    resp = client.post(
        reverse("recording:record_detail", args=[record.id]),
        data={
            "expected_draft_version": "1",
            "sample_action": f"add:{published['group'].id}",
            f"sample_count_{published['group'].id.hex}": "1",
        },
    )
    assert resp.status_code == 200
    assert b"Sample 1" in resp.content or b"sample 1" in resp.content.lower()
    assert b"validation-summary" in resp.content or b"Required items" in resp.content


@pytest.mark.django_db
def test_equipment_hook_and_cross_org_no_leakage() -> None:
    org_a = make_org(code="ORG08CA")
    org_b = make_org(code="ORG08CB")
    _, recorder_a, published, record = _start_record(org=org_a, batch="BATCH-08C-EQ")
    equipment = Equipment.objects.create(
        organization=org_a,
        code="EQ08C1",
        name="Probe A",
        equipment_type=EquipmentType.PROBE,
        is_active=True,
    )
    foreign = Equipment.objects.create(
        organization=org_b,
        code="EQ08C2",
        name="Probe B",
        equipment_type=EquipmentType.PROBE,
        is_active=True,
    )
    save_checklist_draft_responses(
        actor=recorder_a,
        record_id=record.id,
        answers={
            (published["yes_no"].id, 1): "YES",
            (published["number"].id, 1): Decimal("1.5"),
        },
        expected_draft_version=1,
        equipment_refs={(published["number"].id, 1): str(equipment.id)},
    )
    row = ChecklistResponse.objects.get(checklist_record=record, checklist_item=published["number"])
    assert row.equipment_id == equipment.id
    assert row.evidence_hook is not None
    assert row.evidence_hook["attachment_module"].startswith("Phase 11")

    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder_a,
            record_id=record.id,
            answers={(published["number"].id, 1): Decimal("2.0")},
            expected_draft_version=2,
            equipment_refs={(published["number"].id, 1): str(foreign.id)},
        )

    recorder_b = _recorder(org=org_b)
    client = Client()
    client.force_login(recorder_b)
    denied = client.get(reverse("recording:record_detail", args=[record.id]))
    assert denied.status_code == 403


@pytest.mark.django_db
def test_mobile_viewport_markup_and_query_bounds() -> None:
    org = make_org(code="ORG08C5")
    _, recorder, published, record = _start_record(org=org, batch="BATCH-08C-5")
    client = Client()
    client.force_login(recorder)
    resp = client.get(reverse("recording:record_detail", args=[record.id]))
    assert resp.status_code == 200
    assert b"btn--touch" in resp.content
    assert b"viewport" in resp.content  # from base layout

    with CaptureQueriesContext(connection) as ctx:
        client.get(reverse("recording:record_detail", args=[record.id]))
    # Editor should stay within a bounded query budget (prefetch sections/items).
    assert len(ctx) < 120


@pytest.mark.django_db
def test_session_expiry_redirects_and_resume_after_login() -> None:
    """Online recovery: expired session -> login -> safe resume to draft editor."""
    org = make_org(code="ORG08C6")
    _, recorder, published, record = _start_record(org=org, batch="BATCH-08C-6")
    detail_url = reverse("recording:record_detail", args=[record.id])
    client = Client()
    client.force_login(recorder)
    assert client.get(detail_url).status_code == 200

    # Simulate session expiry (shop-floor idle).
    client.logout()
    blocked = client.post(
        reverse("recording:record_autosave", args=[record.id]),
        data={"expected_draft_version": "1", response_field_name(published["yes_no"].id): "YES"},
    )
    assert blocked.status_code in (302, 401, 403)
    if blocked.status_code == 302:
        assert reverse("accounts:login") in blocked["Location"]

    # Resume URL survives in a pre-expiry session; after re-login honor next=.
    client2 = Client()
    session = client2.session
    session["recording_resume_url"] = detail_url
    session.save()
    client2.force_login(recorder)
    # Mimic post-login redirect path used by accounts login helper.
    from django.test import RequestFactory

    from apps.accounts.views import _safe_post_login_redirect

    req = RequestFactory().get("/accounts/login/")
    req.session = client2.session
    resume = _safe_post_login_redirect(req)
    assert resume == detail_url

    # Unauthenticated GET also stores next for Django login_required.
    anon = Client()
    bounce = anon.get(detail_url)
    assert bounce.status_code == 302
    assert reverse("accounts:login") in bounce["Location"]
    assert "next=" in bounce["Location"]
