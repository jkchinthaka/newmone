# Security Officer Training — MaintainPro

**UAT phase:** UAT-023  
**Role:** `SECURITY_OFFICER`  
**Duration:** 60 minutes classroom + 30 minutes hands-on  
**Last updated:** 2026-07-02

---

## 1. Role overview

Security officers process **gate in** and **gate out** for vehicles, view block reasons from open work orders and compliance status, and record movements in MaintainPro. Gate release follows system rules; overrides require authorized manager approval with audit.

---

## 2. What you CAN do

| Action | Route / area |
|--------|--------------|
| View dashboard (fleet/gate focus) | `/` |
| View action center | `/action-center` |
| Gate in / gate out | `/fleet/gate` |
| View vehicles and block status | Fleet / vehicles |
| View work orders (read — block context) | `/work-orders` read-only |
| View fleet map/read (as configured) | Fleet module |

---

## 3. What you CANNOT do

| Blocked action | Why |
|----------------|-----|
| Approve gate override | `gate.override.approve` — Manager |
| Create or edit work orders | Maintenance roles |
| Issue parts | Store keeper |
| Modify vehicle master data | Fleet manager |
| Finance or management reports | Not in role |
| Admin / system health | Admin only |
| Force gate out when system blocks | Physical release without override = policy breach |

---

## 4. Daily workflow

### Shift start

1. Log in → navigate to **Gate** (`/fleet/gate`).
2. Confirm gate terminal/device connectivity.

[Screenshot: Gate in/out screen]

### Vehicle exit (gate out)

3. Enter vehicle identifier (plate / fleet ID).
4. System evaluates: open critical WOs, expired documents, inspection status.
5. If **allowed** → complete gate out in system → physical barrier release.
6. If **blocked** → show driver block reason; contact maintenance manager for override path.

[Screenshot: Gate block reason display]

### Vehicle entry (gate in)

7. Record gate in when vehicle returns.
8. Note visible damage or incidents — report via incident SOP if needed.

### During shift

9. Do not allow exit on verbal clearance — wait for system green or manager-documented override.

---

## 5. Common mistakes

| Mistake | Correct approach |
|---------|------------------|
| Opening gate while screen shows red | Hold vehicle — escalate |
| Skipping gate in record | Always record return |
| Calling manager without WO ID | Capture vehicle ID and screen message |
| Off-system "paper pass" | Invalid — use override workflow |
| Ignoring compliance expiry flags | Block stands until resolved or override |

---

## 6. Escalation

| Situation | Escalate to |
|-----------|-------------|
| Emergency vehicle (ambulance/fire) | Local emergency protocol + incident log |
| Manager override needed | Maintenance Manager / Fleet Manager |
| System down at gate | P0 — [pilot-support-process.md](../pilot-support-process.md); manual log until restored |
| Suspected stolen / wrong vehicle | Security supervisor + police per company policy |

Reference: [gate-restriction-sop.md](../sop/gate-restriction-sop.md)

---

## 7. Support contacts

| Level | Contact |
|-------|---------|
| Gate supervisor | **TBD** |
| Maintenance Manager (override) | **TBD** |
| MaintainPro admin | **TBD** |

---

## 8. Related SOPs

- [gate-restriction-sop.md](../sop/gate-restriction-sop.md)
- [incident-reporting-sop.md](../sop/incident-reporting-sop.md)

---

## 9. Training sign-off

| Field | Value |
|-------|-------|
| Trainee name | |
| Employee ID | |
| Training date | |
| Trainer | |
| Gate in/out exercise | ☐ Yes |

| Trainee signature | Date |
|-------------------|------|
| | |

| Trainer signature | Date |
|-------------------|------|
| | |

**Policy acknowledged:** I will not release vehicles against an active system block without authorized override recorded in MaintainPro.
