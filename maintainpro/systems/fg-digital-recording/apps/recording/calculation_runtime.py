"""Server-authoritative calculated response application (Phase 06I)."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError

from apps.checklists.calculation import (
    apply_operator,
    build_calculation_context,
    validate_calculation_definition,
)
from apps.checklists.models import ChecklistItem, ChecklistItemKind
from apps.recording.models import ChecklistResponse
from apps.recording.repeating import ResponseKey, present_sample_indexes, responses_by_key


def ordered_operands(item: ChecklistItem) -> list[ChecklistItem]:
    related = item.calculation_operand_links
    # Prefetch / some DB backends may yield a plain list instead of a RelatedManager.
    try:
        qs = related.all() if hasattr(related, "all") else related
    except Exception:  # noqa: BLE001
        qs = related
    if isinstance(qs, list) or not hasattr(qs, "select_related"):
        links = sorted(
            list(qs),
            key=lambda link: (getattr(link, "position", 0), str(getattr(link, "pk", ""))),
        )
        return [link.source_item for link in links]
    links = list(
        qs.select_related("source_item", "source_item__section").order_by("position", "pk")
    )
    return [link.source_item for link in links]


def topological_calculated_items(items: list[ChecklistItem]) -> list[ChecklistItem]:
    """Order CALCULATED items so dependencies compute first."""
    items_by_id = {item.id: item for item in items}
    calculated = [item for item in items if item.item_kind == ChecklistItemKind.CALCULATED]
    pending = {item.id for item in calculated}
    ordered: list[ChecklistItem] = []
    guard = 0
    while pending:
        guard += 1
        if guard > len(pending) + len(calculated) + 5:
            raise ValidationError(
                {"calculation": "Unable to order calculated items (possible cycle)."}
            )
        progressed = False
        for item_id in list(pending):
            item = items_by_id[item_id]
            deps = [
                link.source_item_id
                for link in item.calculation_operand_links.all()
                if link.source_item_id in pending
            ]
            if deps:
                continue
            ordered.append(item)
            pending.remove(item_id)
            progressed = True
        if not progressed:
            raise ValidationError({"calculation": "Circular calculation dependency detected."})
    return ordered


def _numeric_from_response(response: Any) -> Decimal | None:
    if response is None:
        return None
    value = getattr(response, "number_value", None)
    return value if isinstance(value, Decimal) else None


def compute_calculated_value(
    *,
    item: ChecklistItem,
    sample_index: int,
    responses: dict[ResponseKey, Any],
    items_by_id: dict[uuid.UUID, ChecklistItem],
) -> tuple[Decimal | None, dict[str, Any]]:
    operands = ordered_operands(item)
    validate_calculation_definition(calculated=item, operands=operands, items_by_id=items_by_id)
    values: list[Decimal] = []
    inputs: list[dict[str, Any]] = []
    for operand in operands:
        row = responses.get((operand.id, sample_index))
        number = _numeric_from_response(row)
        inputs.append(
            {
                "item_id": str(operand.id),
                "code": operand.code,
                "sample_index": sample_index,
                "number_value": format(number, "f") if number is not None else None,
            }
        )
        if number is not None:
            values.append(number)
    result = apply_operator(operator=item.calculation_operator, values=values)
    context = build_calculation_context(
        operator=item.calculation_operator,
        inputs=inputs,
        result=result,
    )
    return result, context


def apply_calculations_to_draft(
    *,
    record_id: uuid.UUID,
    items: list[ChecklistItem],
    responses: dict[ResponseKey, ChecklistResponse],
) -> dict[ResponseKey, ChecklistResponse]:
    """
    Recompute all CALCULATED draft rows for the record.

    Client-supplied calculated answers are ignored — server is authoritative.
    """
    items_by_id = {item.id: item for item in items}
    calculated_items = topological_calculated_items(items)
    working = dict(responses)

    for item in calculated_items:
        if item.parent_item_id is None:
            sample_indexes = [1]
        else:
            siblings = [
                sibling
                for sibling in items
                if sibling.parent_item_id == item.parent_item_id
                and sibling.item_kind == ChecklistItemKind.SIMPLE
            ]
            sample_indexes = present_sample_indexes(children=siblings, responses=working) or [1]

        for sample_index in sample_indexes:
            result, context = compute_calculated_value(
                item=item,
                sample_index=sample_index,
                responses=working,
                items_by_id=items_by_id,
            )
            key = (item.id, sample_index)
            existing = working.get(key)
            if result is None:
                if existing is not None:
                    existing.delete()
                    working.pop(key, None)
                continue
            if existing is None:
                existing = ChecklistResponse(
                    checklist_record_id=record_id,
                    checklist_item=item,
                    sample_index=sample_index,
                )
            existing.choice_value = ""
            existing.text_value = ""
            existing.selected_option = None
            from apps.checklists.measurement import (
                apply_configured_rounding,
                build_measurement_context,
            )

            precision = getattr(item, "decimal_precision", None)
            mode = getattr(item, "rounding_mode", "") or ""
            quantized, rounded = apply_configured_rounding(result, precision, mode)
            existing.number_value = quantized
            existing.calculation_context = context
            existing.measurement_context = build_measurement_context(
                value=quantized,
                unit=getattr(item, "unit", "") or "",
                decimal_precision=precision,
                rounding_mode=mode,
                rounding_applied=rounded,
                minimum_value=None,
                maximum_value=None,
                min_inclusive=True,
                max_inclusive=True,
            )
            existing.full_clean()
            existing.save()
            working[key] = existing

    # Drop orphan calculated rows for indexes no longer present.
    calculated_ids = {item.id for item in calculated_items}
    for key, row in list(working.items()):
        item_id, sample_index = key
        if item_id not in calculated_ids:
            continue
        item = items_by_id[item_id]
        if item.parent_item_id is None:
            allowed = {1}
        else:
            siblings = [
                sibling
                for sibling in items
                if sibling.parent_item_id == item.parent_item_id
                and sibling.item_kind == ChecklistItemKind.SIMPLE
            ]
            allowed = set(present_sample_indexes(children=siblings, responses=working) or [1])
        if sample_index not in allowed:
            row.delete()
            working.pop(key, None)

    return responses_by_key(list(working.values()))
