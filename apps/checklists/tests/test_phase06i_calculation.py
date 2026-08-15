"""Unit tests for closed calculation operators (Phase 06I)."""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.checklists.calculation import (
    CALCULATION_OPERATORS,
    apply_operator,
    assert_known_operator,
    build_calculation_context,
    parse_decimal,
)


def test_whitelist_is_closed() -> None:
    assert CALCULATION_OPERATORS == {"SUM", "AVERAGE", "MIN", "MAX", "COUNT", "RANGE"}
    with pytest.raises(ValidationError):
        assert_known_operator("EVAL")
    with pytest.raises(ValidationError):
        assert_known_operator("sum(a)/len(a)")
    with pytest.raises(ValidationError):
        assert_known_operator("__import__('os')")


def test_decimal_parse_and_context() -> None:
    assert parse_decimal("1.2500") == Decimal("1.2500")
    assert parse_decimal("") is None
    assert parse_decimal("not-a-number") is None
    ctx = build_calculation_context(
        operator="SUM",
        inputs=[{"item_id": "x", "number_value": "1"}],
        result=Decimal("1.0000"),
    )
    assert ctx["operator"] == "SUM"
    assert ctx["result"] == "1.0000"


def test_apply_operator_empty_and_average_precision() -> None:
    assert apply_operator(operator="MIN", values=[]) is None
    assert apply_operator(operator="AVERAGE", values=[Decimal("1"), Decimal("2")]) == Decimal(
        "1.5000"
    )
    # 1/3 quantize to 4 dp HALF_UP
    assert apply_operator(
        operator="AVERAGE", values=[Decimal("1"), Decimal("1"), Decimal("1")]
    ) == Decimal("1.0000")
