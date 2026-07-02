# SOP: Change Request

**Document ID:** SOP-CHG-001  
**UAT phase:** UAT-023  
**Last updated:** 2026-07-02

---

## Purpose

Control changes to MaintainPro configuration, features, and production environment during and after pilot — preventing unauthorized drift and ensuring rollback capability.

## Responsible role

**Requester:** Any business or IT stakeholder  
**Assessment:** Product Owner + Engineering lead  
**Execution:** DevOps (env/deploy), Engineering (code), DBA (schema)

## Prerequisites

- Documented business need
- Pilot impact assessed
- Not a duplicate of in-flight UAT item

---

## Steps

| Step | Action | Route / system |
|------|--------|----------------|
| 1 | Submit change request | [change-request-process.md](../developer-protection/change-request-process.md) form |
| 2 | Classify: **Standard / Normal / Emergency** | CR template |
| 3 | Product prioritizes vs pilot stability | Backlog review |
| 4 | Engineering estimates risk, test plan | Technical review |
| 5 | Security reviews if RBAC, data, or secrets | Security sign-off |
| 6 | **Pilot change freeze:** only P0 emergency during pilot week 1 | [pilot-rollout-plan.md](../pilot-rollout-plan.md) |
| 7 | Implement on staging first | Staging URLs |
| 8 | Run regression: `uat:021:validate` or scoped tests | CI |
| 9 | Update docs if RBAC/routes change | `permission-matrix.md`, training |
| 10 | Deploy to production in approved window | [cutover-plan.md](../cutover-plan.md) / deploy checklist |
| 11 | Post-deploy smoke | [live-monitoring-plan.md](../live-monitoring-plan.md) |
| 12 | Close CR with release notes | [release-notes-template.md](../developer-protection/release-notes-template.md) |

---

## Approval

| Change type | Approver |
|-------------|----------|
| Standard (config, copy) | Product Owner |
| Normal (feature, schema) | Product + Engineering + QA |
| Emergency (P0 fix) | DevOps + Engineering; retroactive PO review 24h |
| Security-related | Security + Admin |
| `FRAUD_CONTROL_ENABLED` toggle | Operations Manager + Security |

---

## Audit trail

Change ticket ID, commit SHA, deploy IDs (Render, Cloudflare), approver names.

---

## Exceptions

| Exception | Handling |
|-----------|----------|
| Hotfix during pilot | Emergency path; notify pilot users |
| Env var only | Secret manager; no git commit of values |
| Schema change on MongoDB | `db:push` with DBA review — no SQL migrations |

---

## What NOT to do

- Do **not** change production env vars without ticket
- Do **not** deploy Friday afternoon without on-call
- Do **not** skip staging for "small" RBAC changes
- Do **not** commit secrets or connection strings to git

---

## Escalation

| Issue | Escalate to |
|-------|-------------|
| CR blocked by freeze | Sponsor exception |
| Failed deploy | [rollback-plan.md](../developer-protection/rollback-plan.md) |
| Schema failure | DBA P0 |

---

## Related documents

- [developer-protection/deployment-checklist.md](../developer-protection/deployment-checklist.md)
- [final-go-live-checklist.md](../final-go-live-checklist.md)
