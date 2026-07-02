# Responsibility Matrix (RACI) — MaintainPro Go-Live

**Document owner:** Product  
**UAT phase:** UAT-022  
**Last updated:** 2026-07-02

**Legend:** **R** = Responsible (does the work) · **A** = Accountable (final decision) · **C** = Consulted · **I** = Informed

---

## Go-live programme

| Activity | Product Owner | DevOps | QA Lead | Backend Lead | Security | Operations Mgr | Finance |
|----------|:-------------:|:------:|:-------:|:------------:|:--------:|:--------------:|:-------:|
| Go/no-go decision | **A** | C | C | C | C | C | I |
| UAT phase sign-off | **A** | I | **R** | C | C | C | I |
| Production readiness checklist | C | **R** | **R** | C | C | I | I |
| Change request approval | **A** | **R** | C | C | C | I | I |
| Stakeholder communications | **A** | C | I | I | I | **R** | I |
| Pilot rollout scope | **A** | I | C | I | I | **R** | C |

---

## Deployment & infrastructure

| Activity | Product Owner | DevOps | QA Lead | Backend Lead | Security | Operations Mgr | Finance |
|----------|:-------------:|:------:|:-------:|:------------:|:--------:|:--------------:|:-------:|
| DNS cutover (`maintenance.nelna.lk`) | I | **A/R** | C | I | C | I | I |
| Render API deploy | I | **A/R** | C | C | C | I | I |
| Cloudflare Workers deploy | I | **A/R** | C | I | C | I | I |
| Production env vars | I | **A/R** | I | C | **C** | I | I |
| MongoDB Atlas provisioning | I | **A/R** | I | C | C | I | I |
| Pre-cutover snapshot | I | **A/R** | I | I | I | I | I |
| Schema push (`db:push`) | I | **R** | I | **A** | I | I | I |
| Backup/replication config | I | **A/R** | I | C | I | I | I |
| Rollback execution | C | **A/R** | C | C | C | I | I |

---

## Application & security

| Activity | Product Owner | DevOps | QA Lead | Backend Lead | Security | Operations Mgr | Finance |
|----------|:-------------:|:------:|:-------:|:------------:|:--------:|:--------------:|:-------:|
| RBAC / permission matrix | C | I | C | **R** | **A** | C | I |
| Backend RBAC audit (UAT-022) | I | I | C | **A/R** | **C** | I | I |
| Fraud control policy enforcement | C | I | C | **R** | C | **A** | C |
| Audit trail standard | I | I | C | **R** | **A** | C | C |
| JWT / auth configuration | I | **R** | I | C | **A** | I | I |
| Integration credentials (SMTP, storage) | C | **R** | C | C | **A** | I | I |
| Security incident response | I | **R** | I | C | **A** | C | I |

---

## Testing & validation

| Activity | Product Owner | DevOps | QA Lead | Backend Lead | Security | Operations Mgr | Finance |
|----------|:-------------:|:------:|:-------:|:------------:|:--------:|:--------------:|:-------:|
| `uat:0XX:validate` execution | I | C | **A/R** | C | I | I | I |
| Post-deploy smoke (prod) | I | C | **A/R** | I | I | I | I |
| Multi-role manual UAT | C | I | **R** | I | C | **C** | C |
| Regression (UAT-007–021) | I | I | **A/R** | C | I | I | I |
| Performance / load (UAT-019) | I | C | **R** | **C** | I | I | I |

---

## Operations & support

| Activity | Product Owner | DevOps | QA Lead | Backend Lead | Security | Operations Mgr | Finance |
|----------|:-------------:|:------:|:-------:|:------------:|:--------:|:--------------:|:-------:|
| Incident commander (P0) | C | **R** | C | C | C | C | I |
| Incident log completion | I | **R** | C | C | C | I | I |
| Fraud override review (weekly) | I | I | I | C | C | **A/R** | **C** |
| User training (pilot) | **A** | I | **R** | I | I | **R** | I |
| Release notes publication | **A** | I | C | C | I | I | I |
| Known limitations review | **A** | C | C | **R** | C | C | I |

---

## Finance-specific

| Activity | Product Owner | DevOps | QA Lead | Backend Lead | Security | Operations Mgr | Finance |
|----------|:-------------:|:------:|:-------:|:------------:|:--------:|:--------------:|:-------:|
| PO finance approval workflow | C | I | C | **R** | I | C | **A** |
| `purchase_orders.approve_finance` role mapping | I | I | C | **R** | C | I | **A** |
| Management intelligence reports | C | I | C | **R** | I | C | **A** |
| Vendor invoice controls (UAT-013) | C | I | C | **R** | C | C | **A** |

---

## Document ownership

| Document | Accountable | Responsible |
|----------|-------------|-------------|
| [permission-matrix.md](../permission-matrix.md) | Security | Backend Lead |
| [uat-index.md](../uat-index.md) | Product Owner | QA Lead |
| [deployment-checklist.md](deployment-checklist.md) | DevOps | DevOps |
| [rollback-plan.md](rollback-plan.md) | DevOps | DevOps on-call |
| [backup-restore-plan.md](backup-restore-plan.md) | DevOps | DBA/DevOps |
| [incident-response-sop.md](incident-response-sop.md) | DevOps | DevOps on-call |
| [known-limitations.md](known-limitations.md) | Product Owner | Backend Lead |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Product Owner | QA + DevOps |

---

## Escalation path

```
User report → Support → QA/DevOps triage → Incident commander
                              ↓
                    P0: DevOps + Security + Product Owner
                    P1: DevOps + Backend on-call
                    P2: Engineering backlog
```

---

## Related documents

- [PILOT_ROLLOUT_PLAN.md](../../PILOT_ROLLOUT_PLAN.md)
- [PRODUCTION_GO_LIVE_DECISION_PACK.md](../../PRODUCTION_GO_LIVE_DECISION_PACK.md)
- [change-request-process.md](change-request-process.md)
