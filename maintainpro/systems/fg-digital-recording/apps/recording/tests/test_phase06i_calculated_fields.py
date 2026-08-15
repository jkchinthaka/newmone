"""Phase 06I — safe deterministic calculated checklist fields."""

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
from apps.checklists.calculation import CALCULATION_OPERATORS, apply_operator, assert_known_operator
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
    set_checklist_calculation_operands,
    update_checklist_item,
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
    user = make_user(employee_code=f"H06IM{suffix}", is_staff=True)
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
    user = make_user(employee_code=f"H06IR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RECR{suffix}",
        name=f"Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def _published_calculated(*, org: Organization, actor: User, operator: str) -> dict[str, Any]:
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=actor, organization=org, code=f"H06I{suffix}", name=f"H06I Template {suffix}"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Calc")
    a = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="A",
        label="A",
        response_type=ChecklistResponseType.NUMBER,
        is_required=True,
    )
    b = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="B",
        label="B",
        response_type=ChecklistResponseType.NUMBER,
        is_required=True,
    )
    calc = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="C",
        label="Calculated",
        item_kind=ChecklistItemKind.CALCULATED,
        calculation_operator=operator,
        calculation_operand_ids=[a.id, b.id],
        is_required=True,
    )
    publish_checklist_version(actor=actor, version_id=version.id)
    return {
        "template": template,
        "version": version,
        "a": a,
        "b": b,
        "calc": calc,
    }


@pytest.mark.django_db
def test_operator_whitelist_rejects_eval_payloads() -> None:
    for bad in ("eval", "SUM; import os", "__import__", "AVERAGE()", "x + y"):
        with pytest.raises(ValidationError):
            assert_known_operator(bad)
    assert CALCULATION_OPERATORS == {"SUM", "AVERAGE", "MIN", "MAX", "COUNT", "RANGE"}


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("operator", "values", "expected"),
    [
        ("SUM", [Decimal("1.1"), Decimal("2.2")], Decimal("3.3000")),
        ("AVERAGE", [Decimal("1"), Decimal("2"), Decimal("3")], Decimal("2.0000")),
        ("MIN", [Decimal("5"), Decimal("1.25")], Decimal("1.2500")),
        ("MAX", [Decimal("5"), Decimal("1.25")], Decimal("5.0000")),
        ("COUNT", [Decimal("5"), Decimal("1.25")], Decimal("2.0000")),
        ("RANGE", [Decimal("5"), Decimal("1.25")], Decimal("3.7500")),
    ],
)
def test_decimal_operators(operator: str, values: list[Decimal], expected: Decimal) -> None:
    assert apply_operator(operator=operator, values=values) == expected


@pytest.mark.django_db
def test_sum_average_snapshot_and_client_injection_ignored() -> None:
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    built = _published_calculated(org=org, actor=manager, operator="SUM")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=built["template"].id,
        checklist_version_id=built["version"].id,
        batch_reference=f"B-{uuid.uuid4().hex[:6]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={
            built["a"].id: Decimal("10.5"),
            built["b"].id: Decimal("0.5"),
            built["calc"].id: Decimal("9999"),
        },
    )
    calc_row = ChecklistResponse.objects.get(
        checklist_record_id=record.id, checklist_item_id=built["calc"].id
    )
    assert calc_row.number_value == Decimal("11.0000")
    assert calc_row.calculation_context is not None
    assert calc_row.calculation_context["operator"] == "SUM"
    assert Decimal(calc_row.calculation_context["result"]) == Decimal("11")

    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=submission.id, checklist_item_id=built["calc"].id
    )
    assert snap.number_value == Decimal("11.0000")
    assert snap.calculation_context is not None
    assert snap.calculation_context["operator"] == "SUM"
    frozen = dict(snap.calculation_context)
    assert Decimal(frozen["inputs"][0]["number_value"]) == Decimal("10.5")
    assert Decimal(frozen["inputs"][1]["number_value"]) == Decimal("0.5")
    assert ChecklistSubmissionResponse.objects.filter(pk=snap.pk).count() == 1


