# Phase 07E — Recurring Checklist Scheduling

**Document status:** Technical foundation — **not** production frequency authorization  
**Phase:** 07E  
**Related:** APR-004 / ASM-006 (overnight operational day); Phase 07 production readiness gates  

---

## Purpose

Extend `ChecklistTask` beyond batch-triggered creation with configurable schedule definitions and replay-safe generation for:

| Trigger | Meaning |
| --- | --- |
| `BATCH` | Existing explicit batch path (`create_batch_checklist_task`) — not schedule rows |
| `SHIFT_START` / `SHIFT_END` | Bound to configured `Shift` rows |
| `SCHEDULED` | Optional window and/or interval (administrator-configured) |
| `MANUAL` | Explicit tokenized generation only |

**Do not invent Nelna frequencies.** Interval/window values are configuration fields only.

---

## Idempotency

Each occurrence has a deterministic `occurrence_key`. Unique on `(organization, checklist_template, occurrence_key)`. Celery retries and catch-up lookbacks must not duplicate tasks.

---

## Celery / Beat

- Task: `apps.scheduling.tasks.generate_due_checklist_tasks`
- Beat poll (`*/5` minutes) is **infrastructure only** — not a checklist frequency
- Replay-safe; optional lookback for missed Beat runs
- Compose service: `celery-beat`

---

## Missed / overdue

Statuses `OVERDUE` / `MISSED` represent schedule timeliness only.

**Never auto-create NCR** because a check was missed. Configurable `missed_policy`: `MARK_MISSED` | `CREATE_OVERDUE` | `SKIP` — production choice remains **DECISION REQUIRED**.

---

## Shift / timezone

Uses real `organizations.Shift` objects. Overnight bound is a provisional technical rule (`end_time <= start_time`); official night-shift operational-day policy remains **APR-004 / ASM-006 EVIDENCE REQUIRED**.

---

## STATUS: PHASE 07E RECURRING TASKS COMPLETE
