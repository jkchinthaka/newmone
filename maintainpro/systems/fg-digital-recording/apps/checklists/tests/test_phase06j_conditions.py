"""Unit tests for closed conditional predicates (Phase 06J)."""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.checklists.conditions import (
    CONDITION_COMPARATORS,
    assert_known_comparator,
    detect_visibility_cycles,
    evaluate_predicate,
)
from apps.checklists.models import (
    ChecklistConditionComparator,
    ChecklistConditionRuleKind,
    ChecklistItemRule,
)


def test_comparator_whitelist_is_closed() -> None:
    assert CONDITION_COMPARATORS == {
        "EQ",
        "NE",
        "IN",
        "GT",
        "GTE",
        "LT",
        "LTE",
        "IS_ANSWERED",
        "IS_EMPTY",
        "IS_NOT_EMPTY",
    }
    with pytest.raises(ValidationError):
        assert_known_comparator("EVAL")
    with pytest.raises(ValidationError):
        assert_known_comparator("a == b")
    assert assert_known_comparator("EQUALS") == "EQ"


def test_yes_no_and_number_predicates() -> None:
    yes = {
        "answered": True,
        "response_type": "YES_NO",
        "choice_value": "YES",
        "number_value": None,
        "text_value": "",
        "selected_option_id": None,
        "selected_option_value": "",
    }
    assert evaluate_predicate(comparator="EQ", operand_snapshot=yes, expected_text="YES")
    assert not evaluate_predicate(comparator="EQ", operand_snapshot=yes, expected_text="NO")
    number = {
        "answered": True,
        "response_type": "NUMBER",
        "choice_value": "",
        "number_value": "10.0000",
        "text_value": "",
        "selected_option_id": None,
        "selected_option_value": "",
    }
    assert evaluate_predicate(
        comparator="GTE", operand_snapshot=number, expected_number=Decimal("10")
    )
    assert evaluate_predicate(
        comparator="IN",
        operand_snapshot=number,
        expected_list=["9", "10", "11"],
    )
    unanswered = {
        "answered": False,
        "response_type": "NUMBER",
        "choice_value": "",
        "number_value": None,
        "text_value": "",
        "selected_option_id": None,
        "selected_option_value": "",
    }
    assert not evaluate_predicate(comparator="IS_ANSWERED", operand_snapshot=unanswered)
    assert evaluate_predicate(comparator="IS_ANSWERED", operand_snapshot=number)


def test_visibility_cycle_detection() -> None:
    a = "11111111-1111-1111-1111-111111111111"
    b = "22222222-2222-2222-2222-222222222222"
    rules = [
        ChecklistItemRule(
            target_item_id=a,
            operand_item_id=b,
            rule_kind=ChecklistConditionRuleKind.VISIBLE_IF,
            comparator=ChecklistConditionComparator.IS_ANSWERED,
        ),
        ChecklistItemRule(
            target_item_id=b,
            operand_item_id=a,
            rule_kind=ChecklistConditionRuleKind.REQUIRED_IF,
            comparator=ChecklistConditionComparator.IS_ANSWERED,
        ),
    ]
    with pytest.raises(ValidationError, match="Circular"):
        detect_visibility_cycles(rules=rules)


def test_select_and_na_and_empty_predicates() -> None:
    select = {
        "answered": True,
        "response_type": "SELECT",
        "choice_value": "",
        "number_value": None,
        "text_value": "",
        "selected_option_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "selected_option_value": "RED",
    }
    assert evaluate_predicate(
        comparator="EQ",
        operand_snapshot=select,
        expected_text="RED",
    )
    assert evaluate_predicate(
        comparator="IN",
        operand_snapshot=select,
        expected_list=["BLUE", "RED"],
    )
    na = {
        "answered": True,
        "response_type": "YES_NO_NA",
        "choice_value": "NA",
        "number_value": None,
        "text_value": "",
        "selected_option_id": None,
        "selected_option_value": "",
    }
    assert evaluate_predicate(comparator="EQUALS", operand_snapshot=na, expected_text="NA")
    missing = {
        "answered": False,
        "response_type": "TEXT",
        "choice_value": "",
        "number_value": None,
        "text_value": "",
        "selected_option_id": None,
        "selected_option_value": "",
    }
    assert evaluate_predicate(comparator="IS_EMPTY", operand_snapshot=missing)
    assert not evaluate_predicate(comparator="IS_NOT_EMPTY", operand_snapshot=missing)
    assert not evaluate_predicate(
        comparator="GREATER_THAN",
        operand_snapshot=missing,
        expected_number=Decimal("1"),
    )


def test_malformed_operator_injection_rejected() -> None:
    for bad in (
        "eval(1)",
        "__import__('os')",
        "EQUALS; DROP TABLE",
        "<script>alert(1)</script>",
        "a == b",
    ):
        with pytest.raises(ValidationError):
            assert_known_comparator(bad)