@pytest.mark.django_db
def test_missing_values_and_invalid_operand_type() -> None:
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    built = _published_calculated(org=org, actor=manager, operator="AVERAGE")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=built["template"].id,
        checklist_version_id=built["version"].id,
        batch_reference=f"B-{uuid.uuid4().hex[:6]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={built["a"].id: Decimal("4")},
    )
    calc_qs = ChecklistResponse.objects.filter(
        checklist_record_id=record.id, checklist_item_id=built["calc"].id
    )
    if calc_qs.exists():
        assert calc_qs.get().number_value == Decimal("4.0000")

    version = create_checklist_version(
        actor=manager, template_id=built["template"].id, source_version_id=built["version"].id
    )
    section = version.sections.get()
    text = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="TXT",
        label="Text",
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
    )
    calc = ChecklistItem.objects.get(section=section, code="C")
    with pytest.raises(ValidationError):
        set_checklist_calculation_operands(
            actor=manager, item_id=calc.id, source_item_ids=[text.id]
        )


@pytest.mark.django_db
def test_circular_reference_rejected() -> None:
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"CIRC{uuid.uuid4().hex[:6].upper()}", name="Circ"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    a = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="A",
        label="A",
        response_type=ChecklistResponseType.NUMBER,
    )
    c1 = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="C1",
        label="C1",
        item_kind=ChecklistItemKind.CALCULATED,
        calculation_operator="SUM",
        calculation_operand_ids=[a.id],
        is_required=False,
    )
    c2 = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="C2",
        label="C2",
        item_kind=ChecklistItemKind.CALCULATED,
        calculation_operator="SUM",
        calculation_operand_ids=[c1.id],
        is_required=False,
    )
    with pytest.raises(ValidationError):
        set_checklist_calculation_operands(actor=manager, item_id=c1.id, source_item_ids=[c2.id])


@pytest.mark.django_db
def test_repeating_sample_calculated_child() -> None:
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=manager, organization=org, code=f"REP{suffix}", name=f"Rep {suffix}"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="Samples")
    group = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="GRP",
        label="Group",
        item_kind=ChecklistItemKind.REPEATING_GROUP,
        is_required=False,
        response_type="",
    )
    n1 = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="N1",
        label="N1",
        response_type=ChecklistResponseType.NUMBER,
        parent_item_id=group.id,
        is_required=True,
    )
    n2 = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="N2",
        label="N2",
        response_type=ChecklistResponseType.NUMBER,
        parent_item_id=group.id,
        is_required=True,
    )
    calc = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="SUMR",
        label="Row sum",
        item_kind=ChecklistItemKind.CALCULATED,
        calculation_operator="SUM",
        calculation_operand_ids=[n1.id, n2.id],
        parent_item_id=group.id,
        is_required=True,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"B-{suffix}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={
            (n1.id, 1): Decimal("2"),
            (n2.id, 1): Decimal("3"),
            (n1.id, 2): Decimal("4"),
            (n2.id, 2): Decimal("6"),
        },
    )
    assert ChecklistResponse.objects.get(
        checklist_record_id=record.id, checklist_item_id=calc.id, sample_index=1
    ).number_value == Decimal("5.0000")
    assert ChecklistResponse.objects.get(
        checklist_record_id=record.id, checklist_item_id=calc.id, sample_index=2
    ).number_value == Decimal("10.0000")
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    assert (
        ChecklistSubmissionResponse.objects.filter(
            checklist_submission_id=submission.id, checklist_item_id=calc.id
        ).count()
        == 2
    )


@pytest.mark.django_db
def test_count_min_max_range_operators_end_to_end() -> None:
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    for operator, expected in (
        ("COUNT", Decimal("2.0000")),
        ("MIN", Decimal("3.0000")),
        ("MAX", Decimal("9.0000")),
        ("RANGE", Decimal("6.0000")),
    ):
        built = _published_calculated(org=org, actor=manager, operator=operator)
        task = create_batch_checklist_task(
            actor=manager,
            organization_id=org.id,
            checklist_template_id=built["template"].id,
            checklist_version_id=built["version"].id,
            batch_reference=f"B-{operator}-{uuid.uuid4().hex[:4]}",
        )
        record = start_checklist_recording(actor=recorder, task_id=task.id)
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={built["a"].id: Decimal("9"), built["b"].id: Decimal("3")},
        )
        calc_row = ChecklistResponse.objects.get(
            checklist_record_id=record.id, checklist_item_id=built["calc"].id
        )
        assert calc_row.number_value == expected


@pytest.mark.django_db
def test_empty_operator_inputs_return_none() -> None:
    assert apply_operator(operator="SUM", values=[]) is None
    assert apply_operator(operator="COUNT", values=[]) == Decimal("0.0000")


