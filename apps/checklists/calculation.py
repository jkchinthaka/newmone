"""Safe deterministic checklist calculation operators (Phase 06I / ADR-019).

Closed whitelist only — no eval(), exec(), expression languages, or user code.
All numeric math uses Decimal. Not a product-spec or AQL engine.
"""

from __future__ import annotations

import uuid
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError

from apps.checklists.models import ChecklistItem, ChecklistItemKind, ChecklistResponseType

# Closed operator set — add only via architecture evidence, never free-form formulas.
CALCULATION_OPERATORS: frozenset[str] = frozenset(
    {
        "SUM",
        "AVERAGE",
        "MIN",
        "MAX",
        "COUNT",
        "RANGE",
    }
)

DECIMAL_QUANT = Decimal("0.0001")


def quantize_decimal(value: Decimal) -> Decimal:
    return value.quantize(DECIMAL_QUANT, rounding=ROUND_HALF_UP)


def assert_known_operator(operator: str) -> str:
    normalized = (operator or "").strip().upper()
    if normalized not in CALCULATION_OPERATORS:
        raise ValidationError(
            {
                "calculation_operator": (
                    f"Unknown or disallowed calculation operator {operator!r}. "
                    f"Allowed: {', '.join(sorted(CALCULATION_OPERATORS))}."
                )
            }
        )
    return normalized


def apply_operator(*, operator: str, values: list[Decimal]) -> Decimal | None:
    """
    Apply a whitelisted operator to Decimal inputs.

    Returns None when there are no usable values (draft may stay incomplete).
    """
    op = assert_known_operator(operator)
    if op == "COUNT":
        return quantize_decimal(Decimal(len(values)))
    if not values:
        return None
    if op == "SUM":
        return quantize_decimal(sum(values, Decimal("0")))
    if op == "AVERAGE":
        total = sum(values, Decimal("0"))
        return quantize_decimal(total / Decimal(len(values)))
    if op == "MIN":
        return quantize_decimal(min(values))
    if op == "MAX":
        return quantize_decimal(max(values))
    if op == "RANGE":
        return quantize_decimal(max(values) - min(values))
    raise ValidationError({"calculation_operator": f"Operator {op} is not implemented."})


def parse_decimal(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    if isinstance(raw, Decimal):
        return raw
    try:
        text = str(raw).strip()
        if not text:
            return None
        return Decimal(text)
    except (InvalidOperation, ValueError, TypeError):
        return None


def operand_yields_number(item: ChecklistItem) -> bool:
    if item.item_kind == ChecklistItemKind.CALCULATED:
        return True
    if item.item_kind == ChecklistItemKind.SIMPLE:
        return item.response_type == ChecklistResponseType.NUMBER
    return False


def validate_calculation_definition(
    *,
    calculated: ChecklistItem,
    operands: list[ChecklistItem],
    items_by_id: dict[uuid.UUID, ChecklistItem],
) -> None:
    """Structural definition checks for one CALCULATED item (no runtime answers)."""
    if calculated.item_kind != ChecklistItemKind.CALCULATED:
        raise ValidationError({"item_kind": "Calculation definition requires CALCULATED kind."})
    operator = assert_known_operator(calculated.calculation_operator or "")
    if not operands:
        raise ValidationError(
            {"calculation_operands": "CALCULATED items require at least one operand."}
        )

    version_id = calculated.section.version_id
    seen: set[uuid.UUID] = set()
    for operand in operands:
        if operand.id == calculated.id:
            raise ValidationError(
                {"calculation_operands": "A calculated item cannot reference itself."}
            )
        if operand.id in seen:
            raise ValidationError(
                {"calculation_operands": f"Duplicate operand {operand.code} is not allowed."}
            )
        seen.add(operand.id)
        if operand.section.version_id != version_id:
            raise ValidationError(
                {"calculation_operands": "Operands must belong to the same checklist version."}
            )
        if operand.item_kind == ChecklistItemKind.REPEATING_GROUP:
            raise ValidationError(
                {
                    "calculation_operands": (
                        f"Operand {operand.code} cannot be a REPEATING_GROUP container."
                    )
                }
            )
        if not operand_yields_number(operand):
            raise ValidationError(
                {
                    "calculation_operands": (
                        f"Operand {operand.code} must be NUMBER or CALCULATED (Decimal-producing)."
                    )
                }
            )
        # Scope: same parent (per-row) or both top-level.
        if calculated.parent_item_id is not None:
            if operand.parent_item_id != calculated.parent_item_id:
                raise ValidationError(
                    {
                        "calculation_operands": (
                            f"Operand {operand.code} must be a sibling under the same "
                            "REPEATING_GROUP."
                        )
                    }
                )
        elif operand.parent_item_id is not None:
            raise ValidationError(
                {
                    "calculation_operands": (
                        f"Top-level calculated item cannot reference repeating child "
                        f"{operand.code}."
                    )
                }
            )

    _assert_no_cycles(calculated_id=calculated.id, items_by_id=items_by_id)
    # operator used for side-effect-free assert already
    _ = operator


def _assert_no_cycles(
    *,
    calculated_id: uuid.UUID,
    items_by_id: dict[uuid.UUID, ChecklistItem],
) -> None:
    """DFS cycle detection over CALCULATED → operand edges within the version map."""

    def operand_ids(item: ChecklistItem) -> list[uuid.UUID]:
        if item.item_kind != ChecklistItemKind.CALCULATED:
            return []
        # Prefer prefetched calculation_operand_links when present.
        links = getattr(item, "_prefetched_objects_cache", {}).get("calculation_operand_links")
        if links is not None:
            return [link.source_item_id for link in links]
        return [link.source_item_id for link in item.calculation_operand_links.all()]

    visiting: set[uuid.UUID] = set()
    visited: set[uuid.UUID] = set()

    def dfs(node_id: uuid.UUID) -> None:
        if node_id in visiting:
            raise ValidationError(
                {"calculation_operands": "Circular calculation dependency detected."}
            )
        if node_id in visited:
            return
        visiting.add(node_id)
        item = items_by_id.get(node_id)
        if item is not None and item.item_kind == ChecklistItemKind.CALCULATED:
            for child_id in operand_ids(item):
                dfs(child_id)
        visiting.remove(node_id)
        visited.add(node_id)

    dfs(calculated_id)


def build_calculation_context(
    *,
    operator: str,
    inputs: list[dict[str, Any]],
    result: Decimal | None,
) -> dict[str, Any]:
    """Frozen explanation payload for immutable snapshots (never reinterpret later)."""
    return {
        "operator": assert_known_operator(operator),
        "inputs": inputs,
        "result": format(result, "f") if result is not None else None,
    }
