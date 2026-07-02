# SOP: Work Order Assignment

**Document ID:** SOP-WO-002  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02

---

## Purpose

Assign qualified technicians to work orders with capacity and leave checks (UAT-007) so work is distributed fairly and traceably.

## Responsible role

**Primary:** `MANAGER`, `OPERATIONS_MANAGER`, `ADMIN`  
**Consulted:** `SUPERVISOR` (floor capacity)

## Prerequisites

- Work order exists in **Open** or assignable status
- At least one assignable technician in workforce module

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Open work order from queue or list | `/work-orders` → detail |
| 2 | Review skill/designation match (UAT-007) | Assignment panel |
| 3 | Check technician workload and leave | Workforce / assignment preview |
| 4 | Select one or more assignees (multi-assignee supported) | Assign dialog |
| 5 | Set scheduled date/time if applicable | Form |
| 6 | Save assignment — notify technician | System notification |
| 7 | Confirm WO appears in technician **My Tasks** | `/action-center` (tech view) |

---

## Approval

Reassignment of in-progress WO: manager discretion; document reason in notes if dispute.

---

## Audit trail

Assignment events: `assignedTo`, `assignedBy`, timestamp. Bulk assign (UAT-019) logs each WO.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| No available technician | Escalate overtime or vendor repair SOP |
| Technician on leave | System warning — choose alternate |
| Multi-shift job | Multiple assignees or handoff notes |

---

## What NOT to do

- Do **not** verbally assign without system record
- Do **not** assign technician without viewing open workload
- Do **not** assign unqualified staff to high-risk assets (override needs reason)

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Workforce data missing | Admin |
| Assignment API error | Support P1 |
| Union / HR dispute on assignment | Operations Manager |

---

## Related documents

- [work-order-create-sop.md](work-order-create-sop.md)
- [technician-completion-sop.md](technician-completion-sop.md)
