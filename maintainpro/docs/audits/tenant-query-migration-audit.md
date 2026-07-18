# Tenant Query Migration Audit

Branch: `fix/enterprise-production-hardening`
Scope: `maintainpro/apps/api/src` (NestJS backend, Prisma/MongoDB)
Static source of truth: `scripts/audit-tenant-queries.mjs` + `scripts/tenant-audit-exceptions.json`

## 1. Enforcement model

Tenant isolation is enforced in three layers:

1. **Boundary guard** — `TenantContextGuard` (`modules/tenancy/tenant-context.guard.ts`) fails closed:
   an authenticated business request that cannot resolve an active tenant is rejected with `403`
   before any service runs. Platform routes must opt out explicitly via `@PlatformScoped()` /
   `@SkipTenantContext()` and require `SUPER_ADMIN`.
2. **Query helper** — `requireTenantId()` / `tenantWhere()` (`common/utils/tenant-scope.util.ts`)
   throw when tenant context is missing, so a business query can never silently drop its tenant filter.
3. **Cross-tenant FK validation** — `assertTenantEntityExists()`, `findTenantEntityOrThrow()`,
   `assertTenantEntitiesExist()` verify that every referenced id belongs to the active tenant and
   return a non-enumerating `NotFoundException`.

A "fail-open" pattern is any query that resolves to an **empty tenant filter** when `tenantId`
is falsy. The four canonical forms are:

```ts
...(tenantId ? { tenantId } : {})   // spread-ternary
tenantId ?? undefined                // nullish-undefined
tenantId || undefined                // or-undefined
tenantId: tenantId ?? null           // nullish-null-assign
```

## 2. Baseline counts

| Metric | Count |
| --- | ---: |
| Fail-open occurrences found (initial) | 152 |
| Occurrences migrated to fail-closed | 20 |
| Occurrences remaining (grandfathered in exceptions) | 132 |
| Files with remaining occurrences | 40 |

The remaining 132 are registered, with an owner and reason, in
`scripts/tenant-audit-exceptions.json`. CI (`npm run audit:tenant`) fails on any **new** fail-open
pattern outside that registry.

## 3. Migrated modules (fail-closed)

| File | Models | Operations | Prior behavior | Status |
| --- | --- | --- | --- | --- |
| `modules/assets/assets.service.ts` | Asset, Department | list, summary, filter-options, get, create, update, delete, restore, bulk, export, validate-tag, department FK | fail-open spread / `?? null` | MIGRATED |
| `modules/vehicles/vehicles.service.ts` | Vehicle, Driver, WorkOrder | list, summary, alerts, get, create, gate-in/out, trip, service-rule, assign-driver | fail-open spread / `?? undefined` | MIGRATED |
| `modules/fleet/fleet.service.ts` | Vehicle | vehicle metadata lookup | fail-open spread | MIGRATED |
| `modules/departments/departments.service.ts` | Department | list, get, create, update, deactivate, uniqueness, parent FK, ancestry | `?? null` (11 sites) | MIGRATED |
| `modules/job-codes/job-codes.service.ts` | JobCode | list, get, create, update, remove, parent FK | `?? null` (7 sites) | MIGRATED |

Cross-tenant FK validation applied in migrated modules:

- asset -> department (tenant-scoped `findFirst`)
- asset tag lookup scoped to tenant (was global `findUnique` -> cross-tenant enumeration leak)
- vehicle -> driver (`assignDriver` tenant-scoped)
- job-code -> parent job-code (tenant-scoped)
- department -> parent department (tenant-scoped)

## 4. Remaining modules (documented exceptions, NOT production-clean)

Each file below still contains fail-open literals and is listed in the exceptions registry.
`scope` explains why it is currently tolerated; `status` distinguishes intentional platform
behavior from outstanding debt.

### 4a. Platform / super-admin cross-tenant (scope: platform-super-admin, status: APPROVED)

