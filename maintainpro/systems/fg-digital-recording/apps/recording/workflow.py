"""Phase 10B facade — canonical derivation lives in apps.core.checklist_workflow.

Recording/scheduling callers may import from here without duplicating ownership logic.
"""

from __future__ import annotations

from apps.core.checklist_workflow import (
    QA_TERMINAL_SEMANTICS_NOTE,
    STATE_LABELS,
    STATE_OWNERSHIP,
    ChecklistOperationalWorkflowState,
    ChecklistWorkflowState,
    WorkflowFilter,
    WorkflowSnapshot,
    annotate_workflow_display,
    attach_workflow_snapshots,
    derive_checklist_workflow,
    detect_workflow_inconsistencies,
    filter_tasks_by_workflow,
    filter_tasks_by_workflow_state,
    prefetch_workflow_graph,
    workflow_badge_class,
    workflow_context_for_task,
    workflow_prefetch_queryset,
    workflow_prefilter_queryset,
)

QA_TERMINAL_STATES = ChecklistOperationalWorkflowState.QA_TERMINAL
WorkflowDerivation = WorkflowSnapshot


def workflow_badge_css_class(state: str | None) -> str:
    return f"status-pill {workflow_badge_class(state)}"


def workflow_display_label(state: str | None) -> str:
    if not state:
        return "Unknown"
    return STATE_LABELS.get(str(state), str(state))


def find_workflow_consistency_issues(task):  # type: ignore[no-untyped-def]
    snap = derive_checklist_workflow(task)
    return [
        type("WorkflowConsistencyIssue", (), {"code": code, "message": code})()
        for code in snap.inconsistencies
    ]


__all__ = [
    "QA_TERMINAL_SEMANTICS_NOTE",
    "QA_TERMINAL_STATES",
    "STATE_OWNERSHIP",
    "STATE_LABELS",
    "ChecklistOperationalWorkflowState",
    "ChecklistWorkflowState",
    "WorkflowDerivation",
    "WorkflowFilter",
    "WorkflowSnapshot",
    "annotate_workflow_display",
    "attach_workflow_snapshots",
    "derive_checklist_workflow",
    "detect_workflow_inconsistencies",
    "filter_tasks_by_workflow",
    "filter_tasks_by_workflow_state",
    "find_workflow_consistency_issues",
    "prefetch_workflow_graph",
    "workflow_badge_class",
    "workflow_badge_css_class",
    "workflow_context_for_task",
    "workflow_display_label",
    "workflow_prefetch_queryset",
    "workflow_prefilter_queryset",
]
