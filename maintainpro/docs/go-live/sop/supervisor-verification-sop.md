# SOP: Supervisor Verification

**Document ID:** SOP-WO-004  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02  
**Policy:** No supervisor verification = No closure.

---

## Purpose

Quality gate: supervisors confirm technician work, evidence, and compliance before work orders proceed to closure or finance steps.

## Responsible role

**Primary:** `SUPERVISOR`, `MAINTENANCE_SUPERVISOR`  
**Alternate:** `MANAGER` (when supervisor unavailable — document delegation)

## Prerequisites

- WO in **Pending Supervisor Verification** (or equivalent)
- Technician submission complete

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Open verification queue | `/action-center` → Supervisor verification |
| 2 | Select WO — review priority and age | Queue |
| 3 | Open evidence gallery (before/after) | WO detail |
| 4 | Verify QR status and notes | WO detail |
| 5 | Optional: physical spot-check on site | Floor |
| 6a | **Approve verification** if satisfactory | Verify action |
| 6b | **Reject** with specific rework instructions | Reject → REWORK_REQUIRED |
| 7 | For high-risk WOs: confirm fraud flags clear | Fraud indicators on WO |
| 8 | Record moves to manager/finance queue as applicable | Status update |

---

## Approval

Supervisor verification is mandatory unless documented **admin/manager override** per [admin-override-sop.md](admin-override-sop.md).

---

## Audit trail

`verifiedBy`, verification timestamp, reject reason, override reason if QR bypassed.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Supervisor conflict (own work) | Another supervisor or manager verifies |
| Missing evidence | Reject — do not approve |
| Emergency closure | Manager override + incident link |

---

## What NOT to do

- Do **not** bulk-approve without opening each WO
- Do **not** verify from technician verbal claim only
- Do **not** approve with QR mismatch without override reason
- Do **not** backdate verification outside system

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| High-cost WO concerns | Manager before verify |
| Vendor work quality | Manager + vendor SOP |
| Repeated technician rejects | Manager HR/training review |

---

## Related documents

- [technician-completion-sop.md](technician-completion-sop.md)
- [finance-invoice-approval-sop.md](finance-invoice-approval-sop.md)