These throw for non-`SUPER_ADMIN` via their own guard, so the ternary only relaxes scope for an
authenticated super admin with an explicit active tenant. Pending refactor to an explicit
platform-scope decorator.

- `modules/reports/reports.service.ts` (9)
- `modules/reports/maintenance-reports.service.ts` (1)
- `modules/management-intelligence/management-intelligence.service.ts` (1)
- `modules/post-go-live/releases.service.ts` (8)
- `modules/post-go-live/change-requests.service.ts` (6)
- `modules/post-go-live/hypercare.service.ts` (6)
- `modules/post-go-live/training.service.ts` (4)
- `modules/post-go-live/support-tickets.service.ts` (1)
- `modules/go-live/pilot-rollout.service.ts` (2)
- `modules/qa/qa-issues.service.ts` (3)
- `modules/delivery-readiness/delivery-readiness.service.ts` (1)

### 4b. Actor-guard-protected, pending migration (scope: actor-guard-protected, status: PENDING-MIGRATION)

Actor-based services. `TenantContextGuard` forces a resolvable tenant for non-super-admins before
these run, so normal-user paths are fail-closed at the boundary; the literal remains for super-admin
cross-tenant/internal calls. Scheduled for `requireTenantId()` migration.

- `modules/work-orders/work-orders.service.ts` (4)
- `modules/work-orders/work-order-parts.service.ts` (1)
- `modules/work-orders/work-order-assignees.service.ts` (1)
- `modules/work-orders/work-order-governance.service.ts` (1)
- `modules/work-orders/work-order-history.service.ts` (1)
- `modules/work-orders/work-order-queues.service.ts` (2)
- `modules/work-orders/vendor-repair.service.ts` (1)
- `modules/work-order-taxonomy/work-order-taxonomy.service.ts` (10)
- `modules/inventory/inventory.service.ts` (1)
- `modules/users/users.service.ts` (2)

### 4c. Tenant-owned business, pending migration (scope: tenant-owned-business, status: PENDING-MIGRATION) — PRODUCTION BLOCKERS

Tenant-owned business modules not yet converted to `requireTenantId()`. Guard enforces tenant
presence at the HTTP boundary, but explicit fail-closed migration is still required. These keep the
verdict at NO-GO.

- `modules/cleaning/cleaning.service.ts` (19)
- `modules/utilities/utilities.service.ts` (11)
- `modules/people/people.service.ts` (10)
- `modules/operations/operations.service.ts` (4)
- `modules/workforce/workforce-employees.service.ts` (4)
- `modules/workforce/workforce-planning.service.ts` (1)
- `modules/compliance/compliance.service.ts` (1)
- `modules/auth/auth.service.ts` (1)
- `modules/farm/*` (14 across crops, farm-finance, farm-workers, fields, harvest, irrigation, livestock, soil-tests, spray-logs, traceability, weather)

## 5. Risk assessment

| Layer | Residual risk |
| --- | --- |
| List / read endpoints on remaining modules | Low-Medium — guard blocks tenantless non-super-admins; risk is a null-tenant / super-admin cross-tenant read |
| Create with `tenantId ?? null/undefined` | Medium — could persist a null-tenant record if reached without context |
| Relation writes without FK validation | High where present — frontend-supplied ids for cross-module relations are not all tenant-verified yet |

## 6. Regression prevention

- `npm run audit:tenant` scans the whole API tree for the four fail-open forms.
- New matches outside `scripts/tenant-audit-exceptions.json` fail the job.
- The job runs in `.github/workflows/pr-validation.yml` before lint/typecheck/test/build.
- Every exception entry requires `file`, `scope`, `owner`, `status`, `reason`
  (schema: `scripts/tenant-audit-exceptions.schema.json`).

## 7. Verdict

**NO-GO.** Critical tenant-owned business modules (cleaning, utilities, people, operations,
workforce, compliance, farm) remain fail-open, and cross-tenant FK validation is only applied to the
migrated modules. Tenant isolation is NOT complete.