"""Phase 06K — server-authoritative deterministic item evaluation."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import connection
from django.test.utils import CaptureQueriesContext
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistConditionRuleKind,
    ChecklistEvaluationResult,
    ChecklistEvaluationRuleKind,
    ChecklistItem,
    ChecklistItemKind,
    ChecklistResponseType,
    ChecklistTemplate,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_item_option,
    add_checklist_section,
    clear_checklist_item_evaluation_rule,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
    set_checklist_item_evaluation_rule,
    set_checklist_item_rule,
    update_checklist_item,
)
from apps.organizations.models import Organization
from apps.quality.models import QAReview
from apps.recording.models import ChecklistResponse, ChecklistSubmissionResponse
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
    user = make_user(employee_code=f"H06KM{suffix}", is_staff=True)
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
    user = make_user(employee_code=f"H06KR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RECR{suffix}",
        name=f"Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def _published_numeric(*, org: Organization, actor: User) -> dict[str, Any]:
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=actor, organization=org, code=f"T06K{suffix}", name=f"Eval {suffix}"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S1")
    number = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="NUM",
        label="Number",
        is_required=True,
        response_type=ChecklistResponseType.NUMBER,
    )
    set_checklist_item_evaluation_rule(
        actor=actor,
        item_id=number.id,
        rule_kind=ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
        bound_min=Decimal("10"),
        bound_max=Decimal("20"),
        min_inclusive=True,
        max_inclusive=True,
        warn_min=Decimal("5"),
        warn_max=Decimal("25"),
        warn_min_inclusive=True,
        warn_max_inclusive=True,
    )
    publish_checklist_version(actor=actor, version_id=version.id)
    number.refresh_from_db()
    return {
        "template": template,
        "version": version,
        "section": section,
        "number": number,
    }


@pytest.mark.django_db
def test_numeric_evaluation_in_out_boundary_and_warn() -> None:
    org = make_org(code=f"O06KN{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    published = _published_numeric(org=org, actor=manager)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=published["template"].id,
        checklist_version_id=published["version"].id,
        batch_reference=f"B06KN{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "15"},
    )
    draft = ChecklistResponse.objects.get(
        checklist_record_id=record.id, checklist_item_id=published["number"].id
    )
    assert draft.evaluation_result == ChecklistEvaluationResult.PASS
    assert draft.evaluation_context is not None
    assert draft.evaluation_context["not_qa_disposition"] is True

    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "7"},
    )
    draft.refresh_from_db()
    assert draft.evaluation_result == ChecklistEvaluationResult.WARN

    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "1"},
    )
    draft.refresh_from_db()
    assert draft.evaluation_result == ChecklistEvaluationResult.FAIL

    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "10"},
    )
    draft.refresh_from_db()
    assert draft.evaluation_result == ChecklistEvaluationResult.PASS
    assert QAReview.objects.count() == 0


@pytest.mark.django_db
def test_yes_no_na_select_and_missing_rule() -> None:
    org = make_org(code=f"O06KY{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=manager, organization=org, code=f"TY{suffix}", name=f"YN {suffix}"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    yn = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="YN",
        label="YN",
        is_required=True,
        response_type=ChecklistResponseType.YES_NO_NA,
    )
    select = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="SEL",
        label="Select",
        is_required=True,
        response_type=ChecklistResponseType.SELECT,
    )
    opt_ok = add_checklist_item_option(actor=manager, item_id=select.id, value="OK", label="OK")
    add_checklist_item_option(actor=manager, item_id=select.id, value="BAD", label="Bad")
    bare = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="BARE",
        label="Bare",
        is_required=True,
        response_type=ChecklistResponseType.NUMBER,
    )
    set_checklist_item_evaluation_rule(
        actor=manager,
        item_id=yn.id,
        rule_kind=ChecklistEvaluationRuleKind.EXPECTED_CHOICE,
        expected_choice="YES",
    )
    set_checklist_item_evaluation_rule(
        actor=manager,
        item_id=select.id,
        rule_kind=ChecklistEvaluationRuleKind.EXPECTED_OPTION,
        expected_option_id=opt_ok.id,
    )
    publish_checklist_version(actor=manager, version_id=version.id)

    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"BY{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={
            str(yn.id): "NA",
            str(select.id): str(opt_ok.id),
            str(bare.id): "42",
        },
    )
    assert (
        ChecklistResponse.objects.get(
            checklist_record_id=record.id, checklist_item_id=yn.id
        ).evaluation_result
        == ChecklistEvaluationResult.NOT_EVALUATED
    )
    assert (
        ChecklistResponse.objects.get(
            checklist_record_id=record.id, checklist_item_id=select.id
        ).evaluation_result
        == ChecklistEvaluationResult.PASS
    )
    bare_row = ChecklistResponse.objects.get(
        checklist_record_id=record.id, checklist_item_id=bare.id
    )
    assert bare_row.evaluation_result == ChecklistEvaluationResult.NOT_EVALUATED
    assert bare_row.evaluation_context is not None
    assert bare_row.evaluation_context["reason"] == "no_evaluation_rule_configured"


@pytest.mark.django_db
def test_calculated_value_evaluation() -> None:
    org = make_org(code=f"O06KC{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=manager, organization=org, code=f"TC{suffix}", name=f"Calc {suffix}"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    a = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="A",
        label="A",
        is_required=True,
        response_type=ChecklistResponseType.NUMBER,
    )
    b = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="B",
        label="B",
        is_required=True,
        response_type=ChecklistResponseType.NUMBER,
    )
    calc = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="SUM",
        label="Sum",
        item_kind=ChecklistItemKind.CALCULATED,
        calculation_operator="SUM",
        calculation_operand_ids=[a.id, b.id],
        is_required=True,
    )
    set_checklist_item_evaluation_rule(
        actor=manager,
        item_id=calc.id,
        rule_kind=ChecklistEvaluationRuleKind.CALCULATED_NUMERIC_BOUNDS,
        bound_min=Decimal("10"),
        bound_max=Decimal("30"),
        min_inclusive=True,
        max_inclusive=True,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"BC{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(a.id): "4", str(b.id): "7"},
    )
    calc_row = ChecklistResponse.objects.get(
        checklist_record_id=record.id, checklist_item_id=calc.id
    )
    assert calc_row.number_value == Decimal("11.0000")
    assert calc_row.evaluation_result == ChecklistEvaluationResult.PASS


@pytest.mark.django_db
def test_conditional_non_applicable_not_evaluated() -> None:
    org = make_org(code=f"O06KH{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=manager, organization=org, code=f"TH{suffix}", name=f"Hid {suffix}"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    gate = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="GATE",
        label="Gate",
        is_required=True,
        response_type=ChecklistResponseType.YES_NO,
    )
    detail = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="DET",
        label="Detail",
        is_required=False,
        response_type=ChecklistResponseType.NUMBER,
    )
    set_checklist_item_rule(
        actor=manager,
        target_item_id=detail.id,
        rule_kind=ChecklistConditionRuleKind.VISIBLE_IF,
        operand_item_id=gate.id,
        comparator="EQ",
        expected_text="YES",
    )
    set_checklist_item_evaluation_rule(
        actor=manager,
        item_id=detail.id,
        rule_kind=ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
        bound_min=Decimal("0"),
        bound_max=Decimal("10"),
        min_inclusive=True,
        max_inclusive=True,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"BH{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(gate.id): "NO"},
    )
    assert not ChecklistResponse.objects.filter(
        checklist_record_id=record.id, checklist_item_id=detail.id
    ).exists()


@pytest.mark.django_db
def test_client_spoofed_evaluation_overwritten_no_qareview() -> None:
    org = make_org(code=f"O06KS{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    published = _published_numeric(org=org, actor=manager)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=published["template"].id,
        checklist_version_id=published["version"].id,
        batch_reference=f"BS{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "1"},
    )
    draft = ChecklistResponse.objects.get(
        checklist_record_id=record.id, checklist_item_id=published["number"].id
    )
    assert draft.evaluation_result == ChecklistEvaluationResult.FAIL
    draft.evaluation_result = ChecklistEvaluationResult.PASS
    draft.save(update_fields=["evaluation_result", "updated_at"])
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "1"},
    )
    draft.refresh_from_db()
    assert draft.evaluation_result == ChecklistEvaluationResult.FAIL
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=submission.id,
        checklist_item_id=published["number"].id,
    )
    assert snap.evaluation_result == ChecklistEvaluationResult.FAIL
    assert snap.evaluation_context is not None
    assert snap.evaluation_context["not_qa_disposition"] is True
    assert QAReview.objects.count() == 0


@pytest.mark.django_db
def test_historical_snapshot_immune_to_future_rule_change() -> None:
    org = make_org(code=f"O06KH2{uuid.uuid4().hex[:4].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    published = _published_numeric(org=org, actor=manager)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=published["template"].id,
        checklist_version_id=published["version"].id,
        batch_reference=f"BH2{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "15"},
    )
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=submission.id,
        checklist_item_id=published["number"].id,
    )
    assert snap.evaluation_context is not None
    frozen = dict(snap.evaluation_context)
    assert snap.evaluation_result == ChecklistEvaluationResult.PASS

    draft = create_checklist_version(
        actor=manager,
        template_id=published["template"].id,
        source_version_id=published["version"].id,
    )
    cloned = ChecklistItem.objects.get(section__version_id=draft.id, code="NUM")
    clear_checklist_item_evaluation_rule(actor=manager, item_id=cloned.id)
    set_checklist_item_evaluation_rule(
        actor=manager,
        item_id=cloned.id,
        rule_kind=ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
        bound_min=Decimal("100"),
        bound_max=Decimal("200"),
        min_inclusive=True,
        max_inclusive=True,
    )
    publish_checklist_version(actor=manager, version_id=draft.id)

    snap.refresh_from_db()
    assert snap.evaluation_result == ChecklistEvaluationResult.PASS
    assert snap.evaluation_context == frozen
    assert snap.evaluation_context["rule"]["bound_min"] == "10.0000"


@pytest.mark.django_db
def test_correction_recalculates_new_immutable_evaluation() -> None:
    from apps.recording.correction_services import (
        resubmit_checklist_correction,
        start_checklist_correction,
    )
    from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
    from apps.reviews.services import create_supervisor_review

    org = make_org(code=f"O06KX{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    suffix = uuid.uuid4().hex[:8].upper()
    reviewer = make_user(employee_code=f"H06KV{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"SUP{suffix}",
        name=f"Supervisor {suffix}",
        permission=_perm(SupervisorReview, "review_checklistsubmission"),
    )
    grant_role(reviewer, role, organization=org)

    published = _published_numeric(org=org, actor=manager)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=published["template"].id,
        checklist_version_id=published["version"].id,
        batch_reference=f"BX{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "15"},
    )
    source = submit_checklist_record(actor=recorder, record_id=record.id)
    source_snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=source.id,
        checklist_item_id=published["number"].id,
    )
    assert source_snap.evaluation_context is not None
    frozen = dict(source_snap.evaluation_context)
    create_supervisor_review(
        actor=reviewer,
        submission_id=source.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        review_note="fix",
    )
    correction = start_checklist_correction(actor=recorder, source_submission_id=source.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(published["number"].id): "1"},
    )
    new_sub = resubmit_checklist_correction(actor=recorder, correction_id=correction.id)
    source_snap.refresh_from_db()
    assert source_snap.evaluation_context == frozen
    assert source_snap.evaluation_result == ChecklistEvaluationResult.PASS
    new_snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=new_sub.id,
        checklist_item_id=published["number"].id,
    )
    assert new_snap.evaluation_result == ChecklistEvaluationResult.FAIL
    assert new_snap.evaluation_context != frozen
    assert QAReview.objects.count() == 0


@pytest.mark.django_db
def test_evaluation_rule_requires_explicit_inclusivity_and_audits() -> None:
    org = make_org(code=f"O06KA{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"TA{uuid.uuid4().hex[:6].upper()}", name="A"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    number = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="N",
        label="N",
        response_type=ChecklistResponseType.NUMBER,
    )
    with pytest.raises(ValidationError):
        set_checklist_item_evaluation_rule(
            actor=manager,
            item_id=number.id,
            rule_kind=ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
            bound_min=Decimal("1"),
            bound_max=Decimal("2"),
            # missing inclusivity — must not invent defaults
        )
    set_checklist_item_evaluation_rule(
        actor=manager,
        item_id=number.id,
        rule_kind=ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
        bound_min=Decimal("1"),
        bound_max=Decimal("2"),
        min_inclusive=True,
        max_inclusive=False,
    )
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_ITEM_EVALUATION_RULE_SET"
    ).exists()
    clear_checklist_item_evaluation_rule(actor=manager, item_id=number.id)
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_ITEM_EVALUATION_RULE_CLEARED"
    ).exists()


@pytest.mark.django_db
def test_cross_org_evaluation_rule_denied() -> None:
    org_a = make_org(code=f"OA{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"OB{uuid.uuid4().hex[:6].upper()}")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    published = _published_numeric(org=org_a, actor=manager_a)
    draft = create_checklist_version(
        actor=manager_a,
        template_id=published["template"].id,
        source_version_id=published["version"].id,
    )
    number = ChecklistItem.objects.get(section__version_id=draft.id, code="NUM")
    with pytest.raises(PermissionDenied):
        set_checklist_item_evaluation_rule(
            actor=manager_b,
            item_id=number.id,
            rule_kind=ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
            bound_min=Decimal("0"),
            bound_max=Decimal("1"),
            min_inclusive=True,
            max_inclusive=True,
        )


@pytest.mark.django_db
def test_evaluation_save_query_budget() -> None:
    org = make_org(code=f"O06KP{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    published = _published_numeric(org=org, actor=manager)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=published["template"].id,
        checklist_version_id=published["version"].id,
        batch_reference=f"BP{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    with CaptureQueriesContext(connection) as ctx:
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={str(published["number"].id): "12"},
        )
    # Bound is generous — guards runaway N+1 while remaining portable.
    assert len(ctx.captured_queries) < 80


@pytest.mark.django_db
def test_informational_minmax_not_evaluation_without_rule() -> None:
    org = make_org(code=f"O06KI{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    suffix = uuid.uuid4().hex[:6].upper()
    template = create_checklist_template(
        actor=manager, organization=org, code=f"TI{suffix}", name=f"Info {suffix}"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    number = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="N",
        label="N",
        is_required=True,
        response_type=ChecklistResponseType.NUMBER,
    )
    update_checklist_item(
        actor=manager,
        item_id=number.id,
        minimum_value=Decimal("0"),
        maximum_value=Decimal("1"),
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"BI{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(number.id): "99"},
    )
    row = ChecklistResponse.objects.get(checklist_record_id=record.id, checklist_item_id=number.id)
    assert row.evaluation_result == ChecklistEvaluationResult.NOT_EVALUATED
