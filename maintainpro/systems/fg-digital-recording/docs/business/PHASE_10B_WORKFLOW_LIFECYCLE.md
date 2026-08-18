# Phase 10B - Checklist Operational Workflow Lifecycle

**Document status:** Technical foundation - production use still BLOCKED  
**Phase:** 10B  
**ADR:** [ADR-022-CHECKLIST-WORKFLOW-STATE-OWNERSHIP.md](../architecture/ADR-022-CHECKLIST-WORKFLOW-STATE-OWNERSHIP.md)

## Goal

One coherent derived operational workflow without duplicating truth across Task, Record, Submission, SupervisorReview, Correction, and QAReview.

## State ownership

See ADR-022. Each model keeps only its authoritative fields.

## Derived states

| State | Meaning (derived) |
| --- | --- |
| PENDING | Task open; no record |
| IN_RECORDING | Record DRAFT |
| AWAITING_SUPERVISOR | Latest submission #1 awaiting Supervisor |
| RETURNED_FOR_CORRECTION | Latest Supervisor RETURNED; no open correction draft |
| CORRECTION_DRAFT | Active correction DRAFT |
| AWAITING_SUPERVISOR_RESUBMISSION | Latest submission #N>1 awaiting Supervisor |
| AWAITING_QA | Latest Supervisor APPROVED; no QA yet |
| QA_RELEASED / QA_HELD / QA_REJECTED | Latest QA disposition (in-app only) |
| CANCELLED | Task CANCELLED or MISSED (inactive). Timeliness OVERDUE remains due-display, not a workflow copy. |

## QA terminal note

QA dispositions do **not** close warehouse / ERP / dispatch.

## UI

Task list/detail and recording list show derived workflow badges and optional `workflow` filter.

## Implementation

- Canonical derive: `apps.core.checklist_workflow`
- Recording facade: `apps.recording.workflow` (re-exports; no second ownership logic)
- Tests: `apps/core/tests/test_phase10b_workflow_lifecycle.py`

## STATUS: PHASE 10B WORKFLOW LIFECYCLE COMPLETE
