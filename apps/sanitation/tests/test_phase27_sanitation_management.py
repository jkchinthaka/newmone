"""Phase 27 — sanitation / SSOP checklist workflow tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from tests.factories import (
    grant_role,
    make_department,
    make_org,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.evidence.linking import resolve_linked_target
from apps.evidence.models import EvidenceLinkedKind
from apps.instruments.models import Equipment
from apps.instruments.services import create_equipment
from apps.organizations.models import Organization
from apps.recording.models import ChecklistSubmissionResponse
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.sanitation.models import (
    SanitationHistoryEntry,
    SanitationProgram,
    SanitationProgramVersionStatus,
    SanitationScheduleKind,
    SanitationVerificationMode,
)
from apps.sanitation.policy import evaluate_sanitation_fail_policy
from apps.sanitation.selectors import chemicals_for_organization, programs_for_organization
from apps.sanitation.services import (
    add_sanitation_scope,
    add_schedule_link,
    approve_program_version,
    assert_scope_matches_organization,
    bind_checklist_template_to_sanitation_program,
    create_chemical_reference,
    create_draft_program_version,
    create_sanitation_program,
    link_chemical_to_version,
    retire_program_version,
    upsert_sanitation_fail_policy,
)
from apps.sanitation.snapshots import snapshot_for_checklist_template
from apps.scheduling.generation import create_checklist_schedule, create_manual_schedule_occurrence
from apps.scheduling.models import ChecklistSchedule, ChecklistTask, ChecklistTriggerType
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


def _grant(user: User, org: Organization, model: type[Any], *codenames: str) -> None:
    suffix = uuid.uuid4().hex[:6].upper()
    role = make_role_with_permission(
        code=f"SN{suffix}",
        name=f"Sanitation role {suffix}",
        permission=_perm(model, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"SM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"SM{suffix}",
        name=f"San manager {suffix}",
        permission=_perm(SanitationProgram, "manage_sanitationprogram"),
    )
    role.permissions.add(_perm(SanitationProgram, "publish_sanitationprogram"))
    role.permissions.add(_perm(SanitationProgram, "view_sanitation"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(ChecklistSchedule, "manage_checklistschedule"))
    role.permissions.add(_perm(Equipment, "manage_equipment"))
    role.permissions.add(_perm(Equipment, "view_equipment"))
    grant_role(user, role, organization=org)
    return user


def _published_template(*, actor: User, org: Organization) -> ChecklistTemplate:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"CLN-{uuid.uuid4().hex[:6].upper()}",
        name="Sanitation checklist shell",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Area check")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="AREA",
        label="Area visually clean",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    publish_checklist_version(actor=actor, version_id=version.id)
    return template


@pytest.mark.django_db
def test_program_scope_schedule_history_and_binding() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    site = make_site(org, code=f"ST{uuid.uuid4().hex[:4].upper()}")
    dept = make_department(org, code=f"D{uuid.uuid4().hex[:4].upper()}", site=site)
    manager = _manager(org=org)
    template = _published_template(actor=manager, org=org)
    equipment = create_equipment(
        actor=manager,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:5].upper()}",
        name="Wash station shell",
        site=site,
    )

    program = create_sanitation_program(
        actor=manager,
        organization=org,
        checklist_template=template,
        code=f"SSOP-{uuid.uuid4().hex[:5].upper()}",
        title="Area sanitation program",
    )
    version = create_draft_program_version(
        actor=manager,
        program_id=program.id,
        verification_mode=SanitationVerificationMode.SUPERVISOR,
    )
    scope = add_sanitation_scope(
        actor=manager,
        program_version_id=version.id,
        code="AREA-1",
        title="Pack room",
        site=site,
        department=dept,
        line_code="LINE-OPAQUE",
        work_area_code="WA-OPAQUE",
        equipment=equipment,
    )
    schedule = create_checklist_schedule(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        code=f"SCH-{uuid.uuid4().hex[:5].upper()}",
        trigger_type=ChecklistTriggerType.MANUAL,
        name="Pre-op shell schedule",
    )
    add_schedule_link(
        actor=manager,
        program_version_id=version.id,
        schedule_kind=SanitationScheduleKind.PRE_OP,
        checklist_schedule=schedule,
        label="Pre-op link",
    )
    chemical = create_chemical_reference(
        actor=manager,
        organization=org,
        code=f"CHEM-{uuid.uuid4().hex[:4].upper()}",
        name="Generic detergent shell",
        # blank concentration — do not invent ppm
    )
    link_chemical_to_version(actor=manager, program_version_id=version.id, chemical_id=chemical.id)

    approve_program_version(actor=manager, program_version_id=version.id)
    binding = bind_checklist_template_to_sanitation_program(
        actor=manager, program_version_id=version.id
    )
    frozen = dict(binding.frozen_sanitation_context)
    assert frozen["verification_mode"] == SanitationVerificationMode.SUPERVISOR
    assert frozen["reuses_checklist_engine"] is True
    assert any(s["equipment_id"] == str(equipment.id) for s in frozen["scopes"])
    assert SanitationScheduleKind.PRE_OP in frozen["schedule_kinds"]

    # Later master rename must not rewrite frozen binding meaning if we re-read snapshot.
    program.title = "Renamed later"
    program.save(update_fields=["title", "updated_at"])
    snap = snapshot_for_checklist_template(template.id)
    assert snap is not None
    assert snap["program_title"] == frozen["program_title"]
    assert snap == frozen or snap["program_code"] == frozen["program_code"]

    assert SanitationHistoryEntry.objects.filter(
        organization=org, event_type="SANITATION_PROGRAM_CREATED"
    ).exists()
    assert SecurityAuditEvent.objects.filter(event_type="SANITATION_CHECKLIST_BINDING_SET").exists()
    assert programs_for_organization(org.id).filter(pk=program.id).exists()
    assert chemicals_for_organization(org.id).filter(pk=chemical.id).exists()
    assert_scope_matches_organization(scope=scope, organization_id=org.id)


@pytest.mark.django_db
def test_failed_check_policy_disabled_by_default() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    decision = evaluate_sanitation_fail_policy(
        organization_id=org.id, checklist_evaluation_failed=True
    )
    assert decision.stop_production is False
    assert decision.reason_code == "POLICY_DISABLED"
    assert decision.advisory_only is True


@pytest.mark.django_db
@override_settings(SANITATION_FAIL_STOP_PRODUCTION_APPROVED=False)
def test_fail_policy_org_enabled_still_blocked_without_settings() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    upsert_sanitation_fail_policy(
        actor=manager,
        organization=org,
        policy_enabled=True,
        procedure_reference="OPAQUE-SOP-REF",
    )
    decision = evaluate_sanitation_fail_policy(
        organization_id=org.id, checklist_evaluation_failed=True
    )
    assert decision.stop_production is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"


@pytest.mark.django_db
@override_settings(SANITATION_FAIL_STOP_PRODUCTION_APPROVED=True)
def test_fail_policy_enabled_when_approved() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    upsert_sanitation_fail_policy(
        actor=manager,
        organization=org,
        policy_enabled=True,
        procedure_reference="OPAQUE-SOP-REF",
    )
    decision = evaluate_sanitation_fail_policy(
        organization_id=org.id, checklist_evaluation_failed=True
    )
    assert decision.stop_production is True
    assert decision.reason_code == "STOP_PRODUCTION_ENABLED"
    ok = evaluate_sanitation_fail_policy(organization_id=org.id, checklist_evaluation_failed=False)
    assert ok.stop_production is False


@pytest.mark.django_db
def test_cross_org_denied() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    template_a = _published_template(actor=manager_a, org=org_a)
    template_b = _published_template(actor=manager_b, org=org_b)
    with pytest.raises(ValidationError):
        create_sanitation_program(
            actor=manager_a,
            organization=org_a,
            checklist_template=template_b,
            code="XORG",
            title="Bad",
        )
    program = create_sanitation_program(
        actor=manager_a,
        organization=org_a,
        checklist_template=template_a,
        code=f"P-{uuid.uuid4().hex[:5].upper()}",
        title="A program",
    )
    version = create_draft_program_version(actor=manager_a, program_id=program.id)
    site_b = make_site(org_b, code=f"SB{uuid.uuid4().hex[:4].upper()}")
    with pytest.raises(ValidationError):
        add_sanitation_scope(
            actor=manager_a,
            program_version_id=version.id,
            code="BAD-SITE",
            site=site_b,
        )
    with pytest.raises(PermissionDenied):
        create_sanitation_program(
            actor=manager_b,
            organization=org_a,
            checklist_template=template_a,
            code="XPERM",
            title="Cross",
        )


@pytest.mark.django_db
def test_verification_modes_and_immutable_approved() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = _published_template(actor=manager, org=org)
    program = create_sanitation_program(
        actor=manager,
        organization=org,
        checklist_template=template,
        code=f"V-{uuid.uuid4().hex[:5].upper()}",
        title="Verify modes",
    )
    version = create_draft_program_version(
        actor=manager,
        program_id=program.id,
        verification_mode=SanitationVerificationMode.QA,
    )
    assert version.verification_mode == SanitationVerificationMode.QA
    approve_program_version(actor=manager, program_version_id=version.id)
    with pytest.raises(ValidationError):
        add_sanitation_scope(actor=manager, program_version_id=version.id, code="TOO-LATE")
    retire_program_version(actor=manager, program_version_id=version.id)
    version.refresh_from_db()
    assert version.status == SanitationProgramVersionStatus.RETIRED


@pytest.mark.django_db
def test_evidence_link_to_sanitation_program() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = _published_template(actor=manager, org=org)
    program = create_sanitation_program(
        actor=manager,
        organization=org,
        checklist_template=template,
        code=f"EV-{uuid.uuid4().hex[:5].upper()}",
        title="Evidence target",
    )
    target = resolve_linked_target(kind=EvidenceLinkedKind.SANITATION_PROGRAM, object_id=program.id)
    assert target.organization_id == org.id
    assert target.linkage_immutable is True


@pytest.mark.django_db
def test_schedule_kinds_configurable_only() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = _published_template(actor=manager, org=org)
    program = create_sanitation_program(
        actor=manager,
        organization=org,
        checklist_template=template,
        code=f"K-{uuid.uuid4().hex[:5].upper()}",
        title="Kinds",
    )
    version = create_draft_program_version(actor=manager, program_id=program.id)
    for kind in SanitationScheduleKind.values:
        add_schedule_link(
            actor=manager,
            program_version_id=version.id,
            schedule_kind=kind,
            label=kind,
        )
    with pytest.raises(ValidationError):
        add_schedule_link(
            actor=manager,
            program_version_id=version.id,
            schedule_kind="HOURLY_INVENTED",
        )


@pytest.mark.django_db
def test_snapshot_none_and_policy_as_dict() -> None:
    assert snapshot_for_checklist_template(uuid.uuid4()) is None
    decision = evaluate_sanitation_fail_policy(
        organization_id=uuid.uuid4(), checklist_evaluation_failed=False
    )
    assert decision.as_dict()["stop_production"] is False
    assert decision.as_dict()["not_qa_disposition"] is True


@pytest.mark.django_db
def test_linked_schedule_creates_recurring_manual_task() -> None:
    """Sanitation schedule links reuse Phase 07E ChecklistSchedule occurrence generation."""
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = _published_template(actor=manager, org=org)
    program = create_sanitation_program(
        actor=manager,
        organization=org,
        checklist_template=template,
        code=f"R-{uuid.uuid4().hex[:5].upper()}",
        title="Recurring shell",
    )
    version = create_draft_program_version(actor=manager, program_id=program.id)
    schedule = create_checklist_schedule(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        code=f"SCH-{uuid.uuid4().hex[:5].upper()}",
        trigger_type=ChecklistTriggerType.MANUAL,
        name="Daily sanitation shell",
    )
    add_schedule_link(
        actor=manager,
        program_version_id=version.id,
        schedule_kind=SanitationScheduleKind.DAILY,
        checklist_schedule=schedule,
        label="Daily link",
    )
    approve_program_version(actor=manager, program_version_id=version.id)
    task = create_manual_schedule_occurrence(
        actor=manager,
        schedule_id=schedule.id,
        manual_token=f"san-{uuid.uuid4().hex[:8]}",
    )
    assert task.checklist_template_id == template.id
    assert task.schedule_id == schedule.id
    assert ChecklistTask.objects.filter(pk=task.id).exists()


@pytest.mark.django_db
def test_submission_freezes_sanitation_context() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = make_user(employee_code=f"SR{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(recorder, org, ChecklistTask, "record_checklisttask")
    template = _published_template(actor=manager, org=org)
    program = create_sanitation_program(
        actor=manager,
        organization=org,
        checklist_template=template,
        code=f"FZ-{uuid.uuid4().hex[:5].upper()}",
        title="Freeze program",
    )
    version = create_draft_program_version(
        actor=manager,
        program_id=program.id,
        verification_mode=SanitationVerificationMode.SELF_CHECK,
    )
    approve_program_version(actor=manager, program_version_id=version.id)
    bind_checklist_template_to_sanitation_program(actor=manager, program_version_id=version.id)
    published = template.versions.filter(status="PUBLISHED").first()
    assert published is not None
    section = published.sections.first()
    assert section is not None
    item = section.items.first()
    assert item is not None
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference=f"SAN-{uuid.uuid4().hex[:8].upper()}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={(item.id, 1): "YES"},
    )
    submit_checklist_record(actor=recorder, record_id=record.id)
    snap_row = ChecklistSubmissionResponse.objects.get(checklist_item=item)
    assert snap_row.control_point_context is not None
    assert "sanitation_context" in snap_row.control_point_context
    assert snap_row.control_point_context["sanitation_context"]["program_code"] == program.code
    assert snap_row.control_point_context["sanitation_context"]["reuses_checklist_engine"] is True
