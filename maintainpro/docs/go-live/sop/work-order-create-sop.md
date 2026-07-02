# SOP: Work Order Create

**Document ID:** SOP-WO-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02  
**Policy:** No system record = No official company action.

---

## Purpose

Define the standard process for creating a maintenance work order in MaintainPro so all official repair work is planned, traceable, and assignable before physical work begins.

## Responsible role

**Primary:** `MANAGER`, `ADMIN`, `OPERATIONS_MANAGER`, `ASSET_MANAGER`  
**May initiate request (not create):** `TECHNICIAN`, `SUPERVISOR`, `CLEANER` — must route to manager

## Prerequisites

- Valid asset or vehicle linked (or exception documented)
- Reporter and location identified
- Priority and category/taxonomy selected (UAT-015)

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Receive maintenance request (inspection, breakdown, preventive schedule) | Email, walk-in, inspection — **must convert to WO** |
| 2 | Log in as authorized creator | `/login` |
| 3 | Navigate to Work Orders | `/work-orders` |
| 4 | Click **New Work Order** | `/work-orders/new` |
| 5 | Select **asset/vehicle**, location, category/taxonomy | Create form |
| 6 | Set **priority** (standard, high, critical, emergency) | Form |
| 7 | Enter description, safety notes, requested by | Form |
| 8 | Attach initial photos if available | Evidence (optional at create) |
| 9 | Save — record WO number | System assigns ID |
| 10 | Proceed to assignment SOP | [work-order-assignment-sop.md](work-order-assignment-sop.md) |

---

## Approval

| Condition | Approver |
|-----------|----------|
| Standard WO | No separate approval — creation is manager authority |
| Emergency WO | Manager may create immediately; document reason in description |
| High-cost / capital | Additional approval per company policy — note in WO |

---

## Audit trail

System records: `createdBy`, `tenantId`, timestamp, initial status, asset link. Changes appear in WO history (UAT-008).

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Asset not in system | Admin creates asset first, then WO |
| After-hours emergency | On-call manager creates WO before work starts |
| Farm / facility module | Use module-specific create path; same policy |

---

## What NOT to do

- Do **not** tell technicians to start work without a WO number
- Do **not** use paper job cards as the official record
- Do **not** create duplicate WOs for same fault — search existing open WOs first
- Do **not** leave asset field blank on asset-linked maintenance

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Cannot find asset | Asset manager / Admin |
| System error on save | Admin P1 |
| Dispute on priority | Operations Manager |

---

## Related documents

- [work-order-assignment-sop.md](work-order-assignment-sop.md)
- [anti-fraud-policy.md](../anti-fraud-policy.md)
