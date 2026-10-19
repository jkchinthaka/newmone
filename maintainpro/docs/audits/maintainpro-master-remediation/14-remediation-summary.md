# 14 Remediation summary

Branch: `fix/enterprise-remediation-20261015` at `a79859dc`, uncommitted.

Implemented in this session:

- Access tokens no longer authorize from a stale role. `jwt.strategy.ts` and `tenant-context.guard.ts`.
- Generic status updates require `expectedVersion` and compare-and-set via `updateMany`.
- Work-order page sends that version on status, hold, and technician completion.
- Closed and legacy completed content edits require a verifier and a correction reason.

2026-10-15 continuation: stock issue requires `Idempotency-Key`, no longer returns "Stock deducted", rejects `CLOSED` without an override, and stores the audit with the outbox. Part-request issue audit is inside the issue transaction. My Jobs now sorts by due date and id and reports `assignedTotal` from SQL; filtered rows are still capped at 500.

Left open on purpose:

- UX branch merge.
- My Jobs SQL pagination.
- Mandatory idempotency across ERP.
- Live evidence storage and PM scheduler.
- Commit, push, and PR. The instruction for this run forbids them without a separate authorization, and independent QA has not passed.
