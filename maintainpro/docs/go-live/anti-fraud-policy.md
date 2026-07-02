# MaintainPro Anti-Fraud & Off-System Work Prevention Policy

This document supports **UAT-020** system controls. Operational staff must follow these rules; the MaintainPro API enforces them in backend services (not UI-only).

## Core principles

1. **No Work Order = No Parts Issue** — spare parts cannot be issued without a valid, active work order and approved part request (emergency override requires manager reason + audit).
2. **No Evidence = No Completion** — technician completion requires required before/after evidence, notes, and QR verification when applicable.
3. **No Supervisor Verification = No Closure** — technicians submit completion; supervisors/managers verify before closure.
4. **No Approved Quotation = No Vendor Repair** — external vendor work requires an approved quotation unless a documented emergency override exists.
5. **No Verified Work Order = No Finance Payment** — invoices must link to a supervisor-verified work order with required attachments.
6. **No Audit Trail = No Override** — any override requires reason, actor, before/after values, and appears in management reports.
7. **No System Record = No Company Action** — off-system repairs, parts issues, and payments are prohibited.

## Maker-checker approval

The same user **cannot** request and approve the same sensitive transaction, including:

- Part requests (operational and finance approval)
- Vendor repair and quotation approval
- Invoice finance approval for high-cost repairs
- Work order close overrides
- Stock adjustments and gate-out overrides

Violations are blocked by the API unless an authorized admin override is recorded with reason.

## Parts issue & return

- Store keepers issue only **approved** quantities against a work order.
- Technicians cannot self-issue parts.
- Duplicate part requests are blocked or flagged.
- Stock cannot go negative.
- Pending returns must be confirmed by the store keeper.
- Emergency direct issue (`addPart` override) requires written reason and audit.

## Evidence & QR

- Rejected evidence blocks completion and may move the job to **REWORK_REQUIRED**.
- QR mismatch blocks completion unless supervisor/manager override with reason.
- Evidence deletion after completion requires admin override with reason.

## Gate-out restrictions

Gate release is blocked when:

- Vehicle has critical open work orders (critical priority, emergency, or accident repair)
- Compliance documents are expired (insurance, revenue license, emission)
- Service is overdue or vehicle status restricts movement
- Gate inspection failed

Security officers see the block reason. Overrides require authorized role + reason + audit.

## Invoice approval

- Duplicate vendor invoice numbers are blocked or warned.
- Invoice amount exceeding approved quotation requires higher approval and reason.
- Finance cannot bypass missing evidence or supervisor verification.

## Admin override policy

- Overrides are never silent — all require `reason` (minimum 3 characters).
- Overrides appear in **Reports → Fraud & Control → Admin Overrides**.
- Repeated overrides by the same user are reviewed by operations/finance management.

## Configuration

- `FRAUD_CONTROL_ENABLED` (default `true`) — toggles maker-checker and strict parts issue rules.
- Violation detection feeds the fraud dashboard and maintenance exception reports.

## Disclaimer

Risk scores and fraud indicators are **rule-based operational metrics**, not AI fraud detection. Management uses them for supervision and audit — not as sole legal evidence.
