"""Server-authoritative evaluation application for recording drafts (Phase 06K)."""

from __future__ import annotations

import uuid
from typing import Any

from apps.checklists.evaluation import evaluate_item_response
from apps.checklists.models import (
    ChecklistEvaluationResult,
    ChecklistItem,
    ChecklistItemEvaluationRule,
    ChecklistItemKind,
)
from apps.recording.models import ChecklistResponse


def load_evaluation_rules(
    items: list[ChecklistItem],
) -> dict[uuid.UUID, ChecklistItemEvaluationRule]:
    item_ids = [item.id for item in items]
    if not item_ids:
        return {}
    rules = ChecklistItemEvaluationRule.objects.select_related("expected_option").filter(
        item_id__in=item_ids
    )
    return {rule.item_id: rule for rule in rules}


def apply_evaluations_to_drafts(
    *,
    items: list[ChecklistItem],
    responses: dict[tuple[uuid.UUID, int], ChecklistResponse],
    condition_flags: dict[tuple[uuid.UUID, int], dict[str, Any]] | None = None,
) -> None:
    """
    Compute and persist evaluation_result + evaluation_context on draft rows.

    Ignores any client-supplied PASS/FAIL — server recomputes always.
    Does not create/modify QAReview or dispositions.
    """
    rules = load_evaluation_rules(items)
    answerable = [
        item
        for item in items
        if item.item_kind in {ChecklistItemKind.SIMPLE, ChecklistItemKind.CALCULATED}
    ]
    for item in answerable:
        rule = rules.get(item.id)
        for (item_id, sample_index), response in list(responses.items()):
            if item_id != item.id:
                continue
            meta = (condition_flags or {}).get((item.id, sample_index), {})
            visible = bool(meta.get("visible", True))
            result, context = evaluate_item_response(
                item=item,
                rule=rule,
                visible=visible,
                choice_value=response.choice_value,
                number_value=response.number_value,
                selected_option_id=response.selected_option_id,
            )
            response.evaluation_result = result
            response.evaluation_context = context
            response.save(update_fields=["evaluation_result", "evaluation_context", "updated_at"])


def evaluation_label(result: str | None) -> str:
    mapping: dict[str, str] = {
        ChecklistEvaluationResult.PASS: "PASS (evaluation only — not QA RELEASE)",
        ChecklistEvaluationResult.FAIL: "FAIL (evaluation only — not QA HOLD/REJECT)",
        ChecklistEvaluationResult.WARN: "WARN (evaluation only — not QA disposition)",
        ChecklistEvaluationResult.NOT_EVALUATED: "NOT EVALUATED",
    }
    key = (result or "").strip().upper()
    return mapping.get(key, "NOT EVALUATED")
