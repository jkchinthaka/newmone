# ADR-013 — Checklist Draft Recording Foundation (Phase 08A)

**Status:** Accepted (technical foundation; production recording still gated)
**Date:** 2026-08-08
**Depends on:** ADR-010; ADR-011; ADR-012; Phase 07B recording permission

## Context

Checklist definitions live in `checklists`. Batch task orchestration lives in `scheduling`.
Operator answers must not be stored in either module. Phase 08A needs a draft-only runtime
foundation without submission, supervisor review, QA disposition, or HOLD/RELEASE automation.

FG-QA-001 remains an unapproved DRAFT and must not be published or used for production tasks.

## Decision

1. Introduce bounded context **`apps.recording`** (MODULE_MAP name updated from planned `records`
   to `recording` for clarity; future `records` label remains forbidden as a duplicate app).
2. **`ChecklistRecord`** is the stable draft identity for one `ChecklistTask` (OneToOne).
3. **`ChecklistResponse`** stores typed values (choice / number / text / selected_option) —
   not arbitrary JSON — for validation, reporting readiness, and integrity.
4. Exactly one value column may be set per saved response (model + CheckConstraint + service).
5. Partial drafts are allowed: required items may remain unanswered until Phase 08B submission.
6. NUMBER out-of-range values are recordable; min/max are informational metadata only in 08A.
7. Responses may only target items/options belonging to `task.checklist_version`.
8. Authorization uses `scheduling.record_checklisttask` with Organization scope; manage ≠ record.
9. Audit events `CHECKLIST_RECORD_STARTED` / `CHECKLIST_RECORD_DRAFT_SAVED` omit answer values.
10. Concurrent start is race-safe via uniqueness + IntegrityError handling; concurrent draft
    last-write is acceptable until ownership-locking policy is evidenced.
11. No submission, Supervisor, QA, HOLD/RELEASE, attachments, or revision history in 08A.

## Consequences

- Phase 08A technical draft recording may proceed with synthetic PUBLISHED templates in tests.
- Production recording remains blocked by readiness gates (published pilot definition, recorder
  role mapping, batch source, applicability evidence).
- Future submission/correction must preserve originals — silent overwrite of submitted data is
  prohibited (out of 08A scope).

## References

- [CHECKLIST_RECORDING_UI.md](../design/CHECKLIST_RECORDING_UI.md)
- [PHASE_08_RECORDING_READINESS_GATE.md](../business/PHASE_08_RECORDING_READINESS_GATE.md)
- [ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md](ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md)
