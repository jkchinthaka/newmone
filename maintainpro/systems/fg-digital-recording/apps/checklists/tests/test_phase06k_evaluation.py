"""Unit tests for deterministic item evaluation (Phase 06K)."""

from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from typing import Any, cast

import pytest
from django.core.exceptions import ValidationError

from apps.checklists.evaluation import (
    assert_known_evaluation_result,
    evaluate_item_response,
    evaluate_numeric_bounds,
)
from apps.checklists.models import (
    ChecklistEvaluationResult,
    ChecklistEvaluationRuleKind,
    ChecklistItem,
    ChecklistItemEvaluationRule,
    ChecklistResponseType,
)


def _rule(**kwargs: Any) -> ChecklistItemEvaluationRule:
    defaults: dict[str, Any] = {
        "id": "11111111-1111-1111-1111-111111111111",
        "rule_kind": ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
        "bound_min": None,
        "bound_max": None,
        "min_inclusive": None,
        "max_inclusive": None,
        "warn_min": None,
        "warn_max": None,
        "warn_min_inclusive": None,
        "warn_max_inclusive": None,
        "expected_choice": "",
        "expected_option_id": None,
        "treat_na_as_not_evaluated": True,
        "specification_version_id": None,
        "specification_parameter_id": None,
    }
    defaults.update(kwargs)
    return cast(ChecklistItemEvaluationRule, SimpleNamespace(**defaults))


def _item(**kwargs: Any) -> ChecklistItem:
    defaults: dict[str, Any] = {
        "response_type": ChecklistResponseType.NUMBER,
        "item_kind": "SIMPLE",
    }
    defaults.update(kwargs)
    return cast(ChecklistItem, SimpleNamespace(**defaults))


def test_numeric_pass_fail_warn_and_boundaries() -> None:
    rule = _rule(
        bound_min=Decimal("10"),
        bound_max=Decimal("20"),
        min_inclusive=True,
        max_inclusive=True,
        warn_min=Decimal("5"),
        warn_max=Decimal("25"),
        warn_min_inclusive=True,
        warn_max_inclusive=True,
    )
    assert evaluate_numeric_bounds(value=Decimal("10"), rule=rule) == "PASS"
    assert evaluate_numeric_bounds(value=Decimal("20"), rule=rule) == "PASS"
    assert evaluate_numeric_bounds(value=Decimal("7"), rule=rule) == "WARN"
    assert evaluate_numeric_bounds(value=Decimal("1"), rule=rule) == "FAIL"
    exclusive = _rule(
        bound_min=Decimal("10"),
        bound_max=Decimal("20"),
        min_inclusive=False,
        max_inclusive=False,
    )
    assert evaluate_numeric_bounds(value=Decimal("10"), rule=exclusive) == "FAIL"
    assert evaluate_numeric_bounds(value=Decimal("15"), rule=exclusive) == "PASS"
    assert evaluate_numeric_bounds(value=None, rule=rule) == "NOT_EVALUATED"


def test_missing_rule_and_hidden_not_evaluated() -> None:
    item = _item(response_type=ChecklistResponseType.NUMBER, item_kind="SIMPLE")
    result, ctx = evaluate_item_response(
        item=item, rule=None, visible=True, number_value=Decimal("1")
    )
    assert result == ChecklistEvaluationResult.NOT_EVALUATED
    assert ctx["reason"] == "no_evaluation_rule_configured"
    assert ctx["not_qa_disposition"] is True
    assert ctx["captured"]["number_value"] == "1"
    assert ctx["captured"]["number_is_calculated"] is False

    rule = _rule(
        bound_min=Decimal("0"),
        bound_max=Decimal("1"),
        min_inclusive=True,
        max_inclusive=True,
    )
    result2, ctx2 = evaluate_item_response(
        item=item, rule=rule, visible=False, number_value=Decimal("0.5")
    )
    assert result2 == ChecklistEvaluationResult.NOT_EVALUATED
    assert ctx2["reason"] == "not_applicable_under_conditions"


def test_yes_no_na_and_select_evaluation() -> None:
    yes_item = _item(response_type=ChecklistResponseType.YES_NO)
    rule = _rule(
        rule_kind=ChecklistEvaluationRuleKind.EXPECTED_CHOICE,
        expected_choice="YES",
    )
    result, _ = evaluate_item_response(item=yes_item, rule=rule, visible=True, choice_value="YES")
    assert result == "PASS"
    result_fail, _ = evaluate_item_response(
        item=yes_item, rule=rule, visible=True, choice_value="NO"
    )
    assert result_fail == "FAIL"

    na_item = _item(response_type=ChecklistResponseType.YES_NO_NA)
    result_na, _ = evaluate_item_response(item=na_item, rule=rule, visible=True, choice_value="NA")
    assert result_na == "NOT_EVALUATED"

    select_item = _item(response_type=ChecklistResponseType.SELECT)
    opt_rule = _rule(
        rule_kind=ChecklistEvaluationRuleKind.EXPECTED_OPTION,
        expected_option_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    )
    result_opt, _ = evaluate_item_response(
        item=select_item,
        rule=opt_rule,
        visible=True,
        selected_option_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    )
    assert result_opt == "PASS"


