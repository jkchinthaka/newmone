"""Phase 06H — repeating group / sample_index foundation tests."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import connection
from django.test.utils import CaptureQueriesContext
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistItem,
    ChecklistItemKind,
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
    user = make_user(employee_code=f"H06HM{suffix}", is_staff=True)
    manage = _perm(ChecklistTemplate, "manage_checklist")
    role = make_role_with_permission(
        code=f"CHKM{suffix}",
        name=f"Checklist Manager {suffix}",
        permission=manage,
    )
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    task_role = make_role_with_permission(
        code=f"TMGR{suffix}",
        name=f"Task Manager {suffix}",
        permission=_perm(ChecklistTask, "manage_checklisttask"),
    )
    task_role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, task_role, organization=org)
    return user


def _recorder(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"H06HR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RECR{suffix}",
        name=f"Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def _published_with_repeating(
    *, org: Organization, actor: User, repeat_min: int | None = None, repeat_max: int | None = None
) -> dict[str, Any]:
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=actor, organization=org, code=f"H06H{suffix}", name=f"H06H Template {suffix}"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Samples")
    top = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="TOP-YN",
        label="Top yes/no",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    group = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="SAMP-GRP",
        label="Sample group",
        item_kind=ChecklistItemKind.REPEATING_GROUP,
        repeat_min=repeat_min,
        repeat_max=repeat_max,
        is_required=False,
        response_type="",
    )
    child = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="SAMP-NUM",
        label="Sample number",
        response_type=ChecklistResponseType.NUMBER,
        parent_item_id=group.id,
        is_required=True,
        unit="kg",
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return {
        "template": template,
        "version": published,
        "section": section,
        "top": top,
        "group": group,
        "child": child,
    }


@pytest.mark.django_db
def test_simple_items_remain_compatible_sample_index_default() -> None:
    org = make_org(code=f"H06HA{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code="SIMPLE-T", name="Simple"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="YN",
        label="Yes no",
        response_type=ChecklistResponseType.YES_NO,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference="B-SIMPLE",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(actor=recorder, record_id=record.id, answers={item.id: "YES"})
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    draft = ChecklistResponse.objects.get(checklist_record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(checklist_submission_id=submission.id)
    assert draft.sample_index == 1
    assert snap.sample_index == 1
    assert item.item_kind == ChecklistItemKind.SIMPLE


@pytest.mark.django_db
def test_repeating_definition_publish_clone_and_many_samples() -> None:
    org = make_org(code=f"H06HB{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    defs = _published_with_repeating(org=org, actor=manager, repeat_min=2, repeat_max=4)
    assert defs["group"].item_kind == ChecklistItemKind.REPEATING_GROUP
    assert defs["child"].parent_item_id == defs["group"].id

    cloned = create_checklist_version(
        actor=manager,
        template_id=defs["template"].id,
        source_version_id=defs["version"].id,
    )
    cloned_group = ChecklistItem.objects.get(section__version_id=cloned.id, code="SAMP-GRP")
    cloned_child = ChecklistItem.objects.get(section__version_id=cloned.id, code="SAMP-NUM")
    assert cloned_group.item_kind == ChecklistItemKind.REPEATING_GROUP
    assert cloned_child.parent_item_id == cloned_group.id
    assert cloned_group.repeat_min == 2
    assert cloned_group.repeat_max == 4

    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=defs["template"].id,
        checklist_version_id=defs["version"].id,
        batch_reference="B-REP",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={
            defs["top"].id: "YES",
            (defs["child"].id, 1): Decimal("1.1"),
            (defs["child"].id, 2): Decimal("2.2"),
            (defs["child"].id, 3): Decimal("3.3"),
        },
    )
    assert ChecklistResponse.objects.filter(checklist_record_id=record.id).count() == 4
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    snaps = list(
        ChecklistSubmissionResponse.objects.filter(checklist_submission_id=submission.id).order_by(
            "sample_index"
        )
    )
    child_snaps = [s for s in snaps if s.checklist_item_id == defs["child"].id]
    assert [s.sample_index for s in child_snaps] == [1, 2, 3]
    assert child_snaps[1].number_value == Decimal("2.2")


@pytest.mark.django_db
def test_partial_draft_and_invalid_sample_index_rejected() -> None:
    org = make_org(code=f"H06HC{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    defs = _published_with_repeating(org=org, actor=manager, repeat_max=2)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=defs["template"].id,
        checklist_version_id=defs["version"].id,
        batch_reference="B-PART",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={(defs["child"].id, 1): Decimal("9")},
    )
    assert ChecklistResponse.objects.filter(checklist_record_id=record.id).count() == 1
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={(defs["child"].id, 3): Decimal("1")},
        )
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={defs["group"].id: "YES"},
        )


@pytest.mark.django_db
def test_cross_org_item_rejected_and_query_budget() -> None:
    org_a = make_org(code=f"H06HD1{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"H06HD2{uuid.uuid4().hex[:5].upper()}")
    manager_a = _manager(org=org_a)
    recorder_a = _recorder(org=org_a)
    manager_b = _manager(org=org_b)
    defs_a = _published_with_repeating(org=org_a, actor=manager_a)
    template_b = create_checklist_template(
        actor=manager_b, organization=org_b, code="OTHER", name="Other"
    )
    version_b = create_checklist_version(actor=manager_b, template_id=template_b.id)
    section_b = add_checklist_section(actor=manager_b, version_id=version_b.id, title="S")
    foreign = add_checklist_item(
        actor=manager_b,
        section_id=section_b.id,
        code="FGN",
        label="Foreign",
        response_type=ChecklistResponseType.TEXT,
    )
    publish_checklist_version(actor=manager_b, version_id=version_b.id)

    task = create_batch_checklist_task(
        actor=manager_a,
        organization_id=org_a.id,
        checklist_template_id=defs_a["template"].id,
        checklist_version_id=defs_a["version"].id,
        batch_reference="B-XORG",
    )
    record = start_checklist_recording(actor=recorder_a, task_id=task.id)
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder_a,
            record_id=record.id,
            answers={foreign.id: "nope"},
        )

    save_checklist_draft_responses(
        actor=recorder_a,
        record_id=record.id,
        answers={
            defs_a["top"].id: "YES",
            (defs_a["child"].id, 1): Decimal("1"),
            (defs_a["child"].id, 2): Decimal("2"),
        },
    )
    with CaptureQueriesContext(connection) as ctx:
        submit_checklist_record(actor=recorder_a, record_id=record.id)
    assert len(ctx) < 80


@pytest.mark.django_db
def test_repeating_group_without_children_cannot_publish() -> None:
    org = make_org(code=f"H06HE{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code="EMPTY-G", name="Empty group"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="GRP",
        label="Group",
        item_kind=ChecklistItemKind.REPEATING_GROUP,
        response_type="",
    )
    with pytest.raises(ValidationError):
        publish_checklist_version(actor=manager, version_id=version.id)
