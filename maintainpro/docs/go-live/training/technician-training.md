# Technician Training — MaintainPro

**UAT phase:** UAT-023  
**Role:** `TECHNICIAN` (includes `MECHANIC` where assigned)  
**Duration:** 90 minutes classroom + 30 minutes hands-on  
**Last updated:** 2026-07-02

---

## 1. Role overview

Technicians execute assigned maintenance work in MaintainPro. You update work order status, attach evidence, request parts, and submit completion for supervisor verification. **No system record = No official company action** — do not complete official repairs or take parts without a work order in the system.

---

## 2. What you CAN do

| Action | Route / area |
|--------|--------------|
| View dashboard and personal widgets | `/` · `/action-center` |
| View **your** assigned work orders | `/work-orders` (My Tasks queue) |
| Update status on assigned WOs | WO detail → Status |
| Upload before/after evidence | WO detail → Evidence tab |
| Add completion notes | WO detail → Completion |
| Scan / verify QR codes (when required) | WO detail → QR |
| Create part requests linked to a WO | WO detail → Parts |
| View inventory (read-only context) | `/inventory` |
| View predictive insights (if enabled) | Maintenance insights |
| Receive notifications | Notification inbox |

---

## 3. What you CANNOT do

| Blocked action | Why |
|----------------|-----|
| Create work orders | Role: `work_orders.manage` not assigned |
| Assign yourself or others | Manager/supervisor function |
| Approve your own part requests | Maker-checker (UAT-020) |
| Issue parts from store | `INVENTORY_KEEPER` only |
| Supervisor verification | `SUPERVISOR` / `MANAGER` |
| Approve vendor quotations or invoices | Manager / Finance |
| Access management or fraud reports | `/reports/management-intelligence`, `/reports/fraud-control` |
| Access admin or system health | `/admin`, `/system-health` |
| Delete work orders or evidence after completion | Admin override only |
| Close work orders without verification | Governance (UAT-009) |

---

## 4. Daily workflow

### Start of shift

1. Log in to MaintainPro (company URL — see kick-off pack).
2. Open **Action Center** → review **My Tasks** and **Waiting Evidence**.
3. Prioritize by priority and due date.

[Screenshot: Action Center — technician my tasks queue]

### During work

4. Open the work order from your queue (not from memory).
5. Review asset, location, and safety notes.
6. Upload **before** evidence before starting physical work (when required).
7. If parts needed: create **part request** on the WO — wait for store issue.
8. Perform physical repair.

[Screenshot: Work order detail — evidence upload]

### Completing work

9. Upload **after** evidence and complete QR verification if prompted.
10. Enter completion notes (what was done, parts used, time).
11. Set status to **Pending Supervisor Verification** (or equivalent).
12. Do **not** mark closed yourself.

[Screenshot: Completion form and submit for verification]

### End of shift

13. Check for WOs still in progress — add notes or hand over to supervisor.
14. Report blockers (missing parts, access, system errors) via support channel.

---

## 5. Common mistakes

| Mistake | Correct approach |
|---------|------------------|
| Fixing equipment without a WO | Ask supervisor/manager to create WO first |
| Taking parts from store without approved request | Create part request; wait for issue in system |
| Skipping photos | Completion blocked — upload required evidence |
| Marking job complete without verification | Submit for supervisor verification only |
| Using WhatsApp photos instead of system upload | Attach evidence in WO |
| Working on another technician's WO | Only update **assigned** WOs |
| Ignoring QR mismatch error | Call supervisor — override needs reason + audit |

---

## 6. Escalation

| Situation | Escalate to |
|-----------|-------------|
| Cannot log in | L1 super-user → Admin |
| Part request stuck | Store keeper → Manager |
| Evidence upload fails | Support (P2) — do not skip official record |
| QR will not scan | Supervisor |
| Safety / asset access blocked | Supervisor + Manager immediately |
| System down (P0) | Floor supervisor → [pilot-support-process.md](../pilot-support-process.md) |

---

## 7. Support contacts

| Level | Contact |
|-------|---------|
| Floor super-user (technician) | **TBD** name |
| MaintainPro admin | **TBD** (secret manager) |
| Support channel | **TBD** Teams / email |

Reference: [pilot-support-process.md](../pilot-support-process.md) · SOP: [technician-completion-sop.md](../sop/technician-completion-sop.md)

---

## 8. Related SOPs

- [work-order-assignment-sop.md](../sop/work-order-assignment-sop.md) (how you receive work)
- [technician-completion-sop.md](../sop/technician-completion-sop.md)
- [parts-issue-return-sop.md](../sop/parts-issue-return-sop.md)

---

## 9. Training sign-off

| Field | Value |
|-------|-------|
| Trainee name | |
| Employee ID | |
| Training date | |
| Trainer | |
| Hands-on exercise completed | ☐ Yes — WO ID: ______ |

| Trainee signature | Date |
|-------------------|------|
| | |

| Trainer signature | Date |
|-------------------|------|
| | |

**Policy acknowledged:** I understand that official maintenance work must be recorded in MaintainPro.
