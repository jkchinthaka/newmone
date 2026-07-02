# Deployment Checklist — MaintainPro Production

**UAT phase:** UAT-022  
**Target domain:** `maintenance.nelna.lk`  
**Document owner:** DevOps + QA Lead  
**Last updated:** 2026-07-02

**Do not execute until** Product Owner, DevOps, and QA sign the go/no-go matrix per [PRODUCTION_GO_LIVE_DECISION_PACK.md](../../PRODUCTION_GO_LIVE_DECISION_PACK.md). **Never paste secrets into tickets or this document.**

---

## Before deploy (T-7 to T-1)

### Code & validation

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Confirm release commit on `main` (baseline `d371733` or approved tag) | DevOps | `git log -1` matches change ticket |
| ☐ | Run `npm run uat:021:validate` from `maintainpro/` | QA | All steps PASS |
| ☐ | Run `npm run uat:020:validate` (fraud regression) | QA | All steps PASS |
| ☐ | Regenerate RBAC audit: `node scripts/generate-backend-rbac-audit.mjs` | Backend | Review 24 TODO routes |
| ☐ | Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` | DevOps | Green on release branch |
| ☐ | Review [known-limitations.md](known-limitations.md) — no new P0 unmitigated | Product | Sign-off recorded |
| ☐ | Change request approved per [change-request-process.md](change-request-process.md) | Product | CR ticket linked |

### Infrastructure pre-flight

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Lower DNS TTL on `maintenance.nelna.lk` to ≤300s | DevOps | TTL verified in DNS panel |
| ☐ | Provision **isolated** MongoDB Atlas cluster/database (not staging) | DevOps | Separate cluster name documented |
| ☐ | Configure Atlas backup schedule + retention | DevOps | Policy ID in ticket |
| ☐ | Take pre-cutover Atlas snapshot | DevOps | Snapshot ID recorded |
| ☐ | Create production Render service / env group (no staging secrets) | DevOps | Service ID documented |
| ☐ | Bind Cloudflare Workers custom domain route | DevOps | Route active |
| ☐ | Assign rollback owner; review [rollback-plan.md](rollback-plan.md) | DevOps | Named on-call |
| ☐ | Schedule cutover window + stakeholder comms | Product | Comms sent |

### Environment variables (API — Render)

| ☐ | Variable | Owner | Pass criteria |
|---|----------|-------|---------------|
| ☐ | `NODE_ENV=production` | DevOps | Boot logs show production |
| ☐ | `PRIMARY_DATABASE_URL` / `DATABASE_URL` → prod Atlas | DevOps | Not staging cluster |
| ☐ | `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` (unique) | Security | Not copied from staging |
| ☐ | `CORS_ORIGIN=https://maintenance.nelna.lk` | DevOps | Exact origin match |
| ☐ | `FRONTEND_URL=https://maintenance.nelna.lk` | DevOps | Matches web URL |
| ☐ | `READINESS_API_KEY` | DevOps | In secret manager |
| ☐ | `FRAUD_CONTROL_ENABLED=true` (default) | DevOps | Maker-checker active |
| ☐ | Integration modes honest (evidence, email, SMS, push, ERP) | DevOps | See `.env.example` |
| ☐ | `BACKUP_DATABASE_URL` + replication mode if required | DevOps | Documented in ticket |

### Environment variables (Web — Cloudflare)

| ☐ | Variable | Owner | Pass criteria |
|---|----------|-------|---------------|
| ☐ | `NEXT_PUBLIC_API_URL` → prod API with `/api` suffix | DevOps | Browser network tab correct |
| ☐ | `NEXT_PUBLIC_API_ORIGIN` → prod API origin (no `/api`) | DevOps | CORS preflight succeeds |

### Database

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | `npm run db:generate && npm run db:push` against **prod** URI (operator shell) | DevOps | No schema errors |
| ☐ | **Do not** run default seed on production | DevOps | No staging personas |
| ☐ | `npm run db:backup:verify` (if replication enabled) | DevOps | Lag within policy |
| ☐ | Dry-run resync: `npm run db:backup:resync -- --dry-run` | DevOps | Counts acceptable |

