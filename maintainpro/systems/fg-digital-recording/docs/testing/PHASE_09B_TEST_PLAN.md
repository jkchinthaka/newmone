# Phase 09B Test Plan — Controlled Correction / Resubmission

**Status:** Technical foundation
**Related:** ADR-016, PHASE_09A_TEST_PLAN

## Scope

- `ChecklistCorrection` model integrity
- Start correction eligibility / idempotency / concurrency
- Snapshot cloning and non-reset on duplicate Start
- Correction draft save (permissions, typed integrity, partial draft)
- Resubmit completeness reuse, numbering, full-state snapshot
- Immutability of source submission / snapshot / SupervisorReview
- Supervisor queue regression (#1 stays reviewed; #2 becomes pending)
- Authorization / IDOR / CSRF / audit minimization / admin read-only
- Query-bound correction editor

## Out of scope

QA models, HOLD/RELEASE/REJECT, CorrectiveAction domain, FG-QA-001 publication.

## Primary suite

`apps/recording/tests/test_phase09b_correction.py`
