# ADR-022 - Checklist Operational Workflow State Ownership

**Status:** Accepted (Phase 10B technical foundation)  
**Date:** 2026-08-10  
**Deciders:** Domain workflow architecture (engineering)  
**Related:** ADR-013, ADR-014, ADR-015, ADR-016, ADR-017; Phases 08-10A

## Context

Checklist work spans multiple bounded contexts:

- `ChecklistTask` (scheduling)
- `ChecklistRecord` / `ChecklistSubmission` / `ChecklistCorrection` (recording)
- `SupervisorReview` (reviews)
- `QAReview` (quality)

Copying a single workflow status onto every model would duplicate truth, drift under concurrency, and obscure ownership. Operators still need one coherent label for queues and badges.

## Decision

### 1. Authoritative state owners (source of truth)

| Owner | Authoritative concern |
| --- | --- |
| `ChecklistTask` | Operational task orchestration (`PENDING` / `CANCELLED`; timeliness `OVERDUE` / `MISSED` are not a second workflow column - MISSED maps to derived `CANCELLED`) |
| `ChecklistRecord` | Editable recording session (`DRAFT` / `SUBMITTED`) |
| `ChecklistSubmission` | Immutable submitted evidence (submission number / snapshot) |
| `SupervisorReview` | Immutable Supervisor decision on a submission (`APPROVED` / `RETURNED_FOR_CORRECTION`) |
| `ChecklistCorrection` | Correction cycle (`DRAFT` / `RESUBMITTED`) |
| `QAReview` | Immutable QA disposition on a submission (`RELEASE` / `HOLD` / `REJECT`) |

### 2. Derived operational workflow (not stored)

`apps.core.checklist_workflow.derive_checklist_workflow` computes one label:

`PENDING` -> `IN_RECORDING` -> `AWAITING_SUPERVISOR` -> `RETURNED_FOR_CORRECTION` -> `CORRECTION_DRAFT` -> `AWAITING_SUPERVISOR_RESUBMISSION` -> `AWAITING_QA` -> `QA_RELEASED` / `QA_HELD` / `QA_REJECTED`, plus `CANCELLED`.

No new persisted status column is added to Task/Record/Submission/Review/Correction/QA for this lifecycle.

### 3. QA terminal semantics

`QA_RELEASED` / `QA_HELD` / `QA_REJECTED` are **provisional in-application dispositions**. They do **not** close warehouse, ERP, inventory, or dispatch lifecycle. Downstream operational close-out remains EVIDENCE REQUIRED / later phases.

### 4. UI

Consistent badges and optional task-list / recording-list `workflow=` filter use the derived snapshot. Task orchestration status and due-display badges remain separate.

### 5. Inconsistency detection

Impossible combinations are reported as diagnostic markers (tests / detail UI) without inventing auto-repair policy.

## Consequences

- Queues can filter by derived workflow without dual-writing status.
- Existing 08-10A services remain owners of their transitions.
- Production readiness still blocked by published definitions, role mappings, and post-QA evidence.
