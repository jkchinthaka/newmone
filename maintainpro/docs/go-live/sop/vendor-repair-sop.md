# SOP: Vendor Repair

**Document ID:** SOP-VND-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02  
**Policy:** No approved quotation = No vendor repair.

---

## Purpose

Manage external vendor repairs linked to work orders with quotation approval before work and invoice controls after (UAT-013).

## Responsible role

**Primary:** `MANAGER`, `ADMIN`  
**Finance:** User with `purchase_orders.approve_finance`  
**Input:** `TECHNICIAN` / `SUPERVISOR` (recommend vendor)

## Prerequisites

- Work order exists for asset
- Vendor in supplier master (or create via authorized role)

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Decide vendor repair required | Manager assessment |
| 2 | Open WO → **Vendor Repair** tab | WO detail |
| 3 | Create repair record; select vendor | Vendor repair form |
| 4 | Upload quotation document | Attachments |
| 5 | Submit quotation for approval | Approval workflow |
| 6 | Manager approves quotation (≠ requester if applicable) | Approve quotation |
| 7 | Authorize vendor to perform work | Status / notes |
| 8 | Track work off-site; update WO status | WO updates |
| 9 | Receive invoice; attach to WO | Vendor repair tab |
| 10 | Supervisor verifies completed work | [supervisor-verification-sop.md](supervisor-verification-sop.md) |
| 11 | Finance approves invoice | [finance-invoice-approval-sop.md](finance-invoice-approval-sop.md) |

---

## Approval

| Gate | Approver |
|------|----------|
| Quotation | Manager (operational) |
| Invoice over quotation | Manager + finance with reason |
| Emergency without quotation | Manager emergency override — audited |

---

## Audit trail

Quotation amounts, approvers, invoice numbers, duplicate detection, verification link.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Single-source vendor | Document justification on WO |
| Warranty repair | Zero-value quotation note |
| Partial vendor completion | WO remains open until verified |

---

## What NOT to do

- Do **not** pay vendor without WO in system
- Do **not** approve quotation you prepared without segregation
- Do **not** accept duplicate invoice numbers
- Do **not** skip supervisor verification before finance

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Vendor dispute | Operations Manager |
| Invoice without quotation | Finance hold |
| Quality failure | Reject verification; vendor rework |

---

## Related documents

- [finance-invoice-approval-sop.md](finance-invoice-approval-sop.md)
- [anti-fraud-policy.md](../anti-fraud-policy.md)
