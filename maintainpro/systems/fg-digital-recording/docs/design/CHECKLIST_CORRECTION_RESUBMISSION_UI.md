# Checklist Correction / Resubmission UI

**Status:** Technical foundation (Phase 09B)
**Related:** ADR-016, SUPERVISOR_REVIEW_UI, CHECKLIST_DRAFT_RECORDING_UI

## Purpose

Allow authorized recorders to start a controlled correction after
`RETURNED_FOR_CORRECTION`, edit a mutable working copy, and resubmit as the next
immutable `ChecklistSubmission`.

## Flow

1. Returned Submission Detail (`recording/submissions/<id>/returned/`)
2. Start Correction (POST) or Continue Correction
3. Correction Editor (`recording/corrections/<id>/`) — CORRECTION DRAFT
4. Save Correction Draft
5. Resubmit Confirmation (`recording/corrections/<id>/resubmit/`) — POST only
6. Latest submitted read-only view (Submission #N+1)
7. Future Supervisor queue picks up #N+1

## Key UX rules

- Show source Submission #, Supervisor decision, optional escaped review note
- State banner: CORRECTION DRAFT / Correcting Submission #N / Future #N+1
- Confirm that original Submission #N remains unchanged
- Submission history lists submissions, supervisor decisions, and corrections
- No QA / HOLD / RELEASE / REJECT actions
- CSRF on all mutating forms; no resubmit via GET

## Accessibility

- Landmark headings for correction and confirmation pages
- Required markers remain visible
- Review notes and TEXT answers rendered escaped (no `mark_safe`)

## Production note

UI is available for synthetic published definitions in non-production tests.
Production correction remains **BLOCKED** until readiness gates close.
