# SOP: Technician Completion

**Document ID:** SOP-WO-003  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02  
**Policy:** No evidence = No completion (UAT-012).

---

## Purpose

Standardize how technicians record completed work and submit for supervisor verification without closing the work order themselves.

## Responsible role

**Primary:** `TECHNICIAN`, `MECHANIC`  
**Next step owner:** `SUPERVISOR`

## Prerequisites

- WO assigned to technician
- Required parts issued (if applicable) per [parts-issue-return-sop.md](parts-issue-return-sop.md)
- Before evidence captured (when policy requires)

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Open assigned WO | `/work-orders` → My Tasks |
| 2 | Upload **before** evidence (if not done at start) | Evidence tab |
| 3 | Perform repair / maintenance task | Physical work |
| 4 | Upload **after** evidence | Evidence tab |
| 5 | Complete QR scan if prompted | QR verification |
| 6 | Enter completion notes (work done, readings, parts used) | Completion form |
| 7 | Record labor/time if required | Time entry |
| 8 | Set status to **Submit for verification** | Status transition |
| 9 | Confirm WO left supervisor queue | Supervisor notified |

---

## Approval

Technician completion is **not** final approval — supervisor verification required (UAT-009).

---

## Audit trail

Evidence uploads, QR result, status change, `updatedBy`, timestamps. Rejected evidence → `REWORK_REQUIRED`.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| QR mismatch | Stop — supervisor/manager override with reason |
| Cannot upload photo (connectivity) | Note + support ticket; do not claim complete off-system |
| Partial completion | Update status per manager instruction; do not false-complete |

---

## What NOT to do

- Do **not** mark WO **Closed** as technician
- Do **not** skip evidence for "small" jobs when category requires it
- Do **not** complete without parts return if parts unused
- Do **not** delete evidence after upload

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Completion blocked by system | Supervisor → Admin P2 |
| Wrong WO | Manager reassign |
| Safety concern on asset | Stop work — incident SOP |

---

## Related documents

- [supervisor-verification-sop.md](supervisor-verification-sop.md)
- [parts-issue-return-sop.md](parts-issue-return-sop.md)
