"""Mongo-safe checklist definition loaders (no prefetch_related)."""

from __future__ import annotations

import uuid

from apps.checklists.models import (
    ChecklistCalculationOperand,
    ChecklistItem,
    ChecklistItemOption,
    ChecklistSection,
)
from apps.core.persistence import attach_reverse_relation


def load_sections_with_items_and_options(version_id: uuid.UUID) -> list[ChecklistSection]:
    """Load sections → items → options using batched queries + prefetch cache."""
    sections = list(ChecklistSection.objects.filter(version_id=version_id).order_by("position"))
    if not sections:
        return sections
    items = list(
        ChecklistItem.objects.filter(section_id__in=[s.id for s in sections])
        .select_related("parent_item")
        .order_by("section__position", "position")
    )
    options = list(
        ChecklistItemOption.objects.filter(item_id__in=[i.id for i in items]).order_by("position")
    )
    attach_reverse_relation(items, options, fk_attr="item_id", related_name="options")
    attach_reverse_relation(items, items, fk_attr="parent_item_id", related_name="child_items")
    attach_reverse_relation(sections, items, fk_attr="section_id", related_name="items")
    return sections


def load_version_items_for_recording(version_id: uuid.UUID) -> list[ChecklistItem]:
    """Load checklist items with options and calculation operands (Mongo-safe batches)."""
    items = list(
        ChecklistItem.objects.select_related("section", "parent_item")
        .filter(section__version_id=version_id)
        .order_by("section__position", "position")
    )
    if not items:
        return items
    item_ids = [i.id for i in items]
    options = list(
        ChecklistItemOption.objects.filter(item_id__in=item_ids).order_by("position")
    )
    operands = list(
        ChecklistCalculationOperand.objects.filter(calculated_item_id__in=item_ids)
        .select_related("source_item__section")
        .order_by("position")
    )
    attach_reverse_relation(items, options, fk_attr="item_id", related_name="options")
    attach_reverse_relation(
        items,
        operands,
        fk_attr="calculated_item_id",
        related_name="calculation_operand_links",
    )
    return items
