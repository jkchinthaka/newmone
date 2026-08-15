"""Dedicated Mongo cross-organization denial suite (HTTP + service layer)."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied
from django.test import Client
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistResponseType,
    ChecklistTemplate,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.organizations.models import Organization
from apps.quality.models import QAReviewDecision
from apps.quality.services import create_qa_review
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.reviews.models import SupervisorReviewDecision
from apps.reviews.services import create_supervisor_review
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


def _grant_recording_roles(*, user: User, org: Organization) -> None:
    suffix = uuid.uuid4().hex[:8].upper()
    manage = make_role_with_permission(
        code=f"XOM{suffix}",
        name=f"XO Manager {suffix}",
        permission=_perm(ChecklistTemplate, "manage_checklist"),
    )
    manage.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    manage.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    manage.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    manage.permissions.add(_perm(ChecklistTask, "record_checklisttask"))
    grant_role(user, manage, organization=org)


def _published_task(*, org: Organization, actor: User) -> tuple[ChecklistTask, Any]:
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"XO{suffix}",
        name=f"Cross org {suffix}",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(
        actor=actor, version_id=version.id, title="S1"
    )
    item = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="OK",
        label="OK?",
        is_required=True,
        response_type=ChecklistResponseType.YES_NO,
    )
    publish_checklist_version(actor=actor, version_id=version.id)
    task = create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"XO-BATCH-{suffix}",
    )
    return task, item


@pytest.mark.django_db
def test_cross_org_service_layer_denied() -> None:
    org_a = make_org(code=f"XA{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"XB{uuid.uuid4().hex[:6].upper()}")
    user_a = make_user(employee_code=f"XOA{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    user_b = make_user(employee_code=f"XOB{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant_recording_roles(user=user_a, org=org_a)
    _grant_recording_roles(user=user_b, org=org_b)

    task_a, item_a = _published_task(org=org_a, actor=user_a)
    task_b, _item_b = _published_task(org=org_b, actor=user_b)

    with pytest.raises(PermissionDenied):
        start_checklist_recording(actor=user_b, task_id=task_a.id)

    record_a = start_checklist_recording(actor=user_a, task_id=task_a.id)
    with pytest.raises(PermissionDenied):
        save_checklist_draft_responses(
            actor=user_b,
            record_id=record_a.id,
            answers={item_a.id: "YES"},
        )
    save_checklist_draft_responses(
        actor=user_a,
        record_id=record_a.id,
        answers={item_a.id: "YES"},
    )
    with pytest.raises(PermissionDenied):
        submit_checklist_record(actor=user_b, record_id=record_a.id)

    submission = submit_checklist_record(actor=user_a, record_id=record_a.id)
    with pytest.raises(PermissionDenied):
        create_supervisor_review(
            actor=user_b,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.APPROVED,
        )
    with pytest.raises(PermissionDenied):
        create_qa_review(
            actor=user_b,
            submission_id=submission.id,
            decision=QAReviewDecision.RELEASE,
        )

    # Org B task remains invisible to Org A start path.
    with pytest.raises(PermissionDenied):
        start_checklist_recording(actor=user_a, task_id=task_b.id)


@pytest.mark.django_db
def test_cross_org_http_history_print_csv_denied(client: Client) -> None:
    org_a = make_org(code=f"HA{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"HB{uuid.uuid4().hex[:6].upper()}")
    user_a = make_user(employee_code=f"HOA{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    user_b = make_user(employee_code=f"HOB{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant_recording_roles(user=user_a, org=org_a)
    _grant_recording_roles(user=user_b, org=org_b)
    task_a, item_a = _published_task(org=org_a, actor=user_a)
    record = start_checklist_recording(actor=user_a, task_id=task_a.id)
    save_checklist_draft_responses(
        actor=user_a,
        record_id=record.id,
        answers={item_a.id: "YES"},
    )
    submit_checklist_record(actor=user_a, record_id=record.id)

    client.force_login(user_b)
    history = client.get(reverse("recording:daily_history"))
    assert history.status_code in {200, 302, 403}
    if history.status_code == 200:
        body = history.content.decode()
        assert str(record.id) not in body

    print_resp = client.get(reverse("recording:daily_print", kwargs={"record_id": record.id}))
    assert print_resp.status_code in {403, 404}

    csv_resp = client.get(reverse("recording:daily_export_csv"))
    assert csv_resp.status_code in {200, 302, 403}
    if csv_resp.status_code == 200 and "text/csv" in csv_resp.get("Content-Type", ""):
        assert str(record.id) not in csv_resp.content.decode()
