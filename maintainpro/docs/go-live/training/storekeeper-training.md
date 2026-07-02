# Store Keeper Training — MaintainPro

**UAT phase:** UAT-023  
**Role:** `INVENTORY_KEEPER` (Store Keeper)  
**Duration:** 2 hours classroom + 45 minutes hands-on  
**Last updated:** 2026-07-02

---

## 1. Role overview

Store keepers manage stock visibility, approve operational part requests, issue and receive parts against work orders, and perform operational purchase order approval. **No work order = No parts issue** — the system enforces this per [anti-fraud-policy.md](../anti-fraud-policy.md).

---

## 2. What you CAN do

| Action | Route / area |
|--------|--------------|
| View dashboard and store queues | `/action-center` · Waiting parts |
| View inventory and stock levels | `/inventory` |
| Update stock / movements (issue, return) | Inventory → Movements |
| View work orders (context for parts) | `/work-orders` read-only |
| Approve part requests (operational) | Part requests queue |
| Issue parts to work orders | `part_requests.issue` |
| Confirm part returns | Return confirmation |
| Approve purchase orders (operational) | PO operational approval |
| View inventory reports | `/reports` (inventory subset) |
| Export inventory reports | Where enabled |

---

## 3. What you CANNOT do

| Blocked action | Why |
|----------------|-----|
| Issue parts without approved request + WO | Fraud control |
| Approve your own part request | Maker-checker |
| Finance approve POs | `purchase_orders.approve_finance` |
| Create purchase orders (unless also ASSET_MANAGER) | Typically asset manager |
| Create work orders | Not store function |
| Negative stock (system blocks) | Inventory governance |
| Delete stock adjustments without audit | Admin only |
| Emergency issue without reason | Requires manager override + audit |

---

## 4. Daily workflow

### Opening

1. Log in → **Action Center** → **Waiting Parts** queue.
2. Review pending part requests sorted by priority/WO urgency.

[Screenshot: Waiting parts queue]

### Part request processing

3. Open part request → verify WO is active and quantities reasonable.
4. **Operational approve** if valid (you cannot be the requester).
5. **Issue** parts — stock movement links to WO.
6. Hand parts to technician; confirm issue recorded.

[Screenshot: Part request approve and issue]

### Returns

7. When technician returns unused parts: process **return** in system.
8. Confirm quantity matches physical stock.

[Screenshot: Part return confirmation]

### Purchase orders

9. Review POs needing **operational approval** (not finance).
10. Approve only with valid business justification.

### Closing

11. Reconcile high-movement items; flag discrepancies to manager.
12. Never issue for "verbal" requests — WO + approved request only.

---

## 5. Common mistakes

| Mistake | Correct approach |
|---------|------------------|
| Issuing on verbal request | Wait for system approval |
| Approving request you created | Escalate to another approver |
| Wrong WO linked | Verify asset/tag on WO |
| Skipping return entry | Physical stock will not match system |
| Direct `addPart` override without reason | Emergency only — manager reason |
| Issuing when stock shows zero | Investigate; no negative stock |

---

## 6. Escalation

| Situation | Escalate to |
|-----------|-------------|
| Emergency breakdown — no WO yet | Manager to create WO first |
| Duplicate part request | Manager / system flag |
| Stock discrepancy | Manager + inventory audit |
| Finance PO stuck | Finance approver |
| System blocks valid issue | Admin P1 with WO ID |

Reference: [parts-issue-return-sop.md](../sop/parts-issue-return-sop.md)

---

## 7. Support contacts

| Level | Contact |
|-------|---------|
| Maintenance Manager | **TBD** |
| Backup store keeper | **TBD** |
| MaintainPro admin | **TBD** |

---

## 8. Related SOPs

- [parts-issue-return-sop.md](../sop/parts-issue-return-sop.md)
- [work-order-create-sop.md](../sop/work-order-create-sop.md) (why WO must exist first)

---

## 9. Training sign-off

| Field | Value |
|-------|-------|
| Trainee name | |
| Employee ID | |
| Training date | |
| Trainer | |
| Practice issue/return completed | ☐ Yes |

| Trainee signature | Date |
|-------------------|------|
| | |

| Trainer signature | Date |
|-------------------|------|
| | |

**Policy acknowledged:** I will not issue official stock without a valid work order and approved request in MaintainPro.
