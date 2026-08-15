# ADR-015 — Supervisor Review Foundation (Phase 09A)

**Status:** Accepted (technical foundation; production Supervisor review still gated)
**Date:** 2026-08-08
**Depends on:** ADR-014

## Context

Phase 08B produces immutable `ChecklistSubmission` snapshots. Owner-directed
provisional workflow requires Supervisor review of every submission before any
future QA stage. Reviews must not mutate draft responses or historical snapshots.

## Decision

1. Introduce bounded context `apps.reviews` owning human review workflow.
2. `SupervisorReview` binds **OneToOne** to `ChecklistSubmission` (not `ChecklistRecord`).
3. Decisions are provisional technical labels: `APPROVED` and `RETURNED_FOR_CORRECTION`.
4. `APPROVED` means Supervisor review complete / eligible for **future** QA — not QA
   approval, RELEASE, product acceptance, or regulatory acceptance.
5. `RETURNED_FOR_CORRECTION` records that correction will eventually be required —
   Phase 09A does **not** reopen the record, edit Submission #1, or create Submission #2.
6. Reviews are immutable after create (no normal update/delete services).
7. Permission `reviews.review_checklistsubmission` is separate from
   `scheduling.record_checklisttask` and `scheduling.manage_checklisttask`.
8. No automatic real-role mapping (including no assumed SUPERVISOR role).
9. Segregation-of-duties (`reviewed_by != submitted_by`) remains **EVIDENCE REQUIRED**
   and is **not** enforced in Phase 09A.
10. `review_note` is optional; mandatory reason for return is unresolved policy.
11. Audit `SUPERVISOR_REVIEW_COMPLETED` omits notes and answer values.
12. `ChecklistTask` remains `PENDING`; no HOLD/RELEASE/REJECT/QA models.
13. Future Phase 09B: controlled correction → Submission #2 → new review.
14. Future Phase 10: QA eligibility requires SupervisorReview(APPROVED).

## Consequences

- Phase 09A technical Supervisor review may proceed with synthetic tests.
- Production Supervisor review remains blocked by role mapping, FG-QA-001
  publication, batch integration, and SoD evidence.
- Phase 09B / Phase 10 remain out of scope.

## References

- [SUPERVISOR_REVIEW_UI.md](../design/SUPERVISOR_REVIEW_UI.md)
- [PHASE_09_SUPERVISOR_REVIEW_READINESS_GATE.md](../business/PHASE_09_SUPERVISOR_REVIEW_READINESS_GATE.md)
- [ADR-014-CHECKLIST-SUBMISSION-SNAPSHOT.md](ADR-014-CHECKLIST-SUBMISSION-SNAPSHOT.md)
