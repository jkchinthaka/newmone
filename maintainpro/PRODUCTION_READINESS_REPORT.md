# Production Readiness Report

**Branch:** `fix/enterprise-production-hardening`
**Focus of this iteration:** tenant-isolation migration + cross-tenant FK validation + regression gate.

## Verification (this iteration)

| Check | Command | Result |
| --- | --- | --- |
| Prisma client | `npm run db:generate` | PASS |
| Typecheck (api + web) | `npm run typecheck` | PASS |
| Lint (api + web) | `npm run lint` | PASS |
| Unit/integration tests | `npm run test` | PASS — 873/873 (131 suites) |
| Build (shared-types -> ui -> api -> web) | `npm run build` | PASS |
| Tenant fail-open guard | `npm run audit:tenant` | PASS — 0 unapproved (102 grandfathered: 45 approved, 57 pending) |
| Cross-tenant isolation | `jest cross-tenant-isolation` | PASS — 12/12 |
| FK validation tests | `jest tenant-fk-validation` | PASS — 15/15 |

## Tenant isolation status

- **Migrated to fail-closed (with cross-tenant FK validation on relations):** assets, vehicles,
  fleet, departments, job-codes, **work-orders/\* (incl. parts, assignees, governance, history,
  queues, vendor-repair), inventory & spare parts, users, people, workforce-employees,
  workforce-planning**.
- **Tenant switching:** `TenantContextGuard` now requires an active membership in an active tenant
  for non-super-admins; tenant-less authenticated users get 403; platform scope requires explicit
  `SUPER_ADMIN`.
- **Shared reference data (approved):** work-order-taxonomy (dual tenant/global scope by design).
- **Remaining fail-open (production blockers):** cleaning, utilities, operations, compliance,
  farm/*.
- **Platform/super-admin (approved, decorator refactor pending):** reports/*,
  management-intelligence, post-go-live/*, go-live/pilot-rollout, qa, delivery-readiness.

See `docs/audits/tenant-query-migration-audit.md` for the per-file inventory.

## Regression prevention

- `scripts/audit-tenant-queries.mjs` fails CI on any new fail-open tenant pattern.
- Wired into `.github/workflows/pr-validation.yml` ahead of lint/typecheck/test/build.
- Migrated modules are removed from the exceptions registry, so any reintroduced fail-open literal in
  work-orders/inventory/users/people/workforce fails CI immediately.

## Known limitations / open risks

- 57 fail-open literals remain in unmigrated tenant-owned modules (cleaning, utilities, operations,
  compliance, farm/*); the guard blocks tenantless non-super-admins, but service-level literals are
  not yet fail-closed there.
- Cross-tenant FK validation not yet applied to those remaining modules (facilities, cleaning,
  accidents, fines, ERP relations, farm relations).
- `npm audit` still reports outstanding dependency vulnerabilities (operator-owned, tracked
  separately).

## Verdict

**NO-GO.** Work Orders, Inventory & Spare Parts, and Users/People/Employees are now fail-closed with
cross-tenant FK validation, but critical tenant-owned business modules (cleaning, utilities,
operations, compliance, farm/*) remain fail-open. Tenant isolation is incomplete until those are
migrated.