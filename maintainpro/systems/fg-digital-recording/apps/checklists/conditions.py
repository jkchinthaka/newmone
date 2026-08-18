"""Safe deterministic checklist condition predicates (Phase 06J / ADR-019).

Closed whitelist only — no eval(), exec(), or expression languages.
Server-authoritative; client visibility is UX only.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError

from apps.checklists.models import (
    ChecklistConditionComparator,
    ChecklistConditionRuleKind,
    ChecklistItem,
    ChecklistItemKind,
    ChecklistItemRule,
    ChecklistResponseType,
)

CONDITION_COMPARATORS: frozenset[str] = frozenset(ChecklistConditionComparator.values)
CONDITION_RULE_KINDS: frozenset[str] = frozenset(ChecklistConditionRuleKind.values)

# Long-form aliases normalize to closed tokens (never evaluated as code).
_COMPARATOR_ALIASES: dict[str, str] = {
    "EQUALS": ChecklistConditionComparator.EQ,
    "NOT_EQUALS": ChecklistConditionComparator.NE,
    "GREATER_THAN": ChecklistConditionComparator.GT,
    "GREATER_THAN_OR_EQUAL": ChecklistConditionComparator.GTE,
    "LESS_THAN": ChecklistConditionComparator.LT,
    "LESS_THAN_OR_EQUAL": ChecklistConditionComparator.LTE,
}


def assert_known_comparator(comparator: str) -> str:
    normalized = (comparator or "").strip().upper()
    normalized = _COMPARATOR_ALIASES.get(normalized, normalized)
    if normalized not in CONDITION_COMPARATORS:
        raise ValidationError(
            {
                "comparator": (
                    f"Unknown or disallowed comparator {comparator!r}. "
                    f"Allowed: {', '.join(sorted(CONDITION_COMPARATORS))}."
                )
            }
        )
    return normalized


def assert_known_rule_kind(rule_kind: str) -> str:
    normalized = (rule_kind or "").strip().upper()
    if normalized not in CONDITION_RULE_KINDS:
        raise ValidationError(
            {
                "rule_kind": (
                    f"Unknown or disallowed rule kind {rule_kind!r}. "
                    f"Allowed: {', '.join(sorted(CONDITION_RULE_KINDS))}."
                )
            }
        )
    return normalized


def _parse_decimal(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    if isinstance(raw, Decimal):
        return raw
    try:
        text = str(raw).strip()
        if not text:
            return None
        return Decimal(text)
    except Exception:  # noqa: BLE001 — treat as non-numeric
        return None


def extract_answer_snapshot(
    *,
    item: ChecklistItem,
    choice_value: str = "",
    number_value: Decimal | None = None,
    text_value: str = "",
    selected_option_id: uuid.UUID | None = None,
    selected_option_value: str = "",
) -> dict[str, Any]:
    answered = False
    if item.response_type == ChecklistResponseType.NUMBER:
        answered = number_value is not None
    elif item.response_type == ChecklistResponseType.SELECT:
        answered = selected_option_id is not None
    elif item.response_type in {
        ChecklistResponseType.YES_NO,
        ChecklistResponseType.YES_NO_NA,
    }:
        answered = bool((choice_value or "").strip())
    else:
        answered = bool((text_value or "").strip()) or bool((choice_value or "").strip())
    return {
        "item_id": str(item.id),
        "item_code": item.code,
        "response_type": item.response_type,
        "answered": answered,
        "choice_value": (choice_value or "").strip(),
        "number_value": str(number_value) if number_value is not None else None,
        "text_value": (text_value or "").strip(),
        "selected_option_id": str(selected_option_id) if selected_option_id else None,
        "selected_option_value": (selected_option_value or "").strip(),
    }


def evaluate_predicate(
    *,
    comparator: str,
    operand_snapshot: dict[str, Any],
    expected_text: str = "",
    expected_number: Decimal | None = None,
    expected_boolean: bool | None = None,
    expected_option_id: uuid.UUID | None = None,
    expected_list: list[Any] | None = None,
) -> bool:
    """Evaluate one closed comparator against an operand answer snapshot."""
    op = assert_known_comparator(comparator)
    answered = bool(operand_snapshot.get("answered"))

    if op == ChecklistConditionComparator.IS_ANSWERED:
        if expected_boolean is None:
            return answered
        return answered is bool(expected_boolean)
    if op == ChecklistConditionComparator.IS_EMPTY:
        return not answered
    if op == ChecklistConditionComparator.IS_NOT_EMPTY:
        return answered

    if not answered:
        # Unanswered operands make relational predicates false (deterministic).
        return False

    response_type = operand_snapshot.get("response_type") or ""
    expected_values = list(expected_list or [])

    if response_type == ChecklistResponseType.NUMBER:
        actual = _parse_decimal(operand_snapshot.get("number_value"))
        if actual is None:
            return False
        if op == ChecklistConditionComparator.IN:
            parsed = [_parse_decimal(v) for v in expected_values]
            return any(p is not None and p == actual for p in parsed)
        expected = expected_number
        if expected is None and expected_text.strip():
            expected = _parse_decimal(expected_text)
        if expected is None:
            return False
        if op == ChecklistConditionComparator.EQ:
            return actual == expected
        if op == ChecklistConditionComparator.NE:
            return actual != expected
        if op == ChecklistConditionComparator.GT:
            return actual > expected
        if op == ChecklistConditionComparator.GTE:
            return actual >= expected
        if op == ChecklistConditionComparator.LT:
            return actual < expected
        if op == ChecklistConditionComparator.LTE:
            return actual <= expected
        return False

    if response_type == ChecklistResponseType.SELECT:
        actual_id = operand_snapshot.get("selected_option_id")
        actual_value = (operand_snapshot.get("selected_option_value") or "").strip()
        if op == ChecklistConditionComparator.IN:
            as_text = {str(v).strip() for v in expected_values}
            return (actual_id in as_text) or (actual_value in as_text)
        expected_id = str(expected_option_id) if expected_option_id else ""
        expected_val = (expected_text or "").strip()
        if op == ChecklistConditionComparator.EQ:
            if expected_id:
                return actual_id == expected_id
            return bool(expected_val) and actual_value == expected_val
        if op == ChecklistConditionComparator.NE:
            if expected_id:
                return actual_id != expected_id
            return bool(expected_val) and actual_value != expected_val
        raise ValidationError({"comparator": f"{op} is not supported for SELECT operands."})

    # YES_NO / YES_NO_NA / TEXT-like: compare normalized text/choice
    actual_text = (operand_snapshot.get("choice_value") or "").strip() or (
        operand_snapshot.get("text_value") or ""
    ).strip()
    if op == ChecklistConditionComparator.IN:
        as_text = {str(v).strip().casefold() for v in expected_values}
        return actual_text.casefold() in as_text
    str_expected: str = (expected_text or "").strip()
    if expected_boolean is not None and not str_expected:
        str_expected = "YES" if expected_boolean else "NO"
    if op == ChecklistConditionComparator.EQ:
        return bool(str_expected) and actual_text.casefold() == str_expected.casefold()
    if op == ChecklistConditionComparator.NE:
        return bool(str_expected) and actual_text.casefold() != str_expected.casefold()
    raise ValidationError({"comparator": f"{op} is not supported for non-numeric operands."})


def validate_rule_definition(
    *,
    rule: ChecklistItemRule,
    items_by_id: dict[uuid.UUID, ChecklistItem],
) -> None:
    assert_known_rule_kind(rule.rule_kind)
    assert_known_comparator(rule.comparator)
    target = items_by_id.get(rule.target_item_id) or rule.target_item
    operand = items_by_id.get(rule.operand_item_id) or rule.operand_item
    if target.id == operand.id:
        raise ValidationError({"operand_item": "Rule cannot reference itself."})
    if target.section.version_id != operand.section.version_id:
        raise ValidationError({"operand_item": "Operand must be same checklist version."})
    if target.item_kind == ChecklistItemKind.REPEATING_GROUP:
        raise ValidationError({"target_item": "REPEATING_GROUP cannot be a rule target."})
    if operand.item_kind == ChecklistItemKind.REPEATING_GROUP:
        raise ValidationError({"operand_item": "REPEATING_GROUP cannot be an operand."})
    if target.parent_item_id != operand.parent_item_id:
        # Top-level ↔ top-level or same repeating group siblings only.
        raise ValidationError(
            {
                "operand_item": (
                    "Condition operand must share the same parent scope "
                    "(top-level with top-level, or siblings in one REPEATING_GROUP)."
                )
            }
        )
    comparator = assert_known_comparator(rule.comparator)
    if comparator == ChecklistConditionComparator.IN:
        if not isinstance(rule.expected_list, list) or not rule.expected_list:
            raise ValidationError({"expected_list": "IN comparator requires a non-empty list."})
    elif comparator in {
        ChecklistConditionComparator.IS_ANSWERED,
        ChecklistConditionComparator.IS_EMPTY,
        ChecklistConditionComparator.IS_NOT_EMPTY,
    }:
        return
    elif (
        rule.expected_number is None
        and not (rule.expected_text or "").strip()
        and rule.expected_boolean is None
        and rule.expected_option_id is None
    ):
        raise ValidationError({"expected_text": "Comparator requires an expected value."})


def detect_visibility_cycles(
    *,
    rules: list[ChecklistItemRule],
) -> None:
    """Detect cycles in condition dependencies (target → operand) across all rule kinds."""
    graph: dict[uuid.UUID, list[uuid.UUID]] = {}
    for rule in rules:
        graph.setdefault(rule.target_item_id, []).append(rule.operand_item_id)

    visiting: set[uuid.UUID] = set()
    visited: set[uuid.UUID] = set()

    def dfs(node: uuid.UUID) -> None:
        if node in visiting:
            raise ValidationError(
                {"condition_rules": "Circular condition-rule dependency detected."}
            )
        if node in visited:
            return
        visiting.add(node)
        for nxt in graph.get(node, []):
            dfs(nxt)
        visiting.remove(node)
        visited.add(node)

    for start in list(graph):
        dfs(start)


# Backward-compatible alias used by services/tests.
detect_condition_cycles = detect_visibility_cycles


def build_condition_context(
    *,
    visible: bool,
    required: bool,
    evidence_required: bool,
    evaluations: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "visible": visible,
        "required": required,
        "evidence_required": evidence_required,
        "evaluations": evaluations,
    }
