# Checklist Recording UI (Phase 08A)

**Document status:** Draft recording UX — not production authorization
**Created:** 2026-08-08

## Flow

1. Recordable task list (`/recording/`) — PENDING tasks in Organizations where the actor has
   `scheduling.record_checklisttask`.
2. Start Recording (POST) or Continue Recording.
3. Draft editor (`/recording/<record_uuid>/`) rendered from the exact task `ChecklistVersion`.
4. Save Draft only — no Submit / Approve / Release / Hold / Reject.

## Editor

- Sections and items in definition order.
- Required items visually marked; unanswered required items still allow Save Draft.
- YES_NO / YES_NO_NA radio choices; NUMBER with unit + informational configured range;
  TEXT textarea; SELECT options from the item.
- Number ranges are never labelled PASS/FAIL.
- Validation errors redisplay per field without clearing other valid answers.
- TEXT is escaped in templates (not marked safe).

## Accessibility

- Skip link and page landmarks via shared base layout.
- Fieldsets/legends per item; status messages for empty list and save outcomes.
- Mobile-friendly structural markup using existing management shell styles.

## Out of scope

Submission, supervisor review, QA disposition, attachments, signatures, automatic evaluation.
