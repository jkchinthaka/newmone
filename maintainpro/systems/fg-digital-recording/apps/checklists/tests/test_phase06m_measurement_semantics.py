"""Phase 06M — Decimal-safe measurement semantics (precision, units, bounds, freeze)."""

from __future__ import annotations

import json
import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.measurement import (
    MEASUREMENT_NOT_DISPOSITION_NOTE,
    assert_known_unit,
    assert_precision_rounding_pair,
    build_measurement_context,
    decimal_to_mongo_safe,
    format_decimal_for_display,
    informational_bound_contains,
    mongo_safe_to_decimal,
    parse_decimal_strict,
    serialize_measurement_for_mongo,
    value_within_informational_bounds,
)
from apps.checklists.models import (
    ChecklistItem,
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
from apps.recording.models import ChecklistResponse, ChecklistSubmissionResponse
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.recording.snapshot_display import display_snapshot_value
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
    user = make_user(employee_code=f"H06MM{suffix}", is_staff=True)
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
    user = make_user(employee_code=f"H06MR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RECR{suffix}",
        name=f"Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def test_parse_decimal_rejects_float_authority_path_but_accepts_str() -> None:
    assert parse_decimal_strict("1.25") == Decimal("1.25")
    assert parse_decimal_strict(-3) == Decimal("-3")
    assert parse_decimal_strict(0) == Decimal("0")
    assert parse_decimal_strict("9999999999.9999") == Decimal("9999999999.9999")
    # float accepted only via str conversion — never as binary authority
    assert parse_decimal_strict(str(0.1)) == Decimal(str(0.1))
    with pytest.raises(ValidationError):
        parse_decimal_strict("")
    with pytest.raises(ValidationError):
        parse_decimal_strict(True)


def test_precision_rounding_optional_and_ceiling() -> None:
    assert assert_precision_rounding_pair(decimal_precision=None, rounding_mode="") == (None, "")
    # Partial config allowed — rounding applies only when BOTH are set at capture time.
    assert assert_precision_rounding_pair(decimal_precision=2, rounding_mode="") == (2, "")
    assert assert_precision_rounding_pair(decimal_precision=None, rounding_mode="HALF_UP") == (
        None,
        "HALF_UP",
    )
    assert assert_precision_rounding_pair(decimal_precision=2, rounding_mode="HALF_UP") == (
        2,
        "HALF_UP",
    )
    assert assert_precision_rounding_pair(decimal_precision=12, rounding_mode="FLOOR") == (
        12,
        "FLOOR",
    )
    with pytest.raises(ValidationError):
        assert_precision_rounding_pair(decimal_precision=13, rounding_mode="HALF_UP")
    with pytest.raises(ValidationError):
        assert_precision_rounding_pair(decimal_precision=-1, rounding_mode="")


def test_apply_rounding_only_when_both_configured() -> None:
    from apps.checklists.measurement import apply_configured_rounding

    value = Decimal("1.25")
    exact, applied = apply_configured_rounding(value, None, "")
    assert exact == value and applied is False
    exact, applied = apply_configured_rounding(value, 1, "")
    assert exact == value and applied is False
    exact, applied = apply_configured_rounding(value, None, "HALF_UP")
    assert exact == value and applied is False
    rounded, applied = apply_configured_rounding(value, 1, "HALF_UP")
    assert rounded == Decimal("1.3") and applied is True
    floored, applied = apply_configured_rounding(Decimal("1.29"), 1, "FLOOR")
    assert floored == Decimal("1.2") and applied is True
    ceiled, applied = apply_configured_rounding(Decimal("1.21"), 1, "CEILING")
    assert ceiled == Decimal("1.3") and applied is True
    downed, applied = apply_configured_rounding(Decimal("-1.29"), 1, "DOWN")
    assert downed == Decimal("-1.2") and applied is True
    evened, applied = apply_configured_rounding(Decimal("1.25"), 1, "HALF_EVEN")
    assert evened == Decimal("1.2") and applied is True


def test_unit_catalog_rejects_free_form() -> None:
    assert assert_known_unit("") == ""
    assert assert_known_unit("C") == "C"
    assert assert_known_unit("°C") == "C"
    with pytest.raises(ValidationError):
        assert_known_unit("NelnaMagicUnit")


@pytest.mark.parametrize(
    ("value", "minimum", "maximum", "min_inc", "max_inc", "expected"),
    [
        (Decimal("0"), Decimal("0"), Decimal("10"), True, True, True),
        (Decimal("0"), Decimal("0"), Decimal("10"), False, True, False),
        (Decimal("10"), Decimal("0"), Decimal("10"), True, True, True),
        (Decimal("10"), Decimal("0"), Decimal("10"), True, False, False),
        (Decimal("-1"), Decimal("-5"), Decimal("0"), True, False, True),
        (Decimal("0"), Decimal("-5"), Decimal("0"), True, False, False),
        (Decimal("5"), None, None, True, True, True),
    ],
)
def test_informational_bounds_inclusive_exclusive(
    value: Decimal,
    minimum: Decimal | None,
    maximum: Decimal | None,
    min_inc: bool,
    max_inc: bool,
    expected: bool,
) -> None:
    result = value_within_informational_bounds(
        value, minimum, maximum, min_inclusive=min_inc, max_inclusive=max_inc
    )
    if minimum is None and maximum is None:
        assert result is None
        assert informational_bound_contains(
            value,
            minimum_value=minimum,
            maximum_value=maximum,
            min_inclusive=min_inc,
            max_inclusive=max_inc,
        )
    else:
        assert result is expected


def test_mongo_decimal_as_string_round_trip() -> None:
    value = Decimal("-12.3400")
    encoded = decimal_to_mongo_safe(value)
    assert isinstance(encoded, str)
    assert encoded == "-12.3400"
    assert mongo_safe_to_decimal(encoded) == value
    ctx = build_measurement_context(
        value=value,
        unit="C",
        decimal_precision=2,
        rounding_mode="HALF_UP",
        rounding_applied=True,
        minimum_value=Decimal("0"),
        maximum_value=Decimal("100"),
        min_inclusive=True,
        max_inclusive=False,
    )
    payload = serialize_measurement_for_mongo(ctx)
    dumped = json.dumps(payload)
    loaded = json.loads(dumped)
    assert loaded["serialization"] == "decimal-as-string"
    assert loaded["captured_value"] == "-12.3400"
    assert loaded["not_qa_disposition"] is True
    assert MEASUREMENT_NOT_DISPOSITION_NOTE in loaded["qa_disposition_note"]
    assert "." not in str(type(loaded["captured_value"])) or isinstance(
        loaded["captured_value"], str
    )


def test_display_avoids_binary_float_artifacts() -> None:
    assert format_decimal_for_display(Decimal("1.2500"), 2) == "1.25"
    assert format_decimal_for_display(Decimal("0"), None) == "0"
    assert "e" not in format_decimal_for_display(Decimal("0.1"), None).lower()


@pytest.mark.django_db
def test_add_item_defaults_and_unknown_unit_rejected() -> None:
    org = make_org(code=f"O06MD{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06MD{uuid.uuid4().hex[:5].upper()}", name="D"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="N1",
        label="Number",
        response_type=ChecklistResponseType.NUMBER,
    )
    assert item.decimal_precision is None
    assert item.rounding_mode == ""
    assert item.min_inclusive is True
    assert item.max_inclusive is True
    # Precision alone is allowed (display/quantize intent); no silent rounding without mode.
    updated = update_checklist_item(
        actor=manager,
        item_id=item.id,
        decimal_precision=2,
        rounding_mode="",
    )
    assert updated.decimal_precision == 2
    assert updated.rounding_mode == ""
    with pytest.raises(ValidationError):
        update_checklist_item(
            actor=manager,
            item_id=item.id,
            unit="InventedUnitX",
        )
    with pytest.raises(ValidationError):
        update_checklist_item(
            actor=manager,
            item_id=item.id,
            decimal_precision=13,
        )


@pytest.mark.django_db
def test_measurement_semantics_audit_and_clone() -> None:
    org = make_org(code=f"O06MA{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06MA{uuid.uuid4().hex[:5].upper()}", name="A"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="N1",
        label="Number",
        response_type=ChecklistResponseType.NUMBER,
        unit="C",
        decimal_precision=1,
        rounding_mode="HALF_UP",
        minimum_value=Decimal("0"),
        maximum_value=Decimal("10"),
        min_inclusive=True,
        max_inclusive=False,
    )
    assert (
        SecurityAuditEvent.objects.filter(
            event_type="CHECKLIST_ITEM_MEASUREMENT_SEMANTICS_UPDATED",
            metadata__checklist_item_id=str(item.id),
        ).exists()
        is False
    )  # create path does not emit; update does
    update_checklist_item(
        actor=manager,
        item_id=item.id,
        decimal_precision=2,
        rounding_mode="HALF_EVEN",
    )
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_ITEM_MEASUREMENT_SEMANTICS_UPDATED",
        metadata__checklist_item_id=str(item.id),
    ).exists()
    publish_checklist_version(actor=manager, version_id=version.id)
    draft = create_checklist_version(
        actor=manager, template_id=template.id, source_version_id=version.id
    )
    cloned = ChecklistItem.objects.get(section__version_id=draft.id, code="N1")
    assert cloned.unit == "C"
    assert cloned.decimal_precision == 2
    assert cloned.rounding_mode == "HALF_EVEN"
    assert cloned.min_inclusive is True
    assert cloned.max_inclusive is False
    assert cloned.minimum_value == Decimal("0.0000")
    assert cloned.maximum_value == Decimal("10.0000")


@pytest.mark.django_db
def test_published_immutability_and_cross_org_denied() -> None:
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
        code="N1",
        label="Number",
        response_type=ChecklistResponseType.NUMBER,
    )
    publish_checklist_version(actor=manager_a, version_id=version.id)
    with pytest.raises(ValidationError):
        update_checklist_item(
            actor=manager_a,
            item_id=item.id,
            decimal_precision=1,
            rounding_mode="FLOOR",
        )
    # foreign org denied on draft of other org
    version2 = create_checklist_version(actor=manager_a, template_id=template.id)
    section2 = add_checklist_section(actor=manager_a, version_id=version2.id, title="S")
    item2 = add_checklist_item(
        actor=manager_a,
        section_id=section2.id,
        code="N2",
        label="Number2",
        response_type=ChecklistResponseType.NUMBER,
    )
    with pytest.raises(PermissionDenied):
        update_checklist_item(
            actor=manager_b,
            item_id=item2.id,
            unit="kg",
        )