def test_client_spoofed_result_never_trusted_as_input_path() -> None:
    # evaluate_item_response has no parameter for client result — spoof impossible.
    with pytest.raises(TypeError):
        evaluate_item_response(  # type: ignore[call-arg]
            item=_item(response_type="NUMBER"),
            rule=None,
            visible=True,
            evaluation_result="PASS",
        )


def test_warn_band_requires_explicit_inclusivity_paths() -> None:
    # Lower-only / upper-only warn bands and incomplete inclusivity → not WARN.
    rule = _rule(
        bound_min=Decimal("10"),
        bound_max=Decimal("20"),
        min_inclusive=True,
        max_inclusive=True,
        warn_min=Decimal("5"),
        warn_max=None,
        warn_min_inclusive=True,
        warn_max_inclusive=None,
    )
    assert evaluate_numeric_bounds(value=Decimal("7"), rule=rule) == "WARN"
    assert evaluate_numeric_bounds(value=Decimal("1"), rule=rule) == "FAIL"

    incomplete = _rule(
        bound_min=Decimal("10"),
        bound_max=Decimal("20"),
        min_inclusive=True,
        max_inclusive=True,
        warn_min=Decimal("5"),
        warn_max=Decimal("25"),
        warn_min_inclusive=None,
        warn_max_inclusive=True,
    )
    # Missing warn_min_inclusive ⇒ warn band not applied ⇒ FAIL
    assert evaluate_numeric_bounds(value=Decimal("7"), rule=incomplete) == "FAIL"


def test_expected_choice_empty_and_na_policy() -> None:
    from apps.checklists.evaluation import evaluate_expected_choice

    rule = _rule(
        rule_kind=ChecklistEvaluationRuleKind.EXPECTED_CHOICE,
        expected_choice="YES",
        treat_na_as_not_evaluated=True,
    )
    assert (
        evaluate_expected_choice(
            choice_value="", rule=rule, response_type=ChecklistResponseType.YES_NO
        )
        == "NOT_EVALUATED"
    )
    rule_fail_na = _rule(
        rule_kind=ChecklistEvaluationRuleKind.EXPECTED_CHOICE,
        expected_choice="YES",
        treat_na_as_not_evaluated=False,
    )
    assert (
        evaluate_expected_choice(
            choice_value="NA",
            rule=rule_fail_na,
            response_type=ChecklistResponseType.YES_NO_NA,
        )
        == "FAIL"
    )


def test_expected_option_missing_ids() -> None:
    from apps.checklists.evaluation import evaluate_expected_option

    rule = _rule(
        rule_kind=ChecklistEvaluationRuleKind.EXPECTED_OPTION,
        expected_option_id=None,
    )
    assert evaluate_expected_option(selected_option_id="x", rule=rule) == "NOT_EVALUATED"
    assert evaluate_expected_option(selected_option_id=None, rule=rule) == "NOT_EVALUATED"
    rule2 = _rule(
        rule_kind=ChecklistEvaluationRuleKind.EXPECTED_OPTION,
        expected_option_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    )
    assert (
        evaluate_expected_option(
            selected_option_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", rule=rule2
        )
        == "FAIL"
    )


def test_assert_known_evaluation_result_and_unsupported_kind() -> None:
    from apps.checklists.evaluation import assert_known_evaluation_result

    assert assert_known_evaluation_result("pass") == "PASS"
    with pytest.raises(ValidationError):
        assert_known_evaluation_result("RELEASE")
    item = _item(response_type=ChecklistResponseType.NUMBER)
    bad = _rule(rule_kind="FREE_FORM")
    with pytest.raises(ValidationError):
        evaluate_item_response(item=item, rule=bad, visible=True, number_value=Decimal("1"))


def test_calculated_bounds_path() -> None:
    item = _item(response_type="")
    rule = _rule(
        rule_kind=ChecklistEvaluationRuleKind.CALCULATED_NUMERIC_BOUNDS,
        bound_min=Decimal("0"),
        bound_max=Decimal("10"),
        min_inclusive=True,
        max_inclusive=True,
    )
    result, ctx = evaluate_item_response(
        item=item, rule=rule, visible=True, number_value=Decimal("5")
    )
    assert result == "PASS"
    assert ctx["reason"] == "numeric_bounds"
    assert ctx["rule"]["rule_kind"] == ChecklistEvaluationRuleKind.CALCULATED_NUMERIC_BOUNDS


def test_assert_known_evaluation_result() -> None:
    assert assert_known_evaluation_result("pass") == "PASS"
    with pytest.raises(ValidationError):
        assert_known_evaluation_result("RELEASE")
    with pytest.raises(ValidationError):
        assert_known_evaluation_result("HOLD")
