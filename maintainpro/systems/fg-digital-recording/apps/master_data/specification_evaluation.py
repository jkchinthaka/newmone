"""Specification measurement evaluation helpers (Phase 06O).

OUT_OF_SPEC is a measurement label only — never QA disposition (HOLD/REJECT).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError

from apps.checklists.models import ChecklistEvaluationResult
from apps.master_data.models import SpecificationParameter


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


def evaluate_specification_parameter(
    *,
    value: Decimal | None,
    parameter: SpecificationParameter,
) -> tuple[str, str, dict[str, Any]]:
    """
    Evaluate a numeric value against a pinned SpecificationParameter.

    Returns (checklist_result, spec_label, context_extra).

    Mapping (measurement only — not QA disposition):
      IN_SPEC     → PASS
      OUT_OF_SPEC → FAIL
      WARN        → WARN
      empty bounds / missing value → NOT_EVALUATED

    OUT_OF_SPEC must not auto-create HOLD/REJECT or QAReview.
    """
    base_extra: dict[str, Any] = {
        "specification_parameter_id": str(parameter.id),
        "specification_version_id": str(parameter.version_id),
        "parameter_code": parameter.code,
        "bound_min": str(parameter.bound_min) if parameter.bound_min is not None else None,
        "bound_max": str(parameter.bound_max) if parameter.bound_max is not None else None,
        "min_inclusive": parameter.min_inclusive,
        "max_inclusive": parameter.max_inclusive,
        "warn_min": str(parameter.warn_min) if parameter.warn_min is not None else None,
        "warn_max": str(parameter.warn_max) if parameter.warn_max is not None else None,
        "not_qa_disposition": True,
        "qa_disposition_note": (
            "OUT_OF_SPEC≠HOLD; OUT_OF_SPEC≠REJECT; IN_SPEC≠RELEASE. "
            "Specification evaluation does not create or modify QAReview."
        ),
    }

    if value is None:
        return (
            ChecklistEvaluationResult.NOT_EVALUATED,
            "NOT_EVALUATED",
            {**base_extra, "reason": "missing_value"},
        )
    if parameter.bound_min is None and parameter.bound_max is None:
        return (
            ChecklistEvaluationResult.NOT_EVALUATED,
            "NOT_EVALUATED",
            {
                **base_extra,
                "reason": "parameter_bounds_pending_evidence",
                "evidence_note": "APR-006 / ASM-001 — bounds empty until owner evidence.",
            },
        )

    in_hard = _in_band(
        value,
        lo=parameter.bound_min,
        hi=parameter.bound_max,
        lo_inc=parameter.min_inclusive,
        hi_inc=parameter.max_inclusive,
    )
    # Hard bounds always win: outside ⇒ OUT_OF_SPEC (never auto HOLD/REJECT).
    if not in_hard:
        return (
            ChecklistEvaluationResult.FAIL,
            "OUT_OF_SPEC",
            {**base_extra, "reason": "specification_parameter_bounds"},
        )

    # Optional warn band interpreted as preferred inner zone within hard bounds.
    has_warn = parameter.warn_min is not None or parameter.warn_max is not None
    if has_warn and not _in_band(
        value,
        lo=parameter.warn_min,
        hi=parameter.warn_max,
        lo_inc=parameter.warn_min_inclusive,
        hi_inc=parameter.warn_max_inclusive,
    ):
        return (
            ChecklistEvaluationResult.WARN,
            "WARN",
            {**base_extra, "reason": "specification_parameter_warn_band"},
        )

    return (
        ChecklistEvaluationResult.PASS,
        "IN_SPEC",
        {**base_extra, "reason": "specification_parameter_bounds"},
    )


def assert_parameter_belongs_to_version(
    *,
    parameter: SpecificationParameter,
    version_id: Any,
) -> None:
    if str(parameter.version_id) != str(version_id):
        raise ValidationError(
            {
                "specification_parameter": (
                    "specification_parameter must belong to the pinned specification_version."
                )
            }
        )