@pytest.mark.django_db
def test_snapshot_render_includes_calculated_context() -> None:
    from apps.recording.snapshot_display import render_snapshot_sections

    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    built = _published_calculated(org=org, actor=manager, operator="SUM")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=built["template"].id,
        checklist_version_id=built["version"].id,
        batch_reference=f"B-SNAP-{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={built["a"].id: Decimal("2"), built["b"].id: Decimal("3")},
    )
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    sections = list(built["version"].sections.prefetch_related("items"))
    snaps = {
        (row.checklist_item_id, row.sample_index): row
        for row in ChecklistSubmissionResponse.objects.filter(checklist_submission_id=submission.id)
    }
    rendered = render_snapshot_sections(sections, snaps)
    kinds = {row["kind"] for block in rendered for row in block["items"]}
    assert "calculated" in kinds
    calc_rows = [row for block in rendered for row in block["items"] if row["kind"] == "calculated"]
    assert calc_rows[0]["display_value"].startswith("5")


@pytest.mark.django_db
def test_clone_preserves_calculation_operands() -> None:
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    built = _published_calculated(org=org, actor=manager, operator="AVERAGE")
    cloned = create_checklist_version(
        actor=manager,
        template_id=built["template"].id,
        source_version_id=built["version"].id,
    )
    calc = ChecklistItem.objects.get(section__version_id=cloned.id, code="C")
    assert calc.calculation_operator == "AVERAGE"
    operand_codes = [
        link.source_item.code
        for link in calc.calculation_operand_links.select_related("source_item").order_by(
            "position"
        )
    ]
    assert operand_codes == ["A", "B"]


@pytest.mark.django_db
def test_cross_group_operand_rejected() -> None:
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"XG{uuid.uuid4().hex[:6].upper()}", name="XG"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    top = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="TOP",
        label="Top",
        response_type=ChecklistResponseType.NUMBER,
    )
    group = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="GRP",
        label="Group",
        item_kind=ChecklistItemKind.REPEATING_GROUP,
        is_required=False,
        response_type="",
    )
    child = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="CH",
        label="Child",
        response_type=ChecklistResponseType.NUMBER,
        parent_item_id=group.id,
    )
    calc = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="CX",
        label="Calc",
        item_kind=ChecklistItemKind.CALCULATED,
        calculation_operator="SUM",
        calculation_operand_ids=[top.id],
        is_required=False,
    )
    with pytest.raises(ValidationError):
        set_checklist_calculation_operands(
            actor=manager, item_id=calc.id, source_item_ids=[child.id]
        )


@pytest.mark.django_db
def test_calculated_preview_tag() -> None:
    from apps.recording.templatetags.recording_extras import calculated_preview

    class _Row:
        number_value = Decimal("1.2500")

    class _Item:
        id = uuid.uuid4()
        unit = "C"

    item = _Item()
    assert calculated_preview({(item.id, 1): _Row()}, item, 1) == "1.25 C"
    assert calculated_preview({}, item, 1) == "—"


@pytest.mark.django_db
def test_query_budget_calculated_save() -> None:
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    built = _published_calculated(org=org, actor=manager, operator="RANGE")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=built["template"].id,
        checklist_version_id=built["version"].id,
        batch_reference=f"B-{uuid.uuid4().hex[:6]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    with CaptureQueriesContext(connection) as ctx:
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={built["a"].id: Decimal("9"), built["b"].id: Decimal("3")},
        )
    assert len(ctx) < 60


def _reviewer(*, org: Organization) -> User:
    from apps.reviews.models import SupervisorReview

    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"H06IV{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RVWR{suffix}",
        name=f"Reviewer {suffix}",
        permission=_perm(SupervisorReview, "review_checklistsubmission"),
    )
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_correction_recalculates_and_preserves_historical_snapshot() -> None:
    """Correction recomputes CALCULATED values; source snapshot stays immutable."""
    from apps.recording.correction_services import (
        resubmit_checklist_correction,
        start_checklist_correction,
    )
    from apps.reviews.models import SupervisorReviewDecision
    from apps.reviews.services import create_supervisor_review

    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    reviewer = _reviewer(org=org)
    built = _published_calculated(org=org, actor=manager, operator="SUM")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=built["template"].id,
        checklist_version_id=built["version"].id,
        batch_reference=f"B-CORR-{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={built["a"].id: Decimal("10"), built["b"].id: Decimal("5")},
    )
    source = submit_checklist_record(actor=recorder, record_id=record.id)
    source_snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=source.id, checklist_item_id=built["calc"].id
    )
    assert source_snap.number_value == Decimal("15.0000")
    assert source_snap.calculation_context is not None
    frozen_context = dict(source_snap.calculation_context)
    source_snap_id = source_snap.id

    create_supervisor_review(
        actor=reviewer,
        submission_id=source.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        review_note="Recalculate inputs.",
    )
    correction = start_checklist_correction(actor=recorder, source_submission_id=source.id)
    # Client injects bogus calculated value; server must recompute from corrected operands.
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={
            built["a"].id: Decimal("20"),
            built["b"].id: Decimal("7"),
            built["calc"].id: Decimal("9999"),
        },
    )
    resulting = resubmit_checklist_correction(actor=recorder, correction_id=correction.id)
    assert resulting.submission_number == 2

    source_snap.refresh_from_db()
    assert source_snap.id == source_snap_id
    assert source_snap.number_value == Decimal("15.0000")
    assert source_snap.calculation_context == frozen_context

    new_snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=resulting.id, checklist_item_id=built["calc"].id
    )
    assert new_snap.number_value == Decimal("27.0000")
    assert new_snap.calculation_context is not None
    assert Decimal(new_snap.calculation_context["result"]) == Decimal("27")
    assert Decimal(new_snap.calculation_context["inputs"][0]["number_value"]) == Decimal("20")


