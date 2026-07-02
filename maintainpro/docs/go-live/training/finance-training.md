# Finance Training — MaintainPro

**UAT phase:** UAT-023  
**Role:** Finance approver (`purchase_orders.approve_finance`, `part_requests.approve_finance`, and/or `FINANCE_APPROVER` mapping)  
**Duration:** 90 minutes classroom + 30 minutes hands-on  
**Last updated:** 2026-07-02

---

## 1. Role overview

Finance approvers control **financial release** on purchase orders, part requests (finance step), and vendor repair invoices. Payment and accrual decisions require a **supervisor-verified work order** with supporting documentation in MaintainPro. **No verified WO = No finance payment.**

---

## 2. What you CAN do

| Action | Route / area |
|--------|--------------|
| View dashboard (read-only analytics) | `/` |
| View action center (limited widgets) | `/action-center` |
| View purchase orders pending finance | Procurement / PO |
| **Finance approve** purchase orders | PO → Finance approve |
| **Finance approve** part requests (when required) | Part requests |
| Approve vendor repair invoices | WO → Vendor repair tab |
| View management intelligence | `/reports/management-intelligence` |
| View fraud & control reports | `/reports/fraud-control` |
| Export reports (where enabled) | Report export |
| View billing (read-only) | Billing nav |

---

## 3. What you CANNOT do

| Blocked action | Why |
|----------------|-----|
| Create or operational-approve POs alone | Segregation — store/asset manager |
| Approve invoice without supervisor verification | UAT-013 / anti-fraud |
| Approve same PO you created | Maker-checker |
| Issue parts from store | `INVENTORY_KEEPER` |
| Create/assign work orders | Maintenance manager |
| Technician completion or supervisor verify | Other roles |
| Admin / system health | Admin only |
| Bypass duplicate invoice warning without reason | Fraud control |
| ERP sync trigger (unless granted) | `purchase_orders.erp_sync` permission |

---

## 4. Daily workflow

### Queue review

1. Log in → open PO and invoice queues (or report filters for pending finance).
2. Sort by amount, age, and vendor.

[Screenshot: Purchase orders pending finance approval]

### Approval checklist (every transaction)

3. Valid **work order** linked and **supervisor verified**.
4. Approved **quotation** on file for vendor repairs.
5. Invoice number not duplicate (system warning).
6. Amount within approved quotation (or higher approval documented).
7. Evidence attachments present (photos, delivery note).
8. Requester ≠ finance approver (you).

[Screenshot: Vendor invoice approval on work order]

### Approve or reject

9. **Approve** → system records finance approval + audit.
10. **Reject** with clear reason → returns to maintenance/vendor.

### Reporting

11. Weekly: review **Management Intelligence** profitability summary.
12. Weekly: scan **Fraud Control** for invoice and override anomalies.

[Screenshot: Management intelligence summary]

---

## 5. Common mistakes

| Mistake | Correct approach |
|---------|------------------|
| Approving from email PDF only | Require system record |
| Same person operational + finance | Different approvers |
| Paying above quotation without escalation | Manager/director sign-off + reason |
| Ignoring missing verification flag | Hold payment |
| Off-system payment "to speed up" | Prohibited — policy violation |

---

## 6. Escalation

| Situation | Escalate to |
|-----------|-------------|
| Missing verification on valid work | Maintenance Manager |
| Quotation dispute | Operations Manager |
| Suspected duplicate/fraud | Compliance + Manager |
| System shows wrong amount | Admin P1 + vendor clarification |
| ERP sync failure | DevOps / integration owner |

Reference: [finance-invoice-approval-sop.md](../sop/finance-invoice-approval-sop.md)

---

## 7. Support contacts

| Level | Contact |
|-------|---------|
| Maintenance Manager | **TBD** |
| Finance Director | **TBD** |
| MaintainPro admin | **TBD** |

---

## 8. Related SOPs

- [finance-invoice-approval-sop.md](../sop/finance-invoice-approval-sop.md)
- [vendor-repair-sop.md](../sop/vendor-repair-sop.md)
- [management-report-review-sop.md](../sop/management-report-review-sop.md)

---

## 9. Training sign-off

| Field | Value |
|-------|-------|
| Trainee name | |
| Employee ID | |
| Training date | |
| Trainer | |
| Sample finance approval in training | ☐ Yes |

| Trainee signature | Date |
|-------------------|------|
| | |

| Trainer signature | Date |
|-------------------|------|
| | |

**Policy acknowledged:** I will not authorize payment without a complete, verified record in MaintainPro.
