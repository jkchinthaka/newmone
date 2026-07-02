# SOP: Incident Reporting

**Document ID:** SOP-INC-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02

---

## Purpose

Report and track incidents affecting MaintainPro availability, data integrity, security, or safety — distinct from routine support tickets.

## Responsible role

**Reporter:** Any user  
**Coordinator:** MaintainPro `ADMIN` + DevOps  
**Communications:** Operations Manager

## Prerequisites

- Incident observed (outage, breach suspicion, data loss, safety event linked to system gap)

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | **Assess severity** P0–P3 | [pilot-support-process.md](../pilot-support-process.md) |
| 2 | If P0/P1: notify DevOps on-call immediately | Phone / on-call |
| 3 | Create incident record | [incident-log-template.md](../developer-protection/incident-log-template.md) |
| 4 | Preserve evidence — screenshots, WO IDs, times; **no passwords** | Ticket |
| 5 | DevOps triage: health, deploy history, Atlas, Cloudflare | `/system-health`, vendor dashboards |
| 6 | Execute [incident-response-sop.md](../developer-protection/incident-response-sop.md) | War room if P0 |
| 7 | User communication per severity | Broadcast template |
| 8 | Resolution and root cause | Incident log |
| 9 | Post-incident review within 5 business days | PIR meeting |
| 10 | Update known issues in support KB | Admin |

### Safety incidents (maintenance floor)

| Step | Action |
|------|--------|
| A | Follow company safety protocol first (medical, evacuation) |
| B | Create WO or accident record when safe | Accidents module if applicable |
| C | Link incident log to WO ID |

---

## Approval

Production rollback requires Sponsor/Ops Manager per [cutover-plan.md](../cutover-plan.md) and [rollback-plan.md](../developer-protection/rollback-plan.md).

---

## Audit trail

Incident log (separate from WO audit), system audit logs for data changes during incident.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Vendor outage (Atlas, Render, Cloudflare) | L4 vendor ticket + status page |
| False alarm P0 | Downgrade; document in log |

---

## What NOT to do

- Do **not** post credentials in incident channels
- Do **not** delete data to "fix" without DBA approval
- Do **not** skip incident log for P0/P1
- Do **not** perform unofficial work during outage without retroactive WO when restored

---

## Escalation

| Severity | Escalate to |
|----------|-------------|
| P0 | DevOps + Engineering + Ops Manager + Sponsor |
| P1 | DevOps + Engineering lead |
| Security | Security team parallel track |

---

## Related documents

- [pilot-support-process.md](../pilot-support-process.md)
- [change-request-process.md](../developer-protection/change-request-process.md)
