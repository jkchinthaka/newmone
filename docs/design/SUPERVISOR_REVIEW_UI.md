# Supervisor Review UI (Phase 09A)

**Document status:** Technical UI contract — production review still gated
**Related:** [ADR-015-SUPERVISOR-REVIEW.md](../architecture/ADR-015-SUPERVISOR-REVIEW.md)

## Surfaces

1. **Queue** (`/reviews/`) — Organization-scoped SUBMITTED submissions without a review.
2. **Submission detail** — immutable snapshot answers + Approve / Return for correction.
3. **Confirmation** — POST + CSRF; optional review note.
4. **Result** — read-only SUPERVISOR REVIEW COMPLETED.

## Language

- **Approve** = Supervisor review complete / may become eligible for future QA stage.
- Does **not** mean product RELEASE, QA approval, or HOLD clearance.
- Decision text is always visible as words (not color alone).

## Forbidden controls

Supervisor Approve (QA), QA Approve, Release, Hold, Reject, Edit answers, Change decision.

## Accessibility

- Skip link / landmarks via base shell
- Table headers / pagination labels
- Form labels and help text for optional note
- Escaped user text (notes and submitted TEXT)
