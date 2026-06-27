# Production Cutover Runbook

**Audience:** DevOps, QA Lead, Product Owner  
**Target domain:** `maintenance.nelna.lk` (not cut over until operator sign-off)  
**Staging reference:** Web `https://newmone.chinthakajayaweera1.workers.dev` · API `https://newmone.onrender.com/api`

Credentials live in secret manager only — never commit `.env` files or paste passwords in tickets.

---

## 1. Pre-deploy checks

| # | Check | Command / action | Pass criteria |
|---|-------|------------------|---------------|
| 1 | Local validation | `npm run uat:005:validate` from `maintainpro/` | All steps PASS |
| 2 | Git state | `git log -1` on intended release commit | Matches approved release tag |
| 3 | Render deploy dry-run | `npm run render:deploy:dry` | Service ID + env keys present (no secrets printed) |
| 4 | Cloudflare build | `npm run cloudflare:build` | Build succeeds |
| 5 | Database schema | `npm run db:generate && npm run db:push` against **prod** URI (operator shell) | Schema applied without error |
| 6 | Backup verify | `npm run db:backup:verify` (if replication enabled) | Lag within policy |
| 7 | Deployment readiness API | Admin `GET /api/health/deployment-readiness` | `overallStatus` not `blocked` for required items |

---

## 2. Environment variable checklist (production)

### Required (API — Render)

| Variable | Production value guidance |
|----------|---------------------------|
| `NODE_ENV` | `production` |
| `PRIMARY_DATABASE_URL` / `DATABASE_URL` | Isolated prod Atlas DB (not staging) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Strong random — unique to prod |
| `CORS_ORIGIN` | `https://maintenance.nelna.lk` |
| `FRONTEND_URL` | `https://maintenance.nelna.lk` |
| `READINESS_API_KEY` | Random key for ops probes |

### Optional integrations (honest modes)

| Integration | Staging default | Production go-live |
|-------------|-----------------|-------------------|
| Evidence storage | `STORAGE_MODE=disabled` or `mock` | `cloudinary` or `minio` + `STORAGE_UPLOADS_ENABLED=true` |
| Email | `EMAIL_MODE=disabled` | `EMAIL_MODE=live` + SMTP_* |
| SMS | `SMS_MODE=disabled` | `SMS_MODE=live` + SMS_* |
| Push | `PUSH_MODE=disabled` or `mock` | `PUSH_MODE=live` + provider URL/key |
| ERP | mock/disabled | sandbox/live per vendor contract |

See `.env.example` and `docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`.

### Web (Cloudflare Workers)

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_API_URL` | `https://<prod-api-host>/api` |
| `NEXT_PUBLIC_API_ORIGIN` | `https://<prod-api-host>` |

---

## 3. Database backup

1. **Before cutover:** Atlas snapshot or `mongodump` of staging if migrating data; prefer **fresh prod DB** for greenfield.
2. **Replication:** If `BACKUP_DATABASE_URL` configured, run `npm run db:backup:resync -- --dry-run` then apply.
3. **Verify:** `npm run db:backup:verify` — document counts/lag in change ticket.
4. **Rollback data:** Restore Atlas snapshot to pre-cutover point (operator-owned, RTO/RPO per policy).

---

## 4. Seed policy

| Environment | Seed? | Notes |
|-------------|-------|-------|
| Staging | Yes | `MAINTAINPRO_SEED_PASSWORD` via Render secret; UAT personas documented |
| Production | **No default seed** | Create real tenants/users via admin invitation flow |
| Production bootstrap | Operator-only | If bootstrap required, use one-time admin invite — do not reuse staging passwords |

---

## 5. Smoke test (post-deploy)

```bash
cd maintainpro
# Set MAINTAINPRO_WEB_URL, MAINTAINPRO_API_URL, MAINTAINPRO_SMOKE_* in shell only
npm run smoke:deploy
npm run uat:005:validate
```

Expected: Frontend OK · API health OK · CORS OK · Login OK · Provider indicators honest.

---

## 6. UAT roles (verification matrix)

| Persona | Email pattern | Verify |
|---------|---------------|--------|
| Admin | `admin@maintainpro.local` (staging) | System health, users, audit |
| Manager | `manager@maintainpro.local` | WO approve, reports export |
| Technician | `tech@maintainpro.local` | Assigned jobs only; no gate/admin |
| Security Officer | `security@maintainpro.local` | `/fleet/gate` only |
| Inventory Keeper | `inventory@maintainpro.local` | Stock/issue flows |

Production: replace with real tenant users after invitation onboarding.

---

## 7. Rollback plan

| Layer | Rollback action | Time estimate |
|-------|-----------------|---------------|
| Web (Cloudflare) | Redeploy previous Workers version from dashboard | 5–15 min |
| API (Render) | Rollback deploy to prior commit in Render dashboard | 5–10 min + warm-up |
| DNS | Revert `maintenance.nelna.lk` CNAME/A to previous target | TTL dependent |
| Database | Restore Atlas snapshot (if schema/data regression) | Operator RTO |

**Trigger rollback if:** auth-wide 401/500, data corruption, critical RBAC bypass, or failed smoke/UAT within 30 min of cutover.

---

## 8. Post-deploy verification

- [ ] `GET /health` returns 200
- [ ] Admin login on production URL
- [ ] `/system-health` shows provider diagnostics (evidence + email/SMS/push indicators)
- [ ] CORS preflight from production web origin
- [ ] Reports CSV export (`/reports/operations/export?format=csv`)
- [ ] No secrets in readiness JSON responses
- [ ] Swagger disabled or basic-auth protected in production

---

## 9. Incident contacts

| Role | Responsibility |
|------|----------------|
| DevOps on-call | Render/Cloudflare/Atlas, env vars, deploy rollback |
| QA Lead | UAT re-run, defect triage |
| Product Owner | Go/no-go, user comms |
| Security | Auth/RBAC incidents, credential rotation |

*(Replace placeholders with org directory before production cutover.)*

---

## 10. Known limitations (post-cutover)

- Access JWT in `localStorage` (XSS mitigated via CSP; cookie-only access roadmap)
- Evidence presigned byte upload may remain metadata-only until provider credentials enabled
- Work order list CSV/PDF export not shipped (reports module export available)
- Mobile Flutter offline parity incomplete
- APM/metrics beyond health/readiness not wired

See `PRODUCTION_READINESS_REPORT.md` and `docs/ENTERPRISE_ROADMAP.md`.

---

## Related documents

- [PRODUCTION_GO_LIVE_DECISION_PACK.md](PRODUCTION_GO_LIVE_DECISION_PACK.md) — UAT-006 management go/no-go pack
- [PRODUCTION_OPERATOR_CHECKLIST.md](PRODUCTION_OPERATOR_CHECKLIST.md) — step-by-step operator tasks
- [PILOT_ROLLOUT_PLAN.md](PILOT_ROLLOUT_PLAN.md) — pilot scope, training, escalation
- [PRODUCTION_DOMAIN_CUTOVER.md](PRODUCTION_DOMAIN_CUTOVER.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [DEPLOYMENT_ENVIRONMENT_CHECKLIST.md](DEPLOYMENT_ENVIRONMENT_CHECKLIST.md)
- [UAT_CHECKLIST.md](UAT_CHECKLIST.md)
- [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md)
