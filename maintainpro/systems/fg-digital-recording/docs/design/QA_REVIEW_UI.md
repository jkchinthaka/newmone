# QA Review UI

**Status:** Technical foundation (Phase 10A)
**Related:** ADR-017

## Flow

1. QA Review Queue (`/quality/`)
2. Submission detail (immutable snapshot + Supervisor APPROVED context)
3. Confirm RELEASE / HOLD / REJECT (POST + CSRF)
4. Read-only QA result

## Rules

- Show batch, checklist, version, submission #, Supervisor context
- Optional escaped QA note
- Confirmation states that no ERP/inventory/warehouse/dispatch action occurs
- No change/delete after review
- No correction / task completion / ERP controls
- Status as text, not color alone
- Pagination on queue

## Production note

UI supports synthetic published definitions in tests. Production QA remains BLOCKED.
