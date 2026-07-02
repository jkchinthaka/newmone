# Production Readiness Checklist — MaintainPro

**Document owner:** Product + DevOps + QA  
**UAT phase:** UAT-022  
**Last updated:** 2026-07-02  
**Target domain:** `maintenance.nelna.lk`

Use this checklist for **production-ready** verdict (distinct from pilot-ready staging). All **P0** items must pass before cutover.

---

## 1. Application & code quality

| ☐ | Criterion | Priority | Evidence |
|---|-----------|----------|----------|
| ☐ | Release commit approved on `main` | P0 | Change ticket + `git log -1` |
| ☐ | `npm run uat:021:validate` PASS | P0 | Validation log |
| ☐ | `npm run uat:020:validate` PASS | P0 | Fraud regression |
| ☐ | `npm run typecheck` + `lint` + `test` + `build` PASS | P0 | CI or local |
| ☐ | No open P0/P1 defects in release scope | P0 | Defect tracker |
| ☐ | [known-limitations.md](known-limitations.md) reviewed | P1 | Product sign-off |
| ☐ | [backend-rbac-audit.md](../backend-rbac-audit.md) — high-risk routes PASS | P0 | 347+ PASS; TODO documented |

---

## 2. Security & access control

| ☐ | Criterion | Priority | Evidence |
|---|-----------|----------|----------|
| ☐ | JWT secrets unique to production | P0 | Secret manager |
| ☐ | `CORS_ORIGIN` + `FRONTEND_URL` match prod web | P0 | Preflight test |
| ☐ | [permission-matrix.md](../permission-matrix.md) aligned with pilot roles | P0 | Role assignment doc |
| ☐ | No staging seed users in production DB | P0 | DB audit |
| ☐ | Swagger disabled or protected in production | P0 | Manual check |
| ☐ | Atlas least-privilege DB user + IP allowlist | P0 | Atlas console |
| ☐ | `FRAUD_CONTROL_ENABLED=true` | P1 | Env validation |
| ☐ | Audit trail on sensitive actions per [audit-trail-standard.md](../audit-trail-standard.md) | P0 | Spot test |
| ☐ | No secrets in repo or readiness JSON | P0 | `git grep` / manual |

---

## 3. Infrastructure & deployment

| ☐ | Criterion | Priority | Evidence |
|---|-----------|----------|----------|
| ☐ | Isolated production MongoDB Atlas cluster | P0 | Cluster name in ticket |
| ☐ | Production Render service (not staging env reuse) | P0 | Service ID |
| ☐ | Cloudflare Workers custom domain bound | P0 | Dashboard |
| ☐ | DNS `maintenance.nelna.lk` + TLS valid | P0 | `curl -I` |
| ☐ | `NEXT_PUBLIC_API_URL` points to prod API | P0 | Browser network tab |
| ☐ | Redis available (if queues required) | P1 | Health / ops policy |
| ☐ | [deployment-checklist.md](deployment-checklist.md) completed | P0 | Signed CR |
| ☐ | [rollback-plan.md](rollback-plan.md) owner assigned | P0 | On-call roster |

---

## 4. Data & backup

| ☐ | Criterion | Priority | Evidence |
|---|-----------|----------|----------|
| ☐ | Schema applied to prod (`db:push`) | P0 | Deploy log |
| ☐ | Pre-cutover Atlas snapshot taken | P0 | Snapshot ID in ticket |
| ☐ | Atlas backup schedule configured | P0 | Atlas policy |
| ☐ | `npm run db:backup:verify` PASS (if replication) | P1 | Verify log |
| ☐ | [backup-restore-plan.md](backup-restore-plan.md) reviewed | P0 | DevOps sign-off |
| ☐ | Restore drill completed (semi-annual) | P2 | Drill record |

---

## 5. Integrations (honest configuration)

| ☐ | Criterion | Priority | Evidence |
|---|-----------|----------|----------|
| ☐ | Evidence storage: live **or** explicitly disabled with policy | P1 | `/evidence/readiness` |
| ☐ | Email: live **or** disabled (not fake success) | P1 | `/notifications/readiness` |
| ☐ | SMS: live **or** disabled | P2 | Readiness panel |
| ☐ | Push: live **or** disabled/mock honest | P2 | Readiness panel |
| ☐ | ERP: mode documented (mock/sandbox/live) | P2 | System health |
| ☐ | Mock integrations blocked in prod unless override | P0 | `env.validation.ts` |

---

## 6. Operational readiness

| ☐ | Criterion | Priority | Evidence |
|---|-----------|----------|----------|
| ☐ | `GET /health` + deployment-readiness operational | P0 | Smoke |
| ☐ | `/system-health` admin panel functional | P1 | QA screenshot |
| ☐ | `npm run smoke:deploy` PASS on **production** URLs | P0 | Post-cutover log |
| ☐ | [incident-response-sop.md](incident-response-sop.md) distributed | P0 | Team ack |
| ☐ | On-call rotation defined | P0 | Roster |
| ☐ | [change-request-process.md](change-request-process.md) in use | P1 | CR template |
| ☐ | Pilot training complete per [PILOT_ROLLOUT_PLAN.md](../../PILOT_ROLLOUT_PLAN.md) | P1 | Training log |

---

## 7. Business & UAT sign-off

| ☐ | Criterion | Priority | Evidence |
|---|-----------|----------|----------|
| ☐ | UAT-007 through UAT-021 completed or waived | P0 | [uat-index.md](../uat-index.md) |
| ☐ | UAT-022 go-live pack complete | P1 | This folder |
| ☐ | [uat-sign-off-template.md](uat-sign-off-template.md) signed | P0 | QA + PO |
| ☐ | [PRODUCTION_GO_LIVE_DECISION_PACK.md](../../PRODUCTION_GO_LIVE_DECISION_PACK.md) go matrix PASS | P0 | All P0 rows |
| ☐ | Post-cutover user comms prepared | P1 | Comms draft |

---

## Verdict

| ☐ | **Production-ready** — all P0 pass, explicit go/no-go approval |
| ☐ | **Pilot-ready only** — staging certified; production items open |
| ☐ | **Not ready** — blocking items listed below |

### Blocking items

1. 
2. 

---

## Sign-off

| Role | Name | Date | Production-ready? |
|------|------|------|-------------------|
| QA Lead | | | ☐ Yes ☐ No |
| Product Owner | | | ☐ Yes ☐ No |
| DevOps Lead | | | ☐ Yes ☐ No |
| Security | | | ☐ Yes ☐ No |

---

## Related documents

- [PRODUCTION_READINESS_REPORT.md](../../PRODUCTION_READINESS_REPORT.md)
- [PRODUCTION_OPERATOR_CHECKLIST.md](../../PRODUCTION_OPERATOR_CHECKLIST.md)
- [responsibility-matrix.md](responsibility-matrix.md)
