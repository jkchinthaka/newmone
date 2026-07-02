# SOP: Admin Override

**Document ID:** SOP-ADM-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02  
**Policy:** No audit trail = No override.

---

## Purpose

Define when and how authorized users may bypass system validations (QR mismatch, gate blocks, completion rules, maker-checker) with mandatory reason and management visibility.

## Responsible role

**Primary:** `ADMIN`, `MANAGER`, `OPERATIONS_MANAGER`, `SUPER_ADMIN` (per override type)  
**Initiator:** Any role encountering block — must escalate, not self-bypass

## Prerequisites

- Legitimate business justification documented
- Manager approval for floor-initiated requests (ticket or verbal log → ticket)
- User holds permission for override type

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | User hits validation block (QR, gate, completion, parts) | Error message |
| 2 | User escalates to manager with WO/vehicle ID | Support channel |
| 3 | Manager assesses — approves override request or fixes root cause | Review |
| 4 | Authorized user opens override dialog | Module-specific UI |
| 5 | Enter **reason** (minimum 3 characters; prefer detailed) | Reason field |
| 6 | Confirm before/after values displayed | Dialog |
| 7 | Submit — system writes audit event | Audit log + fraud report |
| 8 | Notify original requester to continue workflow | Comms |
| 9 | Weekly: manager reviews overrides in fraud report | `/reports/fraud-control` |

---

## Approval

| Override type | Minimum authority |
|---------------|-------------------|
| QR mismatch on completion | `SUPERVISOR`, `MANAGER` |
| Gate out block | `gate.override.approve` holders |
| WO close without verification | `MANAGER`, `ADMIN` |
| Maker-checker bypass | `ADMIN` — exceptional |
| Evidence deletion post-complete | `ADMIN` |

---

## Audit trail

Override actor, reason, timestamp, entity ID, before/after state → **Reports → Fraud & Control → Admin Overrides**.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Repeated override same user | Operations/finance review — possible training or disciplinary |
| P0 emergency | Verbal manager approval → enter override within 1 hour |

---

## What NOT to do

- Do **not** use generic reasons ("OK", "fix", "urgent")
- Do **not** override to hide fraud or errors
- Do **not** direct DB edits instead of override API
- Do **not** coach staff to request overrides to skip process

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Override not available in UI | Admin P1 — backend issue |
| Suspected abuse | Compliance + HR per company policy |
| Override needed but manager unavailable | Operations Manager on-call |

---

## Related documents

- [anti-fraud-policy.md](../anti-fraud-policy.md)
- [management-report-review-sop.md](management-report-review-sop.md)
