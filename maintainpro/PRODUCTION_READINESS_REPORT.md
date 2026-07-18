# Production Readiness Report

**Branch:** `fix/enterprise-production-hardening`
**Focus of this iteration:** tenant-isolation migration + cross-tenant FK validation + regression gate.

## Verification (this iteration)

| Check | Command | Result |
| --- | --- | --- |
| Prisma client | `npm run db:generate` | PASS |
| Typecheck (api + web) | `npm run typecheck` | PASS |
| Lint (api + web) | `npm run lint` | PASS |
| Unit/integration tests | `npm run test` | PASS — 894/894 (132 suites) |
| Build (shared-types -> ui -> api -> web) | `npm run build` | PASS |
| Tenant fail-open guard | `npm run audit:tenant` | PASS — 0 unapproved (67 approved exceptions) |
| Operational cross-tenant isolation | `jest operational-cross-tenant-isolation` | PASS — 21/21 |
| Cross-tenant isolation | `jest cross-tenant-isolation` | PASS — 12/12 |
| FK validation tests | `jest tenant-fk-validation` | PASS — 15/15 |
| Compliance phase-4 e2e | `jest phase4-compliance` | PASS — 15/15 |

## Tenant isolation status

- **Migrated to fail-closed (with cross-tenant FK validation on relations):** assets, vehicles,
  fleet, departments, job-codes, work-orders/\* (incl. parts, assignees, governance, history,
  queues, vendor-repair), inventory & spare parts, users, people, workforce-employees,
  workforce-planning, **cleaning, utilities, operations, compliance, accidents, insurance-claims,
  traffic-fines, vehicle-documents**.
- **Tenant switching:** `TenantContextGuard` now requires an active membership in an active tenant
  for non-super-admins; tenant-less authenticated users get 403; platform scope requires explicit
  `SUPER_ADMIN`.
- **Shared reference data (approved):** work-order-taxonomy (dual tenant/global scope by design).
- **Remaining fail-open (production blocker):** farm/* only.
- **Platform/super-admin (approved, decorator refactor pending):** reports/*,
  management-intelligence, post-go-live/*, go-live/pilot-rollout, qa, delivery-readiness.

See `docs/audits/tenant-query-migration-audit.md` for the per-file inventory.

## Regression prevention

- `scripts/audit-tenant-queries.mjs` fails CI on any new fail-open tenant pattern.
- Wired into `.github/workflows/pr-validation.yml` ahead of lint/typecheck/test/build.
- Migrated modules are removed from the exceptions registry, so any reintroduced fail-open literal in
  cleaning/utilities/operations/compliance (and prior work-orders/inventory/users/people/workforce)
  fails CI immediately.

## Known limitations / open risks

- 14 fail-open literals remain in the unmigrated **farm/\*** tenant-owned modules; the guard blocks
  tenantless non-super-admins, but service-level literals are not yet fail-closed there.
- Cross-tenant FK validation not yet applied to farm relations.
- Compliance/utilities schemas do not model the full FK set named in the hardening spec (e.g.
  utility supplier/cost-centre/approver; compliance driver/employee/facility beyond the vehicle
  graph). Only the FKs that exist in the Prisma schema were validated; if those relations are added
  later they must be tenant-validated at that time.
- `npm audit` still reports outstanding dependency vulnerabilities (operator-owned, tracked
  separately).

## Verdict

**NO-GO.** Cleaning, Utilities, Operations, Compliance, and the compliance-coupled Accidents /
Insurance claims / Traffic fines / Vehicle documents modules are now fail-closed with cross-tenant
FK validation, joining Work Orders, Inventory & Spare Parts, and Users/People/Employees. The static
audit reports 0 unapproved fail-open patterns. The verdict remains **NO-GO** solely because the
**farm/\*** tenant-owned modules remain fail-open; tenant isolation is incomplete until they are
migrated.