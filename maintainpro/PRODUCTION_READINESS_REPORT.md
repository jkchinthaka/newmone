# Production Readiness Report

**Branch:** `fix/enterprise-production-hardening`
**Focus of this iteration:** RBAC / platform-scope / authorization hardening (builds on completed tenant-isolation migration).

## Verification (this iteration)

| Check | Command | Result |
| --- | --- | --- |
| Prisma client | `npm run db:generate` | PASS |
| Typecheck (api + web) | `npm run typecheck` | PASS |
| Lint (api + web) | `npm run lint` | PASS |
| Unit/integration tests | `npm run test` | PASS — 929/929 (134 suites) |
| Build (shared-types -> ui -> api -> web) | `npm run build` | PASS |
| Tenant fail-open guard | `npm run audit:tenant` | PASS — 0 unapproved, 0 pending tenant-owned (12 approved platform/shared exceptions) |
| RBAC / authorization guard | `npm run audit:rbac` | PASS — 641 routes, 0 unscoped, 0 high-risk TODO, 0 exceptions |
| Authorization tests | `jest rbac-authorization` | PASS — 6/6 |
| Farm cross-tenant isolation | `jest farm-cross-tenant-isolation` | PASS — 29/29 |
| Operational cross-tenant isolation | `jest operational-cross-tenant-isolation` | PASS — 21/21 |
| Cross-tenant isolation | `jest cross-tenant-isolation` | PASS — 12/12 |
| FK validation tests | `jest tenant-fk-validation` | PASS — 15/15 |
| Targeted tenant/farm/rbac/sensitive suites | `jest "tenant|farm|rbac|sensitive-data|navigation"` | PASS — 155/155 (17 suites) |

## Tenant isolation status

- **Tenant-isolation migration: COMPLETE.** Migrated to fail-closed (with cross-tenant FK validation
  on relations): assets, vehicles, fleet, departments, job-codes, work-orders/\* (incl. parts,
  assignees, governance, history, queues, vendor-repair), inventory & spare parts, users, people,
  workforce-employees, workforce-planning, cleaning, utilities, operations, compliance, accidents,
  insurance-claims, traffic-fines, vehicle-documents, and **all `farm/*` modules** (crops, fields,
  harvest, irrigation, livestock, soil-tests, spray-logs, farm-workers, farm-finance, traceability,
  weather).
- **Farm hardening specifics:** client-supplied `tenantId` (query/body) removed, IDOR closed
  (get/update/delete now tenant-scoped), farm-graph FKs validated, traceability batch graph isolated,
  weather provider poll restricted to `SUPER_ADMIN` (`@PlatformScoped()`). See
  `docs/security/farm-tenant-isolation.md`.
- **Tenant switching:** `TenantContextGuard` requires an active membership in an active tenant for
  non-super-admins; tenant-less authenticated users get 403; platform scope requires explicit
  `SUPER_ADMIN`.
- **Shared reference data (approved):** work-order-taxonomy (dual tenant/global scope by design).
- **Remaining fail-open:** none in tenant-owned modules.
- **Platform/super-admin (approved, decorator refactor pending):** reports/*,
  management-intelligence, post-go-live/*, go-live/pilot-rollout, qa, delivery-readiness.

See `docs/audits/tenant-query-migration-audit.md` for the per-file inventory.

## Authorization (RBAC / platform-scope) status

- **Explicit route scope: COMPLETE.** All 641 API routes (including farm inline
  controllers) carry an explicit authorization scope. `npm run audit:rbac` reports
  0 unscoped routes, 0 high-risk TODO, 0 exceptions. Distribution: 12 public,
  1 public-webhook, 33 self-service, 593 tenant, 2 platform.
- **Legacy "24 TODO" routes resolved.** They were mostly false positives from a
  buggy generator (decorators above `@Get/@Post` were not scanned). The new
  scanner (`scripts/audit-rbac.mjs`) associates all handler decorators; the 3
  genuinely unscoped routes (`/auth/me`, `/auth/logout-all`, `/entitlements/me`)
  are now `@SelfService()`.
- **New scope primitives:** `@SelfService()` (own-resource routes) and
  `@PublicWebhook(provider)` (signature-authenticated webhooks), plus explicit
  `@TenantScoped()` / `@PlatformScoped()` markers.
- **Stripe webhook hardened:** signature verification is mandatory in live mode;
  a missing `STRIPE_WEBHOOK_SECRET` now fails closed instead of trusting an
  unsigned payload. Event-type allowlist and tenant-from-customer mapping retained.
- **Platform routes require SUPER_ADMIN:** `GET /admin/replication/status` is now
  `@PlatformScoped()` + `@Roles('SUPER_ADMIN')`; CI fails any `@PlatformScoped()`
  route missing SUPER_ADMIN.
- **CI regression gate:** `npm run audit:rbac` runs in `pr-validation.yml` and
  fails on unscoped routes, platform routes without SUPER_ADMIN, and public
  webhooks without a signature marker. Exceptions require a reviewed, expiring
  entry in `scripts/rbac-audit-exceptions.json` (currently 0).
- **Object-level authorization:** existing per-module controls (work-order status,
  inventory maker-checker, gate override, compliance verification, evidence
  governance) remain in force. See `docs/security/authorization-model.md`.

See `docs/audits/rbac-platform-scope-migration.md`,
`docs/security/authorization-model.md`, `docs/security/platform-scope-policy.md`
and `docs/security/export-and-bulk-action-policy.md`.

## Regression prevention

- `scripts/audit-tenant-queries.mjs` fails CI on any new fail-open tenant pattern.
- Wired into `.github/workflows/pr-validation.yml` ahead of lint/typecheck/test/build.
- All migrated modules (including every farm module) are removed from the exceptions registry, so any
  reintroduced fail-open literal in a tenant-owned module fails CI immediately.

## Known limitations / open risks

- Non-farm platform/super-admin reporting surfaces still carry fail-open literals gated only by their
  `SUPER_ADMIN` guards (APPROVED exceptions pending a `@PlatformScoped()` refactor — defense-in-depth,
  not a tenant-user data leak).
- Some loose farm ObjectId fields not modelled as Prisma relations (`operatorId`, `pumpAssetId`,
  `equipmentAssetId`, `harvestedById`, `markedById`, farm-worker `userId`) reference User/Asset
  outside the farm graph and are not tenant-validated on write; documented in
  `docs/security/farm-tenant-isolation.md`.
- Compliance/utilities schemas do not model the full FK set named in the hardening spec; only FKs
  present in the Prisma schema were validated.
- `npm audit` still reports outstanding dependency vulnerabilities (operator-owned, tracked
  separately).

## Verdict

**Tenant-isolation verdict: COMPLETE.** Every tenant-owned business module — including all
`farm/*` modules — is fail-closed with cross-tenant FK validation; `npm run audit:tenant` reports 0
unapproved fail-open patterns and 0 pending tenant-owned migrations.

**Authorization verdict: route-scope hardening COMPLETE; deeper work remaining.** Every non-public
route has an explicit scope, platform routes require SUPER_ADMIN, public webhooks validate signatures,
and CI (`npm run audit:rbac`) blocks authorization regressions. Still open before authorization can be
declared fully complete: (a) split the cross-tenant reporting services into explicit fail-closed
tenant + `@PlatformScoped()` platform paths so their tenant-audit exceptions can be removed; (b) a full
separation-of-duties object-level test matrix across every module; (c) explicit replay/idempotency on
the Stripe webhook; (d) a documented, DB-enforced capability→role permission model migration.

**Overall production verdict: NO-GO.** Tenant isolation and route-level authorization scope are in
place, but production readiness is not certified by this workstream: the remaining authorization items
above, cookie-only authentication, CSP, outstanding dependency vulnerabilities, backup/restore,
observability, and production infrastructure go-live items remain open. The platform stays **NO-GO**
until those are independently cleared.