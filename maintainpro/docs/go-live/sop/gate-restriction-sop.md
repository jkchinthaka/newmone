# SOP: Gate Restriction

**Document ID:** SOP-GATE-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02

---

## Purpose

Control vehicle gate in/out using MaintainPro block rules (open critical work orders, expired compliance, inspections) and documented override path.

## Responsible role

**Primary:** `SECURITY_OFFICER`  
**Override approval:** `MANAGER`, `OPERATIONS_MANAGER`, `FLEET_MANAGER`, `ADMIN` (`gate.override.approve`)

## Prerequisites

- Vehicle registered in fleet module
- Security officer logged in at gate terminal

---

## Steps — Gate out

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Open gate module | `/fleet/gate` |
| 2 | Enter vehicle identifier | Gate out form |
| 3 | System evaluates blocks | Automatic |
| 4a | If **cleared** → complete gate out | Confirm release |
| 4b | If **blocked** → display reason to driver | Block message |
| 5 | For block: contact maintenance/fleet | Phone/radio |
| 6 | If override justified: manager approves in system with reason | Override workflow |
| 7 | Re-attempt gate out after override | Gate out |
| 8 | Physical barrier opens only after system success | Physical gate |

## Steps — Gate in

| Step | Action | Route / system |
|------|--------|----------------|
| 9 | Record vehicle return | Gate in |
| 10 | Note visible damage — link to incident/WO if needed | Notes / incident SOP |

---

## Approval

Overrides require authorized role + reason (≥ 3 characters) + audit entry in fraud report.

---

## Audit trail

Gate in/out events, block reasons, override actor and reason, timestamps.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Life-safety emergency | Follow emergency protocol; incident log + retroactive WO |
| Visitor vehicle | Use company visitor policy — may be out of module scope |
| System offline | P0 incident — manual log + sync when restored |

---

## What NOT to do

- Do **not** open gate on verbal clearance while screen shows block
- Do **not** ask security to bypass without manager override
- Do **not** skip gate in on return
- Do **not** use paper passes as official release

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| Wrong block (false positive) | Fleet Manager + Manager override |
| Critical WO disputed | Maintenance Manager |
| System down | DevOps P0 |

---

## Related documents

- [admin-override-sop.md](admin-override-sop.md)
- [anti-fraud-policy.md](../anti-fraud-policy.md)
- [incident-reporting-sop.md](incident-reporting-sop.md)
