# Production Readiness Report

**Branch:** `fix/enterprise-production-hardening`
**Focus of this iteration:** tenant-isolation migration + cross-tenant FK validation + regression gate.

## Verification (this iteration)

| Check | Command | Result |
| --- | --- | --- |
| Prisma client | `npm run db:generate` | PASS |
| Typecheck (api + web) | `npm run typecheck` | PASS |
| Lint (api + web) | `npm run lint` | PASS |
| Unit/integration tests | `npm run test` | PASS — 923/923 (133 suites) |
| Build (shared-types -> ui -> api -> web) | `npm run build` | PASS |
| Tenant fail-open guard | `npm run audit:tenant` | PASS — 0 unapproved, 0 pending tenant-owned (52 approved platform/shared exceptions) |
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

**Tenant-isolation migration: COMPLETE.** Every tenant-owned business module — including all
`farm/*` modules — is fail-closed with cross-tenant FK validation; `npm run audit:tenant` reports 0
unapproved fail-open patterns and 0 pending tenant-owned migrations.

**Overall production verdict: NO-GO.** Tenant isolation is complete, but production readiness is not
certified by this workstream: the `@PlatformScoped()` refactor of super-admin reporting surfaces,
outstanding dependency vulnerabilities, and the broader RBAC / cookie-auth / CSP / CI quality-gate /
infrastructure / backup / observability go-live items remain open. The platform stays **NO-GO** until
those are independently cleared.