# Checklist Submission UI (Phase 08B)

**Document status:** Submission UX — not production authorization
**Created:** 2026-08-08

## DRAFT editor

- Save Draft — partial allowed
- Submit Checklist — opens confirmation; requires all required items answered
- Show required progress and missing required item list
- No PASS/FAIL, Supervisor, QA, HOLD/RELEASE/REJECT controls

## Confirmation

- Batch reference, checklist, version, organization
- Answered count and required unanswered count
- Confirm Submit POST + CSRF
- Block confirm when required items remain

## SUBMITTED read-only view

- Uses immutable `ChecklistSubmissionResponse` values
- Shows submission number, submitted by/at
- Optional unanswered items shown as not answered
- No Save Draft / Submit / edit widgets
- TEXT escaped (never marked safe)

## Accessibility

- Shared landmarks and alerts
- Clear read-only state language
- Actionable missing-required lists
