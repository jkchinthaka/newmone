"""Shared immutable snapshot section rendering for recording / Supervisor / QA."""

from __future__ import annotations

import uuid
from typing import Any, cast

from apps.checklists.models import ChecklistItemKind, ChecklistResponseType
from apps.recording.repeating import (
    ResponseKey,
    active_sample_count,
    partition_definition_items,
    responses_by_key,
)


def control_point_display_fields(item: Any, response: Any) -> dict[str, str]:
    """
    Prefer frozen submission control_point_context; fall back to definition item.

    Published items are immutable, but frozen context is the historical authority.
    """
    ctx = getattr(response, "control_point_context", None) if response is not None else None
    if isinstance(ctx, dict) and ctx.get("control_point_class"):
        return {
            "control_point_class": str(ctx.get("control_point_class") or "NONE"),
            "criticality": str(ctx.get("criticality") or ""),
        }
    return {
        "control_point_class": str(getattr(item, "control_point_class", None) or "NONE"),
        "criticality": str(getattr(item, "criticality", None) or ""),
    }


def display_snapshot_value(item: Any, response: Any) -> str:
    from apps.checklists.measurement import format_decimal_for_display, unit_display_label

    if response is None:
        return "—"
    if item.item_kind == ChecklistItemKind.CALCULATED:
        if response.number_value is None:
            return "—"
        precision = None
        ctx = getattr(response, "measurement_context", None) or {}
        if isinstance(ctx, dict) and ctx.get("decimal_precision") is not None:
            precision = ctx.get("decimal_precision")
        else:
            precision = getattr(item, "decimal_precision", None)
        formatted = format_decimal_for_display(response.number_value, precision)
        unit_code = ""
        if isinstance(ctx, dict) and ctx.get("unit"):
            unit_code = str(ctx.get("unit") or "")
        else:
            unit_code = item.unit or ""
        unit = f" {unit_display_label(unit_code)}" if unit_code else ""
        if unit == " (no unit)":
            unit = ""
        elif unit_code:
            unit = f" {unit_code}"
        operator = ""
        context = getattr(response, "calculation_context", None) or {}
        if isinstance(context, dict) and context.get("operator"):
            operator = f" [{context['operator']}]"
        return f"{formatted}{unit}{operator}"
    if item.response_type in {
        ChecklistResponseType.YES_NO,
        ChecklistResponseType.YES_NO_NA,
    }:
        return response.choice_value or "—"
    if item.response_type == ChecklistResponseType.NUMBER:
        if response.number_value is None:
            return "—"
        precision = None
        ctx = getattr(response, "measurement_context", None) or {}
        if isinstance(ctx, dict) and ctx.get("decimal_precision") is not None:
            precision = ctx.get("decimal_precision")
        else:
            precision = getattr(item, "decimal_precision", None)
        formatted = format_decimal_for_display(response.number_value, precision)
        unit_code = ""
        if isinstance(ctx, dict) and ctx.get("unit") is not None:
            unit_code = str(ctx.get("unit") or "")
        else:
            unit_code = item.unit or ""
        unit = f" {unit_code}" if unit_code else ""
        return f"{formatted}{unit}"
    if item.response_type == ChecklistResponseType.TEXT:
        return response.text_value or "—"
    if item.response_type == ChecklistResponseType.SELECT:
        option = response.selected_option
        return option.label if option is not None else "—"
    return "—"


def index_snapshot_rows(rows: list[Any]) -> dict[ResponseKey, Any]:
    return responses_by_key(rows)


def render_snapshot_sections(
    sections: list[Any],
    snapshots: dict[ResponseKey, Any] | dict[uuid.UUID, Any],
) -> list[dict[str, Any]]:
    """
    Build read-only section trees including repeating sample rows.

    Accepts legacy ``{item_id: row}`` maps (treated as sample_index=1) or
    ``{(item_id, sample_index): row}`` maps.
    """
    keyed: dict[ResponseKey, Any]
    first_key = next(iter(snapshots.keys()), None)
    if first_key is not None and not isinstance(first_key, tuple):
        legacy = cast(dict[uuid.UUID, Any], snapshots)
        keyed = {(item_id, 1): row for item_id, row in legacy.items()}
    else:
        keyed = cast(dict[ResponseKey, Any], snapshots)

    rendered: list[dict[str, Any]] = []
    for section in sections:
        items = list(section.items.all())
        top_simple, groups, children_by_parent, _ = partition_definition_items(items)
        items_out: list[dict[str, Any]] = []

        # Preserve section position order: walk items, skip children (rendered under group).
        seen_groups: set[uuid.UUID] = set()
        for item in items:
            if item.parent_item_id is not None:
                continue
            if item.item_kind == ChecklistItemKind.REPEATING_GROUP:
                if item.id in seen_groups:
                    continue
                seen_groups.add(item.id)
                children = children_by_parent.get(item.id, [])
                n = active_sample_count(children=children, responses=keyed)
                sample_rows: list[dict[str, Any]] = []
                for sample_index in range(1, n + 1):
                    child_cells = []
                    for child in children:
                        snap = keyed.get((child.id, sample_index))
                        cp = control_point_display_fields(child, snap)
                        child_cells.append(
                            {
                                "item": child,
                                "sample_index": sample_index,
                                "display_value": display_snapshot_value(child, snap),
                                "answered": snap is not None,
                                "evaluation_result": getattr(snap, "evaluation_result", "")
                                if snap is not None
                                else "",
                                "evaluation_context": getattr(snap, "evaluation_context", None)
                                if snap is not None
                                else None,
                                "control_point_class": cp["control_point_class"],
                                "criticality": cp["criticality"],
                            }
                        )
                    sample_rows.append({"sample_index": sample_index, "children": child_cells})
                items_out.append(
                    {
                        "kind": "repeating_group",
                        "item": item,
                        "sample_rows": sample_rows,
                        "answered": n > 0,
                        "display_value": f"{n} sample row(s)",
                    }
                )
                continue

            snap = keyed.get((item.id, 1))
            kind = "calculated" if item.item_kind == ChecklistItemKind.CALCULATED else "simple"
            cp = control_point_display_fields(item, snap)
            items_out.append(
                {
                    "kind": kind,
                    "item": item,
                    "sample_index": 1,
                    "display_value": display_snapshot_value(item, snap),
                    "answered": snap is not None,
                    "calculation_context": getattr(snap, "calculation_context", None)
                    if snap is not None
                    else None,
                    "evaluation_result": getattr(snap, "evaluation_result", "")
                    if snap is not None
                    else "",
                    "evaluation_context": getattr(snap, "evaluation_context", None)
                    if snap is not None
                    else None,
                    "control_point_class": cp["control_point_class"],
                    "criticality": cp["criticality"],
                }
            )

        # Safety: include any top_simple missed (should not happen if position walk is complete).
        _ = top_simple
        _ = groups
        rendered.append({"section": section, "items": items_out})
    return rendered
