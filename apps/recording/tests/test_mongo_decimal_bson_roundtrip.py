"""Explicit Decimal <-> BSON round-trip (never via float)."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
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
from apps.recording.models import ChecklistResponse, ChecklistSubmissionResponse
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.scheduling.models import ChecklistTask
from apps.scheduling.services import create_batch_checklist_task

DECIMAL_CASES = (
    Decimal("-15"),
    Decimal("-15.0"),
    Decimal("-15.50"),
    Decimal("-17.35"),
    Decimal("-19.20"),
    Decimal("0"),
    Decimal("-0.00"),
    Decimal("123.456"),
)


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"DEC-M{suffix}", is_staff=True)
    manage = _perm(ChecklistTemplate, "manage_checklist")
    role = make_role_with_permission(
        code=f"DECM{suffix}",
        name=f"Dec Manager {suffix}",
        permission=manage,
    )
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    task_role = make_role_with_permission(
        code=f"DECT{suffix}",
        name=f"Dec Task {suffix}",
        permission=_perm(ChecklistTask, "manage_checklisttask"),
    )
    task_role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, task_role, organization=org)
    return user


def _recorder(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"DEC-R{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"DECR{suffix}",
        name=f"Dec Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
@pytest.mark.parametrize("value", DECIMAL_CASES, ids=[str(v) for v in DECIMAL_CASES])
def test_decimal_bson_draft_submit_roundtrip(value: Decimal) -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:7].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=manager,
        organization=org,
        code=f"DEC{suffix}",
        name=f"Decimal {suffix}",
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(
        actor=manager,
        version_id=version.id,
        title="Temps",
    )
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="TEMP",
        label="Measured C",
        is_required=True,
        response_type=ChecklistResponseType.NUMBER,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"DEC-BATCH-{suffix}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(item.id): format(value, "f")},
    )
    draft = ChecklistResponse.objects.get(
        checklist_record_id=record.id,
        checklist_item_id=item.id,
    )
    assert isinstance(draft.number_value, Decimal)
    assert draft.number_value == value
    # Never treat float(Decimal) as authoritative equality.
    assert type(draft.number_value) is Decimal

    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=submission.id,
        checklist_item_id=item.id,
    )
    assert isinstance(snap.number_value, Decimal)
    assert snap.number_value == value
    reloaded = ChecklistResponse.objects.get(pk=draft.pk)
    assert reloaded.number_value == value
