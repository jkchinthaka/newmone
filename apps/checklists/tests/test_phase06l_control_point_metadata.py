"""Phase 06L — control-point / criticality metadata (evidence-gated taxonomy)."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.control_point import (
    METADATA_DISPOSITION_NOTE,
    assert_known_control_point_class,
    assert_known_criticality,
    build_control_point_snapshot,
    control_point_display_label,
    criticality_display_label,
)
from apps.checklists.models import (
    ChecklistControlPointClass,
    ChecklistItem,
    ChecklistItemCriticality,
    ChecklistResponseType,
    ChecklistTemplate,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
    update_checklist_item,
)
from apps.organizations.models import Organization
from apps.quality.models import QAReview
from apps.recording.models import ChecklistSubmissionResponse
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
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


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"H06LM{suffix}", is_staff=True)
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
    user = make_user(employee_code=f"H06LR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RECR{suffix}",
        name=f"Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def test_control_point_and_criticality_validators() -> None:
    assert assert_known_control_point_class("") == "NONE"
    assert assert_known_control_point_class("ccp") == "CCP"
    with pytest.raises(ValidationError):
        assert_known_control_point_class("HAZARD")
    assert assert_known_criticality("") == ""
    assert assert_known_criticality("major") == "MAJOR"
    with pytest.raises(ValidationError):
        assert_known_criticality("EXTREME")
    snap = build_control_point_snapshot(control_point_class="OPRP", criticality="CRITICAL")
    assert snap["not_qa_disposition"] is True
    assert METADATA_DISPOSITION_NOTE in snap["qa_disposition_note"]


@pytest.mark.django_db
def test_defaults_none_and_blank_criticality() -> None:
    org = make_org(code=f"O06LD{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06LD{uuid.uuid4().hex[:5].upper()}", name="D"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type=ChecklistResponseType.YES_NO,
    )
    assert item.control_point_class == ChecklistControlPointClass.NONE
    assert item.criticality == ""


@pytest.mark.django_db
def test_no_automatic_classification_of_existing_items() -> None:
    org = make_org(code=f"O06LA{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06LA{uuid.uuid4().hex[:5].upper()}", name="A"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    a = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="TEMP",
        label="Temperature",
        response_type=ChecklistResponseType.NUMBER,
    )
    b = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="METAL",
        label="Metal detector",
        response_type=ChecklistResponseType.YES_NO,
    )
    assert a.control_point_class == ChecklistControlPointClass.NONE
    assert b.control_point_class == ChecklistControlPointClass.NONE
    assert a.criticality == ""
    assert b.criticality == ""


@pytest.mark.django_db
def test_editor_validation_and_audit_on_metadata_change() -> None:
    org = make_org(code=f"O06LE{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06LE{uuid.uuid4().hex[:5].upper()}", name="E"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type=ChecklistResponseType.TEXT,
    )
    with pytest.raises(ValidationError):
        update_checklist_item(
            actor=manager,
            item_id=item.id,
            control_point_class="NOT_A_CLASS",
        )
    with pytest.raises(ValidationError):
        update_checklist_item(actor=manager, item_id=item.id, criticality="ULTRA")
    update_checklist_item(
        actor=manager,
        item_id=item.id,
        control_point_class=ChecklistControlPointClass.GMP,
        criticality=ChecklistItemCriticality.MINOR,
    )
    item.refresh_from_db()
    assert item.control_point_class == ChecklistControlPointClass.GMP
    assert item.criticality == ChecklistItemCriticality.MINOR
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_ITEM_CONTROL_POINT_METADATA_UPDATED"
    ).exists()


@pytest.mark.django_db
def test_published_version_immutability() -> None:
    org = make_org(code=f"O06LI{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06LI{uuid.uuid4().hex[:5].upper()}", name="I"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type=ChecklistResponseType.YES_NO,
        control_point_class=ChecklistControlPointClass.NONE,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    with pytest.raises(ValidationError):
        update_checklist_item(
            actor=manager,
            item_id=item.id,
            control_point_class=ChecklistControlPointClass.CCP,
        )


@pytest.mark.django_db
def test_clone_copies_control_point_metadata() -> None:
    org = make_org(code=f"O06LC{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06LC{uuid.uuid4().hex[:5].upper()}", name="C"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type=ChecklistResponseType.YES_NO,
        control_point_class=ChecklistControlPointClass.PRP,
        criticality=ChecklistItemCriticality.MAJOR,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    draft = create_checklist_version(
        actor=manager, template_id=template.id, source_version_id=version.id
    )
    cloned = ChecklistItem.objects.get(section__version_id=draft.id, code="I1")
    assert cloned.control_point_class == ChecklistControlPointClass.PRP
    assert cloned.criticality == ChecklistItemCriticality.MAJOR
    assert cloned.id != ChecklistItem.objects.get(section__version_id=version.id, code="I1").id


@pytest.mark.django_db
def test_cross_org_metadata_update_denied() -> None:
    org_a = make_org(code=f"OA{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"OB{uuid.uuid4().hex[:6].upper()}")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    template = create_checklist_template(
        actor=manager_a, organization=org_a, code=f"TX{uuid.uuid4().hex[:5].upper()}", name="X"
    )
    version = create_checklist_version(actor=manager_a, template_id=template.id)
    section = add_checklist_section(actor=manager_a, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager_a,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type=ChecklistResponseType.TEXT,
    )
    with pytest.raises(PermissionDenied):
        update_checklist_item(
            actor=manager_b,
            item_id=item.id,
            control_point_class=ChecklistControlPointClass.QUALITY,
        )


@pytest.mark.django_db
def test_submission_freezes_control_point_context_no_qareview() -> None:
    org = make_org(code=f"O06LS{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06LS{uuid.uuid4().hex[:5].upper()}", name="S"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I1",
        label="Item",
        is_required=True,
        response_type=ChecklistResponseType.YES_NO,
        control_point_class=ChecklistControlPointClass.OPRP,
        criticality=ChecklistItemCriticality.CRITICAL,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"B06L{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder, record_id=record.id, answers={str(item.id): "YES"}
    )
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=submission.id, checklist_item_id=item.id
    )
    assert snap.control_point_context is not None
    frozen = dict(snap.control_point_context)
    assert frozen["control_point_class"] == "OPRP"
    assert frozen["criticality"] == "CRITICAL"
    assert frozen["not_qa_disposition"] is True
    assert QAReview.objects.count() == 0

    # New draft version can change metadata; historical snapshot stays frozen.
    draft = create_checklist_version(
        actor=manager, template_id=template.id, source_version_id=version.id
    )
    cloned = ChecklistItem.objects.get(section__version_id=draft.id, code="I1")
    update_checklist_item(
        actor=manager,
        item_id=cloned.id,
        control_point_class=ChecklistControlPointClass.NONE,
        criticality="",
    )
    snap.refresh_from_db()
    assert snap.control_point_context == frozen


def test_display_labels_cover_helpers() -> None:
    assert "None" in control_point_display_label(None)
    assert "CCP" in control_point_display_label("CCP")
    assert control_point_display_label("NOT_A_REAL_CLASS") == "NOT_A_REAL_CLASS"
    assert criticality_display_label("") == "Unset"
    assert criticality_display_label(None) == "Unset"
    assert "Major" in criticality_display_label("MAJOR")
    assert criticality_display_label("WEIRD") == "WEIRD"


def test_snapshot_prefers_frozen_control_point_context() -> None:
    from types import SimpleNamespace

    from apps.recording.snapshot_display import control_point_display_fields

    item = SimpleNamespace(control_point_class="NONE", criticality="")
    snap = SimpleNamespace(
        control_point_context={"control_point_class": "OPRP", "criticality": "MAJOR"}
    )
    fields = control_point_display_fields(item, snap)
    assert fields["control_point_class"] == "OPRP"
    assert fields["criticality"] == "MAJOR"
    fallback = control_point_display_fields(
        SimpleNamespace(control_point_class="GMP", criticality="MINOR"), None
    )
    assert fallback["control_point_class"] == "GMP"
    assert fallback["criticality"] == "MINOR"