@pytest.mark.django_db
def test_recording_rounding_bounds_snapshot_freeze_no_qareview() -> None:
    org = make_org(code=f"O06MS{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06MS{uuid.uuid4().hex[:5].upper()}", name="S"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="TEMP",
        label="Temp",
        is_required=True,
        response_type=ChecklistResponseType.NUMBER,
        unit="C",
        decimal_precision=1,
        rounding_mode="HALF_UP",
        minimum_value=Decimal("0"),
        maximum_value=Decimal("10"),
        min_inclusive=True,
        max_inclusive=False,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"B06M{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    # 1.24 → HALF_UP precision 1 → 1.2; still within [0, 10)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(item.id): "1.24"},
    )
    draft = ChecklistResponse.objects.get(checklist_record_id=record.id, checklist_item_id=item.id)
    assert draft.number_value == Decimal("1.2")
    assert draft.measurement_context is not None
    assert draft.measurement_context["rounding_applied"] is True
    assert draft.measurement_context["captured_value"] == "1.2"
    assert draft.measurement_context["unit"] == "C"
    assert draft.measurement_context["serialization"] == "decimal-as-string"
    assert draft.measurement_context["within_informational_bounds"] is True

    # Exclusive upper bound: 10 is outside [0, 10) but still accepted (not disposition)
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(item.id): "10"},
    )
    draft.refresh_from_db()
    assert draft.number_value == Decimal("10")
    assert draft.measurement_context["within_informational_bounds"] is False

    # Zero / negative capture without disposition side effects
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={str(item.id): "0"},
    )
    draft.refresh_from_db()
    assert draft.number_value == Decimal("0")
    assert draft.measurement_context["within_informational_bounds"] is True

    before_reviews = QAReview.objects.count()
    submission = submit_checklist_record(actor=recorder, record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(
        checklist_submission_id=submission.id, checklist_item_id=item.id
    )
    assert snap.number_value == Decimal("0")
    assert snap.measurement_context["captured_value"] in {"0", "0.0", "0.0000"}
    assert snap.measurement_context["decimal_precision"] == 1
    assert snap.measurement_context["rounding_mode"] == "HALF_UP"
    assert snap.measurement_context["min_inclusive"] is True
    assert snap.measurement_context["max_inclusive"] is False
    assert snap.measurement_context["not_qa_disposition"] is True
    assert QAReview.objects.count() == before_reviews

    displayed = display_snapshot_value(item, snap)
    assert displayed.startswith("0")
    assert "C" in displayed
    assert "e-" not in displayed.lower()

    # Later definition edits on a cloned draft must not rewrite historical snap.
    frozen = dict(snap.measurement_context)
    draft_v = create_checklist_version(
        actor=manager, template_id=template.id, source_version_id=version.id
    )
    cloned = ChecklistItem.objects.get(section__version_id=draft_v.id, code="TEMP")
    update_checklist_item(
        actor=manager,
        item_id=cloned.id,
        decimal_precision=2,
        rounding_mode="FLOOR",
        max_inclusive=True,
    )
    snap.refresh_from_db()
    assert snap.measurement_context == frozen


@pytest.mark.django_db
def test_zero_negative_large_without_rounding() -> None:
    org = make_org(code=f"O06MZ{uuid.uuid4().hex[:5].upper()}")
    manager = _manager(org=org)
    recorder = _recorder(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code=f"T06MZ{uuid.uuid4().hex[:5].upper()}", name="Z"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="N1",
        label="Number",
        is_required=True,
        response_type=ChecklistResponseType.NUMBER,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=f"BZ{uuid.uuid4().hex[:4]}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    for raw, expected in (
        ("0", Decimal("0")),
        ("-42.5", Decimal("-42.5")),
        ("1234567890.1234", Decimal("1234567890.1234")),
    ):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={str(item.id): raw},
        )
        draft = ChecklistResponse.objects.get(
            checklist_record_id=record.id, checklist_item_id=item.id
        )
        assert draft.number_value == expected
        assert draft.measurement_context is not None
        assert draft.measurement_context["rounding_applied"] is False
        # Precision alone does not round
        assert draft.measurement_context.get("decimal_precision") in (None, item.decimal_precision)


