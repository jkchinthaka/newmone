"""Repeating-group / sample-index helpers for draft + submission (Phase 06H).

Technical UX defaults only — does not invent Nelna AQL or company sample sizes.
"""

from __future__ import annotations

import uuid
from collections.abc import Hashable
from typing import Any

from django.core.exceptions import ValidationError

from apps.checklists.constants import REPEAT_SAMPLE_TECHNICAL_CEILING
from apps.checklists.models import ChecklistItem, ChecklistItemKind

ResponseKey = tuple[uuid.UUID, int]


def response_key(item_id: uuid.UUID, sample_index: int = 1) -> ResponseKey:
    return (item_id, sample_index)


def normalize_answers(
    answers: dict[Hashable, Any],
) -> dict[ResponseKey, Any]:
    """Accept ``{item_id: raw}`` (legacy sample 1) or ``{(item_id, sample_index): raw}``."""
    normalized: dict[ResponseKey, Any] = {}
    for key, raw in answers.items():
        if isinstance(key, tuple) and len(key) == 2:
            item_id, sample_index = key
            normalized[(uuid.UUID(str(item_id)), int(sample_index))] = raw
        else:
            normalized[(uuid.UUID(str(key)), 1)] = raw
    return normalized


def responses_by_key(responses: list[Any]) -> dict[ResponseKey, Any]:
    return {(row.checklist_item_id, row.sample_index): row for row in responses}


def is_answerable_item(item: ChecklistItem) -> bool:
    return item.item_kind == ChecklistItemKind.SIMPLE


def partition_definition_items(
    items: list[ChecklistItem],
) -> tuple[
    list[ChecklistItem],
    list[ChecklistItem],
    dict[uuid.UUID, list[ChecklistItem]],
    list[ChecklistItem],
]:
    """Return (top SIMPLE, REPEATING_GROUP parents, children_by_parent, top CALCULATED)."""
    top_simple: list[ChecklistItem] = []
    top_calculated: list[ChecklistItem] = []
    groups: list[ChecklistItem] = []
    children_by_parent: dict[uuid.UUID, list[ChecklistItem]] = {}
    for item in items:
        if item.item_kind == ChecklistItemKind.REPEATING_GROUP:
            groups.append(item)
            continue
        if item.parent_item_id is not None:
            children_by_parent.setdefault(item.parent_item_id, []).append(item)
            continue
        if item.item_kind == ChecklistItemKind.SIMPLE:
            top_simple.append(item)
        elif item.item_kind == ChecklistItemKind.CALCULATED:
            top_calculated.append(item)
    for parent_id, children in children_by_parent.items():
        children_by_parent[parent_id] = sorted(
            children, key=lambda row: (row.position, str(row.pk))
        )
    return top_simple, groups, children_by_parent, top_calculated


def effective_repeat_min(group: ChecklistItem, children: list[ChecklistItem]) -> int:
    """
    Minimum sample rows required at submit time.

    Uses defined ``repeat_min`` when set. If unset and any child is required,
    technical minimum is 1 row so required children can be answered.
    Never invents AQL / company sample counts.
    """
    if group.repeat_min is not None:
        return int(group.repeat_min)
    if any(child.is_required for child in children):
        return 1
    return 0


def present_sample_indexes(
    *,
    children: list[ChecklistItem],
    responses: dict[ResponseKey, Any],
) -> list[int]:
    child_ids = {child.id for child in children}
    indexes = sorted({idx for (item_id, idx) in responses if item_id in child_ids})
    return indexes


def active_sample_count(
    *,
    children: list[ChecklistItem],
    responses: dict[ResponseKey, Any],
) -> int:
    indexes = present_sample_indexes(children=children, responses=responses)
    return max(indexes) if indexes else 0


def editor_sample_indexes(
    *,
    group: ChecklistItem,
    children: list[ChecklistItem],
    responses: dict[ResponseKey, Any],
    requested_count: int | None = None,
) -> list[int]:
    """
    Contiguous sample indexes to render in the draft editor.

    Priority: explicit requested_count (UI add/remove) → existing answers →
    repeat_default → repeat_min → technical single empty row when the group has children.
    """
    if requested_count is not None:
        count = max(0, int(requested_count))
    else:
        existing = active_sample_count(children=children, responses=responses)
        if existing > 0:
            count = existing
        elif group.repeat_default is not None:
            count = int(group.repeat_default)
        elif group.repeat_min is not None and group.repeat_min > 0:
            count = int(group.repeat_min)
        elif children:
            count = 1
        else:
            count = 0

    if group.repeat_max is not None:
        count = min(count, int(group.repeat_max))
    count = min(count, REPEAT_SAMPLE_TECHNICAL_CEILING)
    return list(range(1, count + 1))


def assert_sample_index_allowed(
    *,
    item: ChecklistItem,
    sample_index: int,
    items_by_id: dict[uuid.UUID, ChecklistItem],
) -> None:
    if sample_index < 1:
        raise ValidationError({str(item.id): ["sample_index must be >= 1."]})
    if sample_index > REPEAT_SAMPLE_TECHNICAL_CEILING:
        raise ValidationError(
            {
                str(item.id): [
                    f"sample_index cannot exceed technical ceiling "
                    f"({REPEAT_SAMPLE_TECHNICAL_CEILING})."
                ]
            }
        )
    if item.item_kind == ChecklistItemKind.REPEATING_GROUP:
        raise ValidationError({str(item.id): ["REPEATING_GROUP items do not accept answers."]})
    if item.item_kind != ChecklistItemKind.SIMPLE:
        raise ValidationError({str(item.id): ["Only SIMPLE items accept answers."]})

    if item.parent_item_id is None:
        if sample_index != 1:
            raise ValidationError(
                {str(item.id): ["Top-level SIMPLE items only allow sample_index=1."]}
            )
        return

    parent = items_by_id.get(item.parent_item_id)
    if parent is None or parent.item_kind != ChecklistItemKind.REPEATING_GROUP:
        raise ValidationError(
            {str(item.id): ["Child item parent must be a REPEATING_GROUP on this version."]}
        )
    if parent.repeat_max is not None and sample_index > int(parent.repeat_max):
        raise ValidationError(
            {str(item.id): [f"sample_index cannot exceed repeat_max ({parent.repeat_max})."]}
        )


def validate_repeating_submit_shape(
    *,
    groups: list[ChecklistItem],
    children_by_parent: dict[uuid.UUID, list[ChecklistItem]],
    responses: dict[ResponseKey, Any],
) -> None:
    """Reject non-contiguous indexes and over-max sample counts at submit."""
    errors: dict[str, list[str]] = {}
    for group in groups:
        children = children_by_parent.get(group.id, [])
        indexes = present_sample_indexes(children=children, responses=responses)
        n = max(indexes) if indexes else 0
        if indexes and indexes != list(range(1, n + 1)):
            errors[str(group.id)] = [
                f"Repeating group {group.code} sample indexes must be contiguous from 1."
            ]
            continue
        if group.repeat_max is not None and n > int(group.repeat_max):
            errors[str(group.id)] = [
                f"Repeating group {group.code} exceeds repeat_max ({group.repeat_max})."
            ]
        if n > REPEAT_SAMPLE_TECHNICAL_CEILING:
            errors[str(group.id)] = [
                f"Repeating group {group.code} exceeds technical sample ceiling."
            ]
    if errors:
        raise ValidationError(errors)
