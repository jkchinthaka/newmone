# Enterprise Production Hardening — Phase 0 Baseline

**Branch:** `fix/enterprise-production-hardening`  
**Baseline date:** 2026-07-17  
**Commit base:** `3279013` (main)  
**Scope:** `maintainpro/` monorepo

This document records an evidence-based baseline before hardening changes. Failures and risks are not concealed.

---

## Commands run

All commands executed from `maintainpro/` unless noted.

| Command | Exit | Result |
|---------|-----:|--------|
| `npm ci` | 0 | 1912 packages installed; deprecation warnings present |
| `npm run db:generate` | 0 | Prisma Client v5.22.0 generated |
| `npm run typecheck` | 0 | API + web `tsc --noEmit` passed |
| `npm run lint` | 0 | **Misleading pass** — both workspaces alias `lint` → `typecheck` |
| `npm run test` | 0 | **127** suites / **835** tests passed |
| `npm run build` | 0 | shared-types → ui-components → api → web (Next.js 14.2.35) passed |
| `npm audit` | 1 | **65** vulnerabilities (8 low, 38 moderate, 15 high, 4 critical) |

Raw logs (repo parent, ephemeral): `baseline-npm-ci.log`, `baseline-typecheck.log`, `baseline-lint.log`, `baseline-test.log`, `baseline-build.log`, `baseline-npm-audit.log`, `baseline-npm-audit.json`.

Playwright / staging UAT suites were **not** executed in this baseline run (require staging credentials and live environments). Existing e2e specs live under `apps/web/e2e/`.

---

## Known quality gaps (even though green)

### Lint is not real linting

```json
// apps/api/package.json and apps/web/package.json
"lint": "npm run typecheck"
```

No ESLint configuration enforces import order, `any` usage, promise handling, or security patterns. CI that only runs `lint` provides no static analysis beyond TypeScript.

### Root GitHub Actions do not validate PRs

| Location | Workflow | Effect |
|----------|----------|--------|
| `.github/workflows/docker-image.yml` | Docker Image CI | Only `docker build` on push/PR to `main` |
| `maintainpro/.github/workflows/ci.yml` | PR Validation | typecheck + build + test — **not loaded by GitHub** (workflows must live at repo-root `.github/workflows/`) |
| `maintainpro/.github/workflows/docker-build-check.yml` | Docker build check | Same path issue |
| `maintainpro/.github/workflows/develop-staging-deploy.yml` | Staging deploy | Placeholder; same path issue |

**Risk:** Pull requests against this repository can merge without monorepo typecheck/test gates if branch protection only requires the root Docker workflow.

### Dependency vulnerabilities (npm audit summary)

Critical / high notables (non-exhaustive):

| Package | Severity | Notes |
|---------|----------|-------|
| `fast-xml-parser` | critical | Transitive via AWS SDK / OpenNext |
| `shell-quote` | critical | Via `concurrently` |
| `websocket-driver` | critical | Transitive |
| `xlsx` | high | **No fix available** |
| `nodemailer` | high | Fix may require major bump |
| `@opennextjs/cloudflare` | high | SSRF via `/cdn-cgi/` path normalization |
| `next` | multiple | Force-fix path jumps to Next 16 (breaking) |
| `multer` | deprecated 1.x | Known advisory class |

Operator action: schedule dependency upgrades with compatibility testing; do not blindly `npm audit fix --force` on production.

---

## Architecture inspection findings

### 1. Sensitive data exposure (P0)

**Unrestricted User relation includes** (full row including `passwordHash`):

| File | Pattern |
|------|---------|
| `apps/api/src/modules/drivers/drivers.service.ts` | `include: { user: true }` |
| `apps/api/src/modules/vehicles/vehicles.service.ts` | `driver: { include: { user: true } }` / `include: { user: true }` |
| `apps/api/src/modules/work-orders/work-orders.service.ts` | `technician: true`, `createdBy: true` |
| `apps/api/src/modules/inventory/inventory.service.ts` | `technician: true` |
| `apps/api/src/modules/cleaning/cleaning.service.ts` | `cleaner: true` (two mutation paths) |
| `apps/api/src/modules/auth/auth.service.ts` | invite accept `include: { user: true }` (internal; response projected) |

