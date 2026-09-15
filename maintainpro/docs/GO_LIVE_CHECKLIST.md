# Go-Live Checklist — MaintainPro

**Branch:** `maintainpro/integration-v1`  
**Version:** Phase 14  
**Date:** 2026-09-15  

This is an index checklist. Each section links to the detailed runbook or gate document.

---

## How to use

Work through each section in order. Mark each item ✅ DONE or ❌ BLOCKED with a note. Do not proceed to production until all CRITICAL items are ✅.

---

## Section 1 — Technical / Infrastructure

| # | Item | Priority | Owner | Status | Notes |
|---|------|----------|-------|--------|-------|
| T-01 | `db:push` applied to staging Atlas cluster for Phase 8–13 models | CRITICAL | DBA/Operator | ❌ | Run: `npm run db:push` from `maintainpro/`; verify with `prisma validate` |
| T-02 | `db:generate` run after `db:push` to regenerate Prisma client | CRITICAL | DBA/Operator | ❌ | `npm run db:generate` |
| T-03 | Migration scripts run in dry-run mode and reviewed | CRITICAL | Engineering | ❌ | See `docs/MIGRATION_RUNBOOK.md` |
| T-04 | Migration scripts run with `--apply` after review | CRITICAL | Engineering | ❌ | After dry-run sign-off |
| T-05 | Database backup taken before migration scripts | CRITICAL | Operator | ❌ | See `docs/remediation/BACKUP_AND_RECOVERY_ARCHITECTURE.md` |
| T-06 | Backup/restore drill executed on production clone | CRITICAL | Operator | ❌ | See `docs/remediation/DISASTER_RECOVERY_RUNBOOK.md` |
| T-07 | CI passes on `integration-v1` (typecheck, lint, test, build) | CRITICAL | Engineering | ❌ | `npm run typecheck && npm run test && npm run build` |
| T-08 | HTTPS TLS certificate installed and auto-renewing | CRITICAL | Operator | ❌ | Verify: `curl -I https://<domain>` shows 200 with HSTS header |
| T-09 | Redis production instance provisioned and reachable | HIGH | Operator | ❌ | `REDIS_URL` set in production env |
| T-10 | MongoDB Atlas primary + backup URLs configured | HIGH | Operator | ❌ | `PRIMARY_DATABASE_URL`, `BACKUP_DATABASE_URL` set |
| T-11 | CORS_ORIGIN and FRONTEND_URL set to production domains | HIGH | Engineering | ❌ | No localhost in production config |
| T-12 | MinIO / R2 bucket for evidence storage configured | MEDIUM | Operator | ❌ | Optional; required for photo evidence upload feature |

---

## Section 2 — Integrations

| # | Item | Priority | Owner | Status | Notes |
|---|------|----------|-------|--------|-------|
| I-01 | Bileeta ERP production credentials validated live | CRITICAL | Business/IT | ❌ | See `docs/ERP_INVENTORY_INTEGRATION_PLAN.md`; set `ERP_APPLY_ALLOWLIST` |
| I-02 | ERP dry-run executed against production Bileeta | CRITICAL | Engineering/Business | ❌ | `inventory.erp_dry_run` permission; review output |
| I-03 | SMTP email provider credentials set and test email sent | HIGH | IT | ❌ | `SMTP_*` env vars; `/notifications/readiness` endpoint returns READY |
| I-04 | SMS provider credentials set and test SMS sent | HIGH | IT | ❌ | `SMS_*` env vars; test via readiness endpoint |
| I-05 | Push notification provider configured (if required) | MEDIUM | IT | ❌ | Optional for Phase 14 |

---

## Section 3 — Security

| # | Item | Priority | Owner | Status | Notes |
|---|------|----------|-------|--------|-------|
| S-01 | JWT_SECRET (or ACCESS/REFRESH pair) rotated for production | CRITICAL | Operator | ❌ | See `docs/remediation/CREDENTIAL_ROTATION_PLAN.md` |
| S-02 | MongoDB Atlas password rotated and set in production env | CRITICAL | Operator | ❌ | |
| S-03 | No `.env` or credential files committed to repo | CRITICAL | Engineering | ✅ | Verified — no secrets in any commit |
| S-04 | Swagger UI disabled or guarded in production | HIGH | Engineering | ❌ | Check `swagger-guard.spec.ts` — verify `SWAGGER_ENABLED` not set |
| S-05 | Rate limiting tuned for production traffic levels | HIGH | Operator | ❌ | Default: 100 req/min; adjust via `ThrottlerModule` config |
| S-06 | CSP / security headers verified in production Next.js build | HIGH | Engineering | ❌ | `next.config.mjs` headers; verify with `curl -I` |
| S-07 | Admin user accounts for production tenant created | HIGH | Business/Operator | ❌ | Run `db:seed` or manual setup |
| S-08 | SUPER_ADMIN account password changed from seed default | CRITICAL | Operator | ❌ | Rotate immediately after seed |

---

## Section 4 — Business / Master Data

| # | Item | Priority | Owner | Status | Notes |
|---|------|----------|-------|--------|-------|
| B-01 | PM plan frequency values loaded for Nelna's asset types | CRITICAL | Business Owner | ❌ | Owner-provided values required |
| B-02 | Compliance temperature/pressure limits configured | CRITICAL | Business Owner | ❌ | |
| B-03 | Tenant-specific role hierarchy and permission assignments reviewed | HIGH | Business/Admin | ❌ | Admin Console > Roles |
| B-04 | Asset master data imported / seeded | HIGH | Business | ❌ | Bulk import via `BulkImportModule` |
| B-05 | Vehicle master data imported | HIGH | Business | ❌ | `apps/api/scripts/import-vehicles.ts` |
| B-06 | Supplier / vendor catalogue populated | MEDIUM | Business | ❌ | Admin Console > Suppliers |

---

## Section 5 — UAT / Testing

| # | Item | Priority | Owner | Status | Notes |
|---|------|----------|-------|--------|-------|
| Q-01 | Phase 14 acceptance map: all 29 automated items PASS | CRITICAL | Engineering | ❌ | `npx jest test/phase14-acceptance-map.spec.ts` |
| Q-02 | Phase 14 hardening: 20+ tests PASS | CRITICAL | Engineering | ❌ | `npx jest test/phase14-hardening.spec.ts` |
| Q-03 | Full API test suite passes (no regressions) | CRITICAL | Engineering | ❌ | `npm run test` from `maintainpro/` |
| Q-04 | Manual UAT Runbook scenarios U-01–U-20 completed | HIGH | QA/Business | ❌ | See `docs/UAT_RUNBOOK.md` |
| Q-05 | Responsive layout verified (mobile/tablet/desktop) | HIGH | QA | ❌ | iPhone SE, iPad, 1280px desktop |
| Q-06 | No P0/P1 bugs open | CRITICAL | QA | ❌ | |

---

## Section 6 — Support & Operations Readiness

| # | Item | Priority | Owner | Status | Notes |
|---|------|----------|-------|--------|-------|
| O-01 | Monitoring / alerts configured (e.g. Datadog, UptimeRobot) | HIGH | Operator | ❌ | See `docs/remediation/OBSERVABILITY_AND_OPERATIONS_ARCHITECTURE.md` |
| O-02 | Log retention policy applied | HIGH | Operator | ❌ | See `docs/remediation/LOG_RETENTION_AND_ACCESS_POLICY.md` |
| O-03 | Production deployment runbook reviewed by on-call team | HIGH | Engineering | ❌ | `docs/remediation/PRODUCTION_DEPLOYMENT_RUNBOOK.md` |
| O-04 | Rollback procedure rehearsed | HIGH | Engineering/Operator | ❌ | `docs/remediation/PRODUCTION_ROLLBACK_RUNBOOK.md` |
| O-05 | Helpdesk / support team trained on key workflows | MEDIUM | Business | ❌ | `docs/training/` |
| O-06 | Pilot rollout plan reviewed and approved | MEDIUM | Business | ❌ | `docs/PILOT_ROLLOUT_PLAN.md` |

---

## Gate References

- **Go-Live Gates definition:** `docs/remediation/GO_LIVE_GATES.md`
- **Production deployment:** `docs/remediation/PRODUCTION_DEPLOYMENT_RUNBOOK.md` (also aliased at `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`)
- **Production rollback:** `docs/remediation/PRODUCTION_ROLLBACK_RUNBOOK.md` (also aliased at `docs/ROLLBACK_RUNBOOK.md`)
- **Risk register:** `docs/RISK_REGISTER.md`, `docs/remediation/RISK_REGISTER.md`
- **QA checklist:** `docs/QA_CHECKLIST.md`
- **UAT checklist:** `docs/UAT_CHECKLIST.md`
- **Final cutover:** `docs/FINAL_UAT_AND_CUTOVER_CHECKLIST.md`

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | | | |
| QA Lead | | | |
| Business Owner | | | |
| Operator/DBA | | | |
| Security Officer | | | |
