# Phase 09C — Supervisor Review Governance Hardening

**Document status:** Technical foundation — production Supervisor review still BLOCKED  
**Phase:** 09C  

---

## Preserved flow

`APPROVED` / `RETURNED_FOR_CORRECTION` → immutable `SupervisorReview` → 09B correction / resubmission unchanged.

## Real role governance (Phase 03C)

- Authorization remains `reviews.review_checklistsubmission` via scoped Role assignments.
- **No invented Supervisor job titles** and no seeded business RoleTemplate rows.
- Temporary cover uses time-bounded `ScopedRoleAssignment` on a technical `TECH_REV_DELG_*` role (RBAC-visible; requires `valid_until`).

## Self-review

| Mode | Enforcement |
| --- | --- |
| `PENDING` (default) | Explicit SoD open (APR-010 / SOD-01) — **not blocked** |
| `PROHIBIT` | Blocked only with owner `evidence_reference` |
| `ALLOW` | Allowed only with owner `evidence_reference` |

## Review due time

Optional `review_sla_minutes` on org policy. **Null = no overdue.** Never invent SLA durations.

## Queues

- **Pending** — latest unreviewed submission per record
- **Overdue** — pending + configured due past
- **Resubmission** — pending with `submission_number > 1`

## Audit

Immutable reviews; events: `SUPERVISOR_REVIEW_COMPLETED`, `SUPERVISOR_REVIEW_GOVERNANCE_POLICY_SET`, temporary delegation granted/revoked. Notes/answers excluded from metadata.

---

## STATUS: PHASE 09C SUPERVISOR GOVERNANCE COMPLETE
