# SOP: Parts Issue & Return

**Document ID:** SOP-INV-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02  
**Policy:** No work order = No parts issue.

---

## Purpose

Control spare parts movement from store to job and back, with maker-checker approvals and negative-stock prevention (UAT-010).

## Responsible role

**Primary:** `INVENTORY_KEEPER`  
**Requester:** `TECHNICIAN`  
**Approvers:** `INVENTORY_KEEPER` (operational), `MANAGER` (finance step when required)

## Prerequisites

- Active work order
- Part request created by technician (not self-approved by requester)

---

## Steps — Issue

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Technician creates part request on WO | WO → Parts → Request |
| 2 | Store reviews **Waiting Parts** queue | `/action-center` |
| 3 | Verify WO valid and quantity reasonable | Part request detail |
| 4 | **Operational approve** (approver ≠ requester) | Approve operational |
| 5 | Finance approve if required (high value) | Manager/finance |
| 6 | **Issue** parts — stock deducted | Issue action |
| 7 | Hand parts to technician; confirm movement ID | Stock movements |

## Steps — Return

| Step | Action | Route / system |
|------|--------|----------------|
| 8 | Technician brings unused parts to store | Physical |
| 9 | Store processes **return** against WO | Return confirmation |
| 10 | Stock updated; link to original issue | Audit trail |

---

## Approval

| Type | Rule |
|------|------|
| Operational | Store keeper or manager; not requester |
| Finance | `purchase_orders.approve_finance` / `part_requests.approve_finance` |
| Emergency direct issue | Manager reason + `addPart` override — audited |

---

## Audit trail

Part request lifecycle, stock movements, approver IDs, override reasons.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Stock zero | Do not negative issue — expedite PO or alternate part |
| Duplicate request | System flags — merge or reject |
| Wrong part issued | Return + correct issue; note on WO |

---

## What NOT to do

- Do **not** issue without approved request
- Do **not** approve your own request
- Do **not** give parts for personal/non-WO use
- Do **not** skip return when job cancelled

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Emergency no WO | Manager creates WO first |
| Suspected theft | Manager + fraud review |
| System stock mismatch | Inventory audit — Admin |

---

## Related documents

- [anti-fraud-policy.md](../anti-fraud-policy.md)
- [work-order-create-sop.md](work-order-create-sop.md)
