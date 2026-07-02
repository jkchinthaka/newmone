# SOP: Finance Invoice Approval

**Document ID:** SOP-FIN-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02  
**Policy:** No verified work order = No finance payment.

---

## Purpose

Ensure vendor invoices and finance-stage purchase orders are approved only when maintenance work is verified, documented, and free of maker-checker violations.

## Responsible role

**Primary:** User with `purchase_orders.approve_finance` or `FINANCE_APPROVER` mapping  
**Prerequisite owners:** `SUPERVISOR` (verification), `MANAGER` (quotation)

## Prerequisites

- Work order **supervisor verified**
- Approved vendor quotation on file (vendor repairs)
- Invoice attached in MaintainPro
- Requester ≠ finance approver

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Open finance approval queue or report filter | PO / WO vendor tab / reports |
| 2 | Select transaction — open linked WO | Detail view |
| 3 | Confirm supervisor verification timestamp | WO governance |
| 4 | Compare invoice to approved quotation | Vendor repair tab |
| 5 | Check duplicate invoice number warning | System validation |
| 6 | Verify evidence attachments (delivery note, photos) | Attachments |
| 7 | **Approve finance** or **Reject** with reason | Finance approve action |
| 8 | Export audit record for ERP/payment (if integrated) | Report export — audited |

---

## Approval

| Scenario | Required action |
|----------|-----------------|
| Within quotation | Finance approver |
| Above quotation | Manager/director reason + finance |
| Missing verification | **Hold** — return to maintenance |
| Duplicate invoice | Reject or investigate fraud |

---

## Audit trail

Finance approver ID, timestamp, amount, invoice number, reject reason. Appears in fraud control exports.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Partial invoice / progress payment | Document tranche in WO notes |
| Credit note | Separate recorded adjustment — not off-system |
| ERP sync failure | DevOps ticket; do not double-pay manually without record |

---

## What NOT to do

- Do **not** pay from email PDF without system approval
- Do **not** approve your own operational request
- Do **not** bypass missing evidence
- Do **not** split invoice to avoid approval thresholds

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Verification dispute | Maintenance Manager |
| Fraud indicator | Compliance + Manager |
| System amount mismatch | Vendor clarification + Admin |

---

## Related documents

- [vendor-repair-sop.md](vendor-repair-sop.md)
- [supervisor-verification-sop.md](supervisor-verification-sop.md)
- [management-report-review-sop.md](management-report-review-sop.md)
