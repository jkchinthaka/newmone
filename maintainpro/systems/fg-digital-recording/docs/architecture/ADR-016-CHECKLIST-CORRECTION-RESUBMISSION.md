# ADR-016 — Checklist Correction and Resubmission

**Status:** Accepted (Phase 09B technical foundation)
**Date:** 2026-08-08
**Deciders:** Engineering (quality-first direct-main)
**Related:** ADR-013, ADR-014, ADR-015

## Context

Phase 09A records an immutable `SupervisorReview` with decision
`RETURNED_FOR_CORRECTION` without reopening the record or creating Submission #2.
Operators need a controlled way to correct answers and resubmit while preserving
full historical provenance.

## Decision

### Ownership

Correction/resubmission belongs to `apps/recording/`. Reviews remain the owner of
immutable Supervisor decisions only.

### Explicit `ChecklistCorrection`

Introduce `ChecklistCorrection` as an explicit correction-cycle entity:

- One cycle per source `ChecklistSubmission` (OneToOne)
- Status: `DRAFT` → `RESUBMITTED` only
- Links `source_submission` and optional `resulting_submission`
- Preserves `started_by` / `started_at` provenance

### Record status remains SUBMITTED

`ChecklistRecord` is **not** silently reverted `SUBMITTED → DRAFT`.
An active `ChecklistCorrection(DRAFT)` represents the mutable workspace.
This avoids pretending Submission #1 became a draft again.

### Mutable working copy

`ChecklistResponse` remains the mutable working store. Edits are allowed only when:

- record is initial `DRAFT`, **or**
- record is `SUBMITTED` **and** an eligible active correction exists for the
  latest returned submission

### Source snapshot cloning

On first Start Correction only, rebuild `ChecklistResponse` rows from the
immutable `ChecklistSubmissionResponse` snapshot. Duplicate Start is idempotent
and must not reset already-edited working values.

### Resubmission

`resubmit_checklist_correction`:

- validates the same structural completeness rules as initial submit
- computes `next_submission_number = max(submission_number) + 1` under record lock
- creates a full-state immutable snapshot (not delta-only)
- marks correction `RESUBMITTED`
- leaves source submission / snapshot / SupervisorReview unchanged
- leaves `ChecklistRecord` as `SUBMITTED` and `ChecklistTask` as `PENDING`

### Permissions

Reuse `scheduling.record_checklisttask`. Manage/review permissions do not imply
correction. Ownership locking (original submitter only) remains
**EVIDENCE REQUIRED** — any authorized recorder in Organization scope may correct.

### Supervisor re-entry

Submission #N+1 is eligible for a new Supervisor review because it has no review.
Submission #N remains reviewed and must not reappear in the pending queue.

## Consequences

- Full historical chain: Submission #1 → Correction #1 → Submission #2 → …
- QA / HOLD / RELEASE / REJECT / CorrectiveAction remain out of scope
- Production use remains blocked until published definitions and role mapping exist

## Non-goals (Phase 09B)

- QA review models
- Food-safety CorrectiveAction workflows
- Visual answer diffs
- Automatic role assignment
- FG-QA-001 publication
