"""Recording template filters."""

from __future__ import annotations

from typing import Any

from django import template
from django.forms import BoundField, Form

from apps.recording.forms import equipment_field_name, response_field_name
from apps.recording.selectors import actor_can_access_recording_module

register = template.Library()


@register.simple_tag(takes_context=True)
def user_can_record_checklist_tasks(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return actor_can_access_recording_module(user)


@register.filter
def response_bound_field(form: Form, item: Any) -> BoundField | None:
    name = response_field_name(item.id, 1)
    if name not in form.fields:
        return None
    return form[name]


@register.simple_tag
def response_bound_field_at(form: Form, item: Any, sample_index: int) -> BoundField | None:
    name = response_field_name(item.id, int(sample_index))
    if name not in form.fields:
        return None
    return form[name]


@register.filter
def equipment_bound_field(form: Form, item: Any) -> BoundField | None:
    name = equipment_field_name(item.id, 1)
    if name not in form.fields:
        return None
    return form[name]


@register.simple_tag
def equipment_bound_field_at(form: Form, item: Any, sample_index: int = 1) -> BoundField | None:
    name = equipment_field_name(item.id, int(sample_index))
    if name not in form.fields:
        return None
    return form[name]


@register.filter
def dict_get(mapping: Any, key: Any) -> Any:
    if mapping is None:
        return None
    try:
        return mapping.get(key)
    except AttributeError:
        return None


@register.simple_tag
def calculated_preview(responses: Any, item: Any, sample_index: int = 1) -> str:
    """Read-only preview of a server-computed CALCULATED draft value."""
    if responses is None or item is None:
        return "—"
    try:
        row = responses.get((item.id, int(sample_index)))
    except AttributeError:
        return "—"
    if row is None or getattr(row, "number_value", None) is None:
        return "—"
    from apps.checklists.measurement import format_decimal_for_display

    ctx = getattr(row, "measurement_context", None) or {}
    precision = None
    if isinstance(ctx, dict) and ctx.get("decimal_precision") is not None:
        precision = ctx.get("decimal_precision")
    else:
        precision = getattr(item, "decimal_precision", None)
    formatted = format_decimal_for_display(row.number_value, precision)
    unit_code = ""
    if isinstance(ctx, dict) and ctx.get("unit"):
        unit_code = str(ctx.get("unit") or "")
    else:
        unit_code = getattr(item, "unit", "") or ""
    unit = f" {unit_code}" if unit_code else ""
    return f"{formatted}{unit}"


@register.simple_tag
def condition_slot(flags: Any, item: Any, sample_index: int = 1) -> dict[str, Any]:
    """Server-evaluated visibility/requiredness for UX mirroring (not authoritative)."""
    default = {
        "visible": True,
        "required": bool(getattr(item, "is_required", False)),
        "evidence_required": False,
    }
    if flags is None or item is None:
        return default
    try:
        meta = flags.get((item.id, int(sample_index)))
    except AttributeError:
        return default
    if not isinstance(meta, dict):
        return default
    return {
        "visible": bool(meta.get("visible", True)),
        "required": bool(meta.get("required", default["required"])),
        "evidence_required": bool(meta.get("evidence_required", False)),
    }


def _evaluation_icon(result: str) -> str:
    return {
        "PASS": "[OK]",
        "FAIL": "[X]",
        "WARN": "[!]",
        "NOT_EVALUATED": "[-]",
    }.get((result or "").strip().upper(), "[-]")


@register.filter
def evaluation_icon_for(result: str) -> str:
    """Symbol companion for evaluation result (not color-only)."""
    return _evaluation_icon(result)


@register.filter
def evaluation_label_for(result: str) -> str:
    from apps.recording.evaluation_runtime import evaluation_label

    return evaluation_label(result)


@register.simple_tag
def evaluation_slot(responses: Any, item: Any, sample_index: int = 1) -> dict[str, str]:
    """
    Server-authored item evaluation indicator (Phase 06K).

    PASS/FAIL/WARN are measurement results only — never QA RELEASE/HOLD/REJECT.
    """
    from apps.recording.evaluation_runtime import evaluation_label

    result = ""
    if responses is not None and item is not None:
        try:
            row = responses.get((item.id, int(sample_index)))
        except AttributeError:
            row = None
        if row is not None:
            result = (getattr(row, "evaluation_result", "") or "").strip().upper()
    normalized = result or "NOT_EVALUATED"
    return {
        "result": normalized,
        "icon": _evaluation_icon(normalized),
        "label": evaluation_label(result),
    }


@register.filter
def control_point_label_for(control_point_class: str | None) -> str:
    """Human label for frozen or live control-point class."""
    from apps.checklists.control_point import control_point_display_label

    return control_point_display_label(control_point_class)


@register.filter
def criticality_label_for(criticality: str | None) -> str:
    """Human label for criticality metadata (blank => Unset)."""
    from apps.checklists.control_point import criticality_display_label

    return criticality_display_label(criticality)
