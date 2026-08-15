"""Template tags for derived checklist operational workflow badges (Phase 10B)."""

from __future__ import annotations

from typing import Any

from django import template

from apps.core.checklist_workflow import (
    QA_TERMINAL_SEMANTICS_NOTE,
    STATE_LABELS,
    ChecklistOperationalWorkflowState,
    derive_checklist_workflow,
    workflow_badge_class,
)

register = template.Library()


@register.simple_tag
def workflow_badge_class_for(state: str | None) -> str:
    return workflow_badge_class(state)


@register.simple_tag
def workflow_state_label(state: str | None) -> str:
    if not state:
        return ""
    return STATE_LABELS.get(str(state), str(state))


@register.inclusion_tag("core/partials/workflow_badge.html")
def workflow_badge(snapshot_or_state: Any = None, *, task: Any = None) -> dict[str, Any]:
    """Render a consistent operational workflow badge."""
    state = None
    label = None
    note = ""
    if task is not None:
        snap = getattr(task, "workflow_snapshot", None) or derive_checklist_workflow(task)
        state = snap.state
        label = snap.label
        if snap.is_qa_terminal:
            note = QA_TERMINAL_SEMANTICS_NOTE
    elif snapshot_or_state is not None:
        if hasattr(snapshot_or_state, "state"):
            state = snapshot_or_state.state
            label = getattr(snapshot_or_state, "label", None) or STATE_LABELS.get(state, state)
            if getattr(snapshot_or_state, "is_qa_terminal", False):
                note = QA_TERMINAL_SEMANTICS_NOTE
        else:
            state = str(snapshot_or_state)
            label = STATE_LABELS.get(state, state)
            if state in ChecklistOperationalWorkflowState.QA_TERMINAL:
                note = QA_TERMINAL_SEMANTICS_NOTE
    return {
        "state": state or "",
        "label": label or "",
        "badge_class": workflow_badge_class(state),
        "note": note,
    }


@register.simple_tag
def workflow_filter_choices() -> list[tuple[str, str]]:
    return list(ChecklistOperationalWorkflowState.CHOICES)
