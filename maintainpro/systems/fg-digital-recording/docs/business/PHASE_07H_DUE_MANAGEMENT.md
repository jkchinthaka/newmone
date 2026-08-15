# Phase 07H — Checklist Due / Overdue Foundation

**Document status:** Technical foundation — no invented company SLA durations  
**Phase:** 07H  

---

## Rule

Due windows are **configured**, never invented:

| Field | Meaning |
| --- | --- |
| `due_from` | Optional start of due window → before this: `NOT_DUE` |
| `due_at` / `due_to` | Deadline → strictly after: `OVERDUE` |
| `due_soon_minutes` | Optional configured threshold for `DUE_SOON` (null = unused) |

Display states are **derived** at read time (`NOT_DUE` | `DUE` | `DUE_SOON` | `OVERDUE`). Inactive tasks (`CANCELLED` / `MISSED`) have no due-queue state.

## Non-goals

- No hardcoded 30 minutes / 2 hours / 1 shift defaults
- **Overdue ≠ Non-Conformance** unless separately approved
- No automatic NCR creation from overdue

## UI

- Due-state filter on checklist task list
- Derived due badges
- Overdue queue (`?due=OVERDUE`)

## Audit

`CHECKLIST_TASK_DUE_WINDOW_UPDATED` records configured window changes with `overdue_is_not_ncr` / `no_invented_sla` metadata.

---

## STATUS: PHASE 07H DUE MANAGEMENT COMPLETE