### Security

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Swagger disabled or basic-auth protected | Security | Not publicly enumerable |
| ☐ | Atlas IP allowlist / VPC configured | DevOps | Least-privilege DB user |
| ☐ | Review [permission-matrix.md](../permission-matrix.md) for pilot roles | Security | Role assignments documented |
| ☐ | Production bootstrap via invitation flow only | Product | Real org users |

---

## During deploy (cutover window)

| ☐ | Step | Owner | Pass criteria | Time |
|---|------|-------|---------------|------|
| ☐ | 1. Announce maintenance window to users | Product | Comms sent | T+0 |
| ☐ | 2. Final Atlas snapshot (if not taken in last 24h) | DevOps | Snapshot ID | T+5m |
| ☐ | 3. Apply schema if pending (`db:push` prod) | DevOps | Success | T+10m |
| ☐ | 4. Deploy API to Render (approved commit) | DevOps | Dashboard shows **live** | T+15m |
| ☐ | 5. Wait for API warm-up; check `GET /health` | DevOps | HTTP 200 | T+20m |
| ☐ | 6. Deploy web to Cloudflare Workers | DevOps | Version matches release | T+25m |
| ☐ | 7. Update DNS `maintenance.nelna.lk` if not pre-pointed | DevOps | Resolves to Workers | TTL |
| ☐ | 8. Verify TLS (green lock, HSTS) | DevOps | `curl -I` clean | T+30m |
| ☐ | 9. Admin login on production URL | QA | Auth succeeds | T+35m |
| ☐ | 10. Run post-deploy smoke (see below) | QA | All probes PASS | T+45m |
| ☐ | 11. Go/no-go decision | Product | Sign-off or rollback | T+60m |

**Abort criteria during deploy:** schema push failure, auth-wide 500, data corruption signal → initiate [rollback-plan.md](rollback-plan.md).

---

## After deploy (T+1h to T+7d)

### Immediate (T+1h to T+24h)

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | `npm run smoke:deploy` against **production** URLs | QA | All probes PASS |
| ☐ | Admin `/system-health` — provider panel loads | QA | Evidence/email/SMS/push honest |
| ☐ | `GET /api/health/deployment-readiness` (admin) | DevOps | `overallStatus` not blocked |
| ☐ | CORS preflight from production web origin | DevOps | No browser CORS errors |
| ☐ | Reports CSV export: `GET /api/reports/operations/export?format=csv` | QA | File downloads; export audited |
| ☐ | Multi-role spot check (Manager, Technician, Security, Store Keeper) | QA | Nav matches [permission-matrix.md](../permission-matrix.md) |
| ☐ | Gate flow smoke (security officer) | QA | Block/allow paths work |
| ☐ | Part request → approve → issue chain | QA | Maker-checker enforced |
| ☐ | No secrets in readiness JSON responses | Security | Manual review |
| ☐ | Record deployment in incident/change log | DevOps | Ticket updated |
| ☐ | Announce cutover complete or rollback | Product | Users notified |

### Short-term (T+1d to T+7d)

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | `npm run db:backup:verify` daily | DevOps | Lag within RPO |
| ☐ | Review fraud override report (Reports → Fraud & Control) | Operations | No unexplained spikes |
| ☐ | Monitor Render/Cloudflare/Atlas dashboards | DevOps | No sustained 5xx |
| ☐ | Pilot user feedback triage | Product | Issues logged |
| ☐ | Complete [uat-sign-off-template.md](uat-sign-off-template.md) | QA | Signed |
| ☐ | Publish [release-notes-template.md](release-notes-template.md) | Product | Users informed |
| ☐ | Restore drill (optional P1): verify Atlas snapshot restore procedure | DevOps | Documented RTO |

---

## Post-deploy smoke commands

```bash
# From maintainpro/ with production URLs in env (secret manager)
export SMOKE_API_URL=https://<prod-api>/api
export SMOKE_WEB_URL=https://maintenance.nelna.lk
npm run smoke:deploy
```

---

## Related documents

- [rollback-plan.md](rollback-plan.md)
- [backup-restore-plan.md](backup-restore-plan.md)
- [production-readiness-checklist.md](production-readiness-checklist.md)
- [PRODUCTION_CUTOVER_RUNBOOK.md](../../PRODUCTION_CUTOVER_RUNBOOK.md)
- [PRODUCTION_OPERATOR_CHECKLIST.md](../../PRODUCTION_OPERATOR_CHECKLIST.md)
