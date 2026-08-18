# ADR-014 — Checklist Submission Immutable Snapshot (Phase 08B)

**Status:** Accepted (technical foundation; production recording still gated)
**Date:** 2026-08-08
**Depends on:** ADR-013

## Context

Phase 08A stores mutable working answers on `ChecklistResponse`. Production food-safety
recording requires that a submitted checklist cannot be silently rewritten, and that
future Supervisor Review / QA decisions bind to a specific submitted artifact.

## Decision

1. Add `ChecklistRecord.status` with `DRAFT` → `SUBMITTED` only in Phase 08B.
2. Introduce `ChecklistSubmission` with `submission_number` (Phase 08B creates `#1` only).
3. Introduce typed `ChecklistSubmissionResponse` snapshots — not JSON blobs.
4. Mutable draft (`ChecklistResponse`) ≠ historical truth after submit.
5. Completeness validates required answers only — not PASS/FAIL, min/max, or HOLD.
6. `NO`, `NA` (where type allows), and out-of-range NUMBER remain submittable.
7. Submit is race-safe and idempotent for duplicate `#1` attempts.
8. After SUBMITTED, draft save/edit services reject mutations.
9. `ChecklistTask` status remains `PENDING` until a later lifecycle unit.
10. Audit `CHECKLIST_RECORD_SUBMITTED` omits answer values.
11. Future correction creates Submission `#2+` — never unlocks/overwrites `#1`.
12. Future Supervisor/QA bind to `ChecklistSubmission`, not draft rows.

## Consequences

- Phase 08B technical submission foundation may proceed with synthetic tests.
- Production recording remains blocked by readiness gates.
- Phase 09/10 models remain out of scope.

## References

- [CHECKLIST_SUBMISSION_UI.md](../design/CHECKLIST_SUBMISSION_UI.md)
- [ADR-013-CHECKLIST-DRAFT-RECORDING.md](ADR-013-CHECKLIST-DRAFT-RECORDING.md)
- [PHASE_08_RECORDING_READINESS_GATE.md](../business/PHASE_08_RECORDING_READINESS_GATE.md)
