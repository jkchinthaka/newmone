"""Deterministic checklist item evaluation (Phase 06K / ADR-019).

PASS/FAIL/WARN/NOT_EVALUATED are measurement/checklist results only.
They are never QA dispositions (RELEASE/HOLD/REJECT) and never mutate QAReview.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError

from apps.checklists.models import (
    ChecklistEvaluationResult,
    ChecklistEvaluationRuleKind,
    ChecklistItem,
    ChecklistItemEvaluationRule,
    ChecklistResponseType,
)


def _cmp(value: Decimal, bound: Decimal, *, inclusive: bool, lower: bool) -> bool:
    if lower:
        return value >= bound if inclusive else value > bound
    return value <= bound if inclusive else value < bound


def _in_band(
    value: Decimal,
    *,
    lo: Decimal | None,
    hi: Decimal | None,
    lo_inc: bool | None,
    hi_inc: bool | None,
) -> bool:
    if lo is not None:
        if lo_inc is None:
            return False
        if not _cmp(value, lo, inclusive=lo_inc, lower=True):
            return False
    if hi is not None:
        if hi_inc is None:
            return False
        if not _cmp(value, hi, inclusive=hi_inc, lower=False):
            return False
    return True


def evaluate_numeric_bounds(
    *,
    value: Decimal | None,
    rule: ChecklistItemEvaluationRule,
) -> str:
    if value is None:
        return ChecklistEvaluationResult.NOT_EVALUATED
    in_pass = _in_band(
        value,
        lo=rule.bound_min,
        hi=rule.bound_max,
        lo_inc=rule.min_inclusive,
        hi_inc=rule.max_inclusive,
    )
    if in_pass:
        return ChecklistEvaluationResult.PASS
    has_warn = rule.warn_min is not None or rule.warn_max is not None
    if has_warn and _in_band(
        value,
        lo=rule.warn_min,
        hi=rule.warn_max,
        lo_inc=rule.warn_min_inclusive,
        hi_inc=rule.warn_max_inclusive,
    ):
        return ChecklistEvaluationResult.WARN
    return ChecklistEvaluationResult.FAIL


def evaluate_expected_choice(
    *,
    choice_value: str,
    rule: ChecklistItemEvaluationRule,
    response_type: str,
) -> str:
    choice = (choice_value or "").strip().upper()
    if not choice:
        return ChecklistEvaluationResult.NOT_EVALUATED
    if (
        response_type == ChecklistResponseType.YES_NO_NA
        and choice == "NA"
        and rule.treat_na_as_not_evaluated
    ):
        return ChecklistEvaluationResult.NOT_EVALUATED
    expected = (rule.expected_choice or "").strip().upper()
    if choice == expected:
        return ChecklistEvaluationResult.PASS
    return ChecklistEvaluationResult.FAIL


def evaluate_expected_option(
    *,
    selected_option_id: Any,
    rule: ChecklistItemEvaluationRule,
) -> str:
    if selected_option_id is None:
        return ChecklistEvaluationResult.NOT_EVALUATED
    if rule.expected_option_id is None:
        return ChecklistEvaluationResult.NOT_EVALUATED
    if str(selected_option_id) == str(rule.expected_option_id):
        return ChecklistEvaluationResult.PASS
    return ChecklistEvaluationResult.FAIL


def _captured_values_snapshot(
    *,
    choice_value: str = "",
    number_value: Decimal | None = None,
    selected_option_id: Any = None,
    is_calculated: bool = False,
) -> dict[str, Any]:
    """Freeze captured/calculated answers into the evaluation snapshot."""
    return {
        "choice_value": (choice_value or "").strip().upper(),
        "number_value": str(number_value) if number_value is not None else None,
        "selected_option_id": str(selected_option_id) if selected_option_id else None,
        "number_is_calculated": bool(is_calculated),
    }


def build_evaluation_context(
    *,
    result: str,
    rule: ChecklistItemEvaluationRule | None,
    visible: bool,
    reason: str,
    choice_value: str = "",
    number_value: Decimal | None = None,
    selected_option_id: Any = None,
    is_calculated: bool = False,
) -> dict[str, Any]:
    ctx: dict[str, Any] = {
        "result": result,
        "visible": visible,
        "reason": reason,
        # Explicit safety banner for consumers / UI / exports.
        "not_qa_disposition": True,
        "qa_disposition_note": (
            "PASS≠RELEASE; FAIL≠HOLD; FAIL≠REJECT. "
            "Item evaluation does not create or modify QAReview."
        ),
        "captured": _captured_values_snapshot(
            choice_value=choice_value,
            number_value=number_value,
            selected_option_id=selected_option_id,
            is_calculated=is_calculated,
        ),
    }
    if rule is None:
        ctx["rule"] = None
        return ctx
    ctx["rule"] = {
        "rule_id": str(rule.id),
        "rule_kind": rule.rule_kind,
        "bound_min": str(rule.bound_min) if rule.bound_min is not None else None,
        "bound_max": str(rule.bound_max) if rule.bound_max is not None else None,
        "min_inclusive": rule.min_inclusive,
        "max_inclusive": rule.max_inclusive,
        "warn_min": str(rule.warn_min) if rule.warn_min is not None else None,
        "warn_max": str(rule.warn_max) if rule.warn_max is not None else None,
        "warn_min_inclusive": rule.warn_min_inclusive,
        "warn_max_inclusive": rule.warn_max_inclusive,
        "expected_choice": rule.expected_choice or "",
        "expected_option_id": str(rule.expected_option_id) if rule.expected_option_id else None,
        "treat_na_as_not_evaluated": rule.treat_na_as_not_evaluated,
        "specification_version_id": (
            str(rule.specification_version_id)
            if getattr(rule, "specification_version_id", None)
            else None
        ),
        "specification_parameter_id": (
            str(rule.specification_parameter_id)
            if getattr(rule, "specification_parameter_id", None)
            else None
        ),
    }
    return ctx


def evaluate_item_response(
    *,
    item: ChecklistItem,
    rule: ChecklistItemEvaluationRule | None,
    visible: bool,
    choice_value: str = "",
    number_value: Decimal | None = None,
    selected_option_id: Any = None,
) -> tuple[str, dict[str, Any]]:
    """
    Server-authoritative evaluation. Missing rule ⇒ NOT_EVALUATED.
    Hidden/non-applicable ⇒ NOT_EVALUATED.
    """
    from apps.checklists.models import ChecklistItemKind

    is_calculated = getattr(item, "item_kind", None) == ChecklistItemKind.CALCULATED
    common_kwargs: dict[str, Any] = {
        "choice_value": choice_value,
        "number_value": number_value,
        "selected_option_id": selected_option_id,
        "is_calculated": is_calculated,
    }
    if not visible:
        return (
            ChecklistEvaluationResult.NOT_EVALUATED,
            build_evaluation_context(
                result=ChecklistEvaluationResult.NOT_EVALUATED,
                rule=rule,
                visible=False,
                reason="not_applicable_under_conditions",
                **common_kwargs,
            ),
        )
    if rule is None:
        return (
            ChecklistEvaluationResult.NOT_EVALUATED,
            build_evaluation_context(
                result=ChecklistEvaluationResult.NOT_EVALUATED,
                rule=None,
                visible=True,
                reason="no_evaluation_rule_configured",
                **common_kwargs,
            ),
        )

    kind = rule.rule_kind
    if kind in {
        ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
        ChecklistEvaluationRuleKind.CALCULATED_NUMERIC_BOUNDS,
    }:
        result = evaluate_numeric_bounds(value=number_value, rule=rule)
        reason = "numeric_bounds"
        ctx = build_evaluation_context(
            result=result, rule=rule, visible=True, reason=reason, **common_kwargs
        )
        return result, ctx
    if kind == ChecklistEvaluationRuleKind.EXPECTED_CHOICE:
        result = evaluate_expected_choice(
            choice_value=choice_value,
            rule=rule,
            response_type=item.response_type,
        )
        reason = "expected_choice"
        return (
            result,
            build_evaluation_context(
                result=result, rule=rule, visible=True, reason=reason, **common_kwargs
            ),
        )
    if kind == ChecklistEvaluationRuleKind.EXPECTED_OPTION:
        result = evaluate_expected_option(selected_option_id=selected_option_id, rule=rule)
        reason = "expected_option"
        return (
            result,
            build_evaluation_context(
                result=result, rule=rule, visible=True, reason=reason, **common_kwargs
            ),
        )
    if kind == ChecklistEvaluationRuleKind.SPECIFICATION_PARAMETER:
        from apps.master_data.specification_evaluation import evaluate_specification_parameter

        parameter = rule.specification_parameter
        if parameter is None:
            result = ChecklistEvaluationResult.NOT_EVALUATED
            ctx = build_evaluation_context(
                result=result,
                rule=rule,
                visible=True,
                reason="specification_parameter_missing",
                **common_kwargs,
            )
            ctx["spec_result"] = "NOT_EVALUATED"
            ctx["not_qa_disposition"] = True
            return result, ctx
        result, spec_label, extra = evaluate_specification_parameter(
            value=number_value,
            parameter=parameter,
        )
        ctx = build_evaluation_context(
            result=result,
            rule=rule,
            visible=True,
            reason=str(extra.get("reason") or "specification_parameter"),
            **common_kwargs,
        )
        ctx["spec_result"] = spec_label
        ctx.update({k: v for k, v in extra.items() if k != "reason"})
        return result, ctx

    raise ValidationError({"rule_kind": f"Unsupported evaluation rule kind {kind!r}."})


def assert_known_evaluation_result(value: str) -> str:
    normalized = (value or "").strip().upper()
    if normalized not in ChecklistEvaluationResult.values:
        raise ValidationError(
            {
                "evaluation_result": (
                    f"Unknown evaluation result {value!r}. "
                    "Client-supplied evaluation is never trusted."
                )
            }
        )
    return normalized