Existing safe projections are **duplicated** (`users.service.ts` `toPublicUserResponse`, inline selects in reports/cleaning/audit). No shared `common/selects` module.

**Audit middleware** (`prisma.service.ts`): copies scalar fields into `beforeData`/`afterData` with size truncation only. `User` is **not** in `AUDIT_SKIP_MODELS`. Password changes can persist `passwordHash` in audit logs.

**Replication** (`replication.utils.ts`): `sanitizeRecordForModel` keeps all scalars — including `passwordHash` on `User`. No data classification for auth tokens / invitations / provider secrets.

### 2. Multi-tenancy fail-open (P0)

- `TenantContextGuard` allows authenticated requests with `tenantId = null` (returns `true`).
- Widespread service pattern: `...(tenantId ? { tenantId } : {})` (~100+ occurrences) — queries become cross-tenant when context is missing.
- Spot tenant-isolation tests exist for users, work-orders, vehicles, utilities, notifications, fleet, trips — not platform-wide.

### 3. Authentication / session (P0/P1)

- Web stores access JWT in `localStorage` (`maintainpro_access_token`) — XSS-readable.
- API already supports HttpOnly cookies + CSRF for refresh/logout; web primarily uses Bearer.
- Login UI trims password: `password: values.password.trim()` in `apps/web/app/(auth)/login/page.tsx`.
- Production CSP includes `'unsafe-eval'` and `'unsafe-inline'` in `script-src` (`apps/web/next.config.mjs`).
- JWT secret validation: missing secret falls back to `"dev-jwt-secret-change-me"` in non-production; no minimum length / access≠refresh enforcement in production Joi.

### 4. RBAC (P1)

`docs/go-live/backend-rbac-audit.md` (generated 2026-07-03):

| Metric | Count |
|--------|------:|
| Total routes | 509 |
| PASS | 485 |
| TODO | **24** |

TODO hotspots: predictive-ai conversations/copilot, auth invite accept / logout, billing subscription + Stripe webhook, notifications cluster, settings profile, tenants invitations/me.

Automated generator: `scripts/generate-backend-rbac-audit.mjs` + `test/security-rbac-audit.spec.ts`.

### 5. Documentation vs implementation drift

- Production readiness / go-live docs under `docs/go-live/` are extensive, but CI path, lint alias, secret redaction, and cookie-only session claims are not matched by code.
- `lint` documented as validation step is effectively typecheck.
- Staging deploy workflow is a placeholder echo.

---

## Risk register (baseline)

| ID | Risk | Severity | Evidence |
|----|------|----------|----------|
| B-01 | `passwordHash` may leak via API includes | Critical | drivers/vehicles/work-orders/inventory/cleaning |
| B-02 | Secrets in AuditLog snapshots | Critical | prisma audit middleware |
| B-03 | Secrets in replication outbox / backup | Critical | replication.utils sanitize |
| B-04 | Tenant queries fail open without tenantId | Critical | TenantContextGuard + spread pattern |
| B-05 | Access token in localStorage + weak CSP | High | auth-storage.ts, next.config.mjs |
| B-06 | Root CI does not run monorepo tests | High | `.github/workflows/` vs nested workflows |
| B-07 | 24 RBAC TODO routes | High | backend-rbac-audit.md |
| B-08 | 65 dependency vulns incl. critical | High | npm audit |
| B-09 | No real ESLint | Medium | package.json lint scripts |
| B-10 | Password trim on login | Medium | login/page.tsx |
| B-11 | E2E heavily mocks/intercepts | Medium | apps/web/e2e patterns |
| B-12 | Production go/no-go docs ahead of code | Medium | docs vs implementation |

---

## Production readiness verdict (baseline)

**NO-GO.**

Builds and unit tests pass, but security isolation, secret handling, CI enforcement, and session posture do not meet the mandatory acceptance criteria in the master hardening prompt. Passing typecheck/build is necessary but not sufficient evidence of production readiness.

---

## Next phases (ordered)

1. **Phase 1** — Public user select, secret-leak tests, audit redaction, replication classification  
2. **Phase 2** — Tenant fail-closed policy + isolation suite  
3. **Phase 5 (partial)** — Move workflows to root; required PR validation  
4. **Phase 3/4** — Cookie sessions, CSP, RBAC TODO closure  
5. Remaining UX/ops/observability phases after P0 security and CI