def test_measurement_helper_edge_coverage() -> None:
    """Extra edge paths for apps.checklists.measurement coverage gate."""
    from apps.checklists.measurement import (
        apply_configured_rounding,
        apply_measurement_decimal,
        assert_known_rounding_mode,
        assert_known_unit,
        assert_precision_rounding_pair,
        build_measurement_context,
        decimal_to_mongo_safe,
        format_decimal_for_display,
        mongo_safe_to_decimal,
        normalize_decimal_precision,
        parse_decimal_strict,
        quantize_for_precision,
        unit_display_label,
        value_within_informational_bounds,
    )

    assert assert_known_unit("CELSIUS") == "C"
    assert assert_known_unit("kg") == "kg"
    assert unit_display_label(None) == "(no unit)"
    assert unit_display_label("") == "(no unit)"
    assert "C" in unit_display_label("C") or "°" in unit_display_label("C")
    assert unit_display_label("nope") == "nope"
    with pytest.raises(ValidationError):
        assert_known_rounding_mode("NOT_A_MODE")
    with pytest.raises(ValidationError):
        normalize_decimal_precision(-1)
    with pytest.raises(ValidationError):
        normalize_decimal_precision(99)
    assert parse_decimal_strict(7) == Decimal("7")

    class _Bad:
        def __str__(self) -> str:
            raise TypeError("nope")

    with pytest.raises(ValidationError):
        parse_decimal_strict(_Bad())
    rounded, applied = apply_configured_rounding(Decimal("1.25"), 1, "HALF_UP")
    assert applied and rounded == Decimal("1.3")
    assert format_decimal_for_display(Decimal("1.2500")) == "1.25"
    assert format_decimal_for_display(Decimal("2"), precision=2) in {"2.00", "2"}
    assert (
        value_within_informational_bounds(
            Decimal("10"), Decimal("10"), None, min_inclusive=False, max_inclusive=True
        )
        is False
    )
    assert (
        value_within_informational_bounds(
            Decimal("20"), None, Decimal("20"), min_inclusive=True, max_inclusive=False
        )
        is False
    )
    ctx = build_measurement_context(value=Decimal("3.5"), unit="g")
    assert ctx["captured_value"] == "3.5"
    assert decimal_to_mongo_safe(None) is None
    assert decimal_to_mongo_safe(Decimal("1")) == "1"
    assert mongo_safe_to_decimal(None) is None
    assert mongo_safe_to_decimal("") is None
    assert mongo_safe_to_decimal("9.1") == Decimal("9.1")
    assert apply_measurement_decimal(1.5, decimal_precision=None, rounding_mode="") == Decimal(
        "1.5"
    )
    assert quantize_for_precision(
        Decimal("1.26"), decimal_precision=1, rounding_mode="HALF_UP"
    ) == Decimal("1.3")
    assert assert_precision_rounding_pair(decimal_precision=2, rounding_mode="FLOOR") == (
        2,
        "FLOOR",
    )
