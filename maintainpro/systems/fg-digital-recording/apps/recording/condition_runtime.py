"""Server-authoritative conditional rule evaluation for recording (Phase 06J)."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import ValidationError

from apps.checklists.conditions import (
    assert_known_comparator,
    build_condition_context,
    evaluate_predicate,
    extract_answer_snapshot,
)
from apps.checklists.models import (
    ChecklistConditionRuleKind,
    ChecklistItem,
    ChecklistItemKind,
    ChecklistItemRule,
)
from apps.recording.models import ChecklistResponse


def _response_to_snapshot(
    item: ChecklistItem, response: ChecklistResponse | None
) -> dict[str, Any]:
    if response is None:
        return extract_answer_snapshot(item=item)
    option = response.selected_option
    return extract_answer_snapshot(
        item=item,
        choice_value=response.choice_value,
        number_value=response.number_value,
        text_value=response.text_value,
        selected_option_id=option.id if option is not None else None,
        selected_option_value=option.value if option is not None else "",
    )


def load_rules_for_items(items: list[ChecklistItem]) -> list[ChecklistItemRule]:
    item_ids = [item.id for item in items]
    if not item_ids:
        return []
    # Prefer prefetched condition_rules when present.
    collected: list[ChecklistItemRule] = []
    missing_ids: list[uuid.UUID] = []
    for item in items:
        cache = getattr(item, "_prefetched_objects_cache", {})
        if "condition_rules" in cache:
            collected.extend(list(item.condition_rules.all()))
        else:
            missing_ids.append(item.id)
    if missing_ids:
        collected.extend(
            list(
                ChecklistItemRule.objects.select_related(
                    "operand_item",
                    "operand_item__section",
                    "expected_option",
                    "target_item",
                ).filter(target_item_id__in=missing_ids)
            )
        )
    return collected


def resolve_condition_flags(
    *,
    items: list[ChecklistItem],
    responses: dict[tuple[uuid.UUID, int], ChecklistResponse],
) -> dict[tuple[uuid.UUID, int], dict[str, Any]]:
    """
    Resolve visible / required / evidence_required per (item_id, sample_index).

    Visibility: no VISIBLE_IF ⇒ visible; else predicate must be true.
    Required: visible AND (static is_required OR REQUIRED_IF true).
    Evidence: visible AND EVIDENCE_REQUIRED_IF true.
    """
    items_by_id = {item.id: item for item in items}
    rules = load_rules_for_items(items)
    rules_by_target: dict[uuid.UUID, list[ChecklistItemRule]] = {}
    for rule in rules:
        rules_by_target.setdefault(rule.target_item_id, []).append(rule)

    answerable = [
        item
        for item in items
        if item.item_kind in {ChecklistItemKind.SIMPLE, ChecklistItemKind.CALCULATED}
    ]

    # Determine sample indexes present per item (at least 1).
    samples_by_item: dict[uuid.UUID, set[int]] = {item.id: {1} for item in answerable}
    for (item_id, sample_index), _response in responses.items():
        if item_id in samples_by_item:
            samples_by_item[item_id].add(sample_index)
    for item in answerable:
        if item.parent_item_id:
            # Align with sibling samples for the same group.
            siblings = [
                other for other in answerable if other.parent_item_id == item.parent_item_id
            ]
            union: set[int] = {1}
            for sibling in siblings:
                union |= samples_by_item.get(sibling.id, {1})
            for sibling in siblings:
                samples_by_item[sibling.id] = set(union)

    result: dict[tuple[uuid.UUID, int], dict[str, Any]] = {}
    for item in answerable:
        for sample_index in sorted(samples_by_item[item.id]):
            evaluations: list[dict[str, Any]] = []
            visible = True
            required_if = False
            evidence_if = False
            item_rules = rules_by_target.get(item.id, [])
            if not item_rules:
                required = bool(item.is_required)
                result[(item.id, sample_index)] = {
                    "visible": True,
                    "required": required,
                    "evidence_required": False,
                    "condition_context": build_condition_context(
                        visible=True,
                        required=required,
                        evidence_required=False,
                        evaluations=[],
                    ),
                }
                continue

            for rule in item_rules:
                operand = items_by_id.get(rule.operand_item_id) or rule.operand_item
                operand_sample = sample_index if operand.parent_item_id else 1
                response = responses.get((operand.id, operand_sample))
                snapshot = _response_to_snapshot(operand, response)
                predicate = evaluate_predicate(
                    comparator=rule.comparator,
                    operand_snapshot=snapshot,
                    expected_text=rule.expected_text,
                    expected_number=rule.expected_number,
                    expected_boolean=rule.expected_boolean,
                    expected_option_id=rule.expected_option_id,
                    expected_list=list(rule.expected_list or []),
                )
                evaluations.append(
                    {
                        "rule_kind": rule.rule_kind,
                        "comparator": assert_known_comparator(rule.comparator),
                        "operand_item_id": str(rule.operand_item_id),
                        "predicate": predicate,
                        "operand": snapshot,
                    }
                )
                if rule.rule_kind == ChecklistConditionRuleKind.VISIBLE_IF:
                    visible = predicate
                elif rule.rule_kind == ChecklistConditionRuleKind.REQUIRED_IF:
                    required_if = predicate
                elif rule.rule_kind == ChecklistConditionRuleKind.EVIDENCE_REQUIRED_IF:
                    evidence_if = predicate

            if not visible:
                required = False
                evidence_required = False
            else:
                required = bool(item.is_required) or required_if
                evidence_required = evidence_if

            result[(item.id, sample_index)] = {
                "visible": visible,
                "required": required,
                "evidence_required": evidence_required,
                "condition_context": build_condition_context(
                    visible=visible,
                    required=required,
                    evidence_required=evidence_required,
                    evaluations=evaluations,
                ),
            }
    return result


def assert_no_answers_for_hidden_items(
    *,
    flags: dict[tuple[uuid.UUID, int], dict[str, Any]],
    pending_keys: list[tuple[uuid.UUID, int]],
) -> None:
    """Reject client bypass: answers for non-visible items are not allowed."""
    errors: dict[str, list[str]] = {}
    for item_id, sample_index in pending_keys:
        meta = flags.get((item_id, sample_index))
        if meta is not None and not meta["visible"]:
            errors.setdefault(str(item_id), []).append(
                "Item is not applicable under current answers (VISIBLE_IF)."
            )
    if errors:
        raise ValidationError(errors)


def clear_hidden_draft_responses(
    *,
    flags: dict[tuple[uuid.UUID, int], dict[str, Any]],
    existing: dict[tuple[uuid.UUID, int], ChecklistResponse],
) -> dict[tuple[uuid.UUID, int], ChecklistResponse]:
    """Delete draft answers for items that are currently not visible."""
    kept: dict[tuple[uuid.UUID, int], ChecklistResponse] = {}
    for key, response in existing.items():
        meta = flags.get(key)
        if meta is not None and not meta["visible"]:
            response.delete()
            continue
        kept[key] = response
    return kept


def apply_condition_context_to_drafts(
    *,
    flags: dict[tuple[uuid.UUID, int], dict[str, Any]],
    existing: dict[tuple[uuid.UUID, int], ChecklistResponse],
) -> None:
    for key, response in existing.items():
        meta = flags.get(key)
        if meta is None:
            continue
        response.condition_context = meta["condition_context"]
        response.save(update_fields=["condition_context", "updated_at"])