@pytest.mark.django_db
def test_cross_org_calculated_item_rejected() -> None:
    org_a = make_org(code=f"O6IA{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"O6IB{uuid.uuid4().hex[:5].upper()}")
    manager_a = _manager(org=org_a)
    recorder_a = _recorder(org=org_a)
    manager_b = _manager(org=org_b)
    built_a = _published_calculated(org=org_a, actor=manager_a, operator="SUM")
    built_b = _published_calculated(org=org_b, actor=manager_b, operator="SUM")

    task = create_batch_checklist_task(
        actor=manager_a,
        organization_id=org_a.id,
        checklist_template_id=built_a["template"].id,
        checklist_version_id=built_a["version"].id,
        batch_reference=f"B-XORG-{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder_a, task_id=task.id)
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder_a,
            record_id=record.id,
            answers={
                built_a["a"].id: Decimal("1"),
                built_a["b"].id: Decimal("2"),
                built_b["calc"].id: Decimal("3"),
            },
        )

    # Foreign operand IDs must fail on draft definitions (same-version scope).
    draft_template = create_checklist_template(
        actor=manager_a,
        organization=org_a,
        code=f"DX{uuid.uuid4().hex[:6].upper()}",
        name="Draft cross-org",
    )
    draft_version = create_checklist_version(actor=manager_a, template_id=draft_template.id)
    draft_section = add_checklist_section(actor=manager_a, version_id=draft_version.id, title="S")
    local_a = add_checklist_item(
        actor=manager_a,
        section_id=draft_section.id,
        code="A",
        label="A",
        response_type=ChecklistResponseType.NUMBER,
    )
    calc_draft = add_checklist_item(
        actor=manager_a,
        section_id=draft_section.id,
        code="C",
        label="Calc",
        item_kind=ChecklistItemKind.CALCULATED,
        calculation_operator="SUM",
        calculation_operand_ids=[local_a.id],
        is_required=False,
    )
    with pytest.raises(ValidationError):
        set_checklist_calculation_operands(
            actor=manager_a,
            item_id=calc_draft.id,
            source_item_ids=[built_b["a"].id],
        )


@pytest.mark.django_db
def test_historical_snapshot_survives_new_version_definition() -> None:
    """Published calculation context must not be reinterpreted after definition clone."""
    org = make_org(code=f"O6I{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    built = _published_calculated(org=org, actor=manager, operator="SUM")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=built["template"].id,
        checklist_version_id=built["version"].id,
        batch_reference=f"B-HIST-{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={built["a"].id: Decimal("4"), built["b"].id: Decimal("6")},
    )
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=submission.id, checklist_item_id=built["calc"].id
    )
    assert snap.number_value == Decimal("10.0000")
    assert snap.calculation_context is not None
    frozen = dict(snap.calculation_context)

    # Clone and change operator on the *new* draft version only.
    cloned = create_checklist_version(
        actor=manager,
        template_id=built["template"].id,
        source_version_id=built["version"].id,
    )
    calc_clone = ChecklistItem.objects.get(section__version_id=cloned.id, code="C")
    update_checklist_item(
        actor=manager,
        item_id=calc_clone.id,
        calculation_operator="AVERAGE",
    )

    snap.refresh_from_db()
    assert snap.number_value == Decimal("10.0000")
    assert snap.calculation_context == frozen
    assert snap.calculation_context is not None
    assert snap.calculation_context["operator"] == "SUM"
