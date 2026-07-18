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
| Occurrences migrated to fail-closed | ~50 |
| Occurrences remaining (grandfathered in exceptions) | 102 |
| Files with remaining occurrences | 26 |

The remaining 102 are registered, with an owner and reason, in
`scripts/tenant-audit-exceptions.json`. CI (`npm run audit:tenant`) fails on any **new** fail-open
pattern outside that registry. Of the 102, 45 are APPROVED (platform/super-admin surfaces plus the
dual-scoped work-order taxonomy reference data) and 57 remain PENDING-MIGRATION production blockers.

## 3. Migrated modules (fail-closed)

| File | Models | Operations | Prior behavior | Status |
| --- | --- | --- | --- | --- |
| `modules/assets/assets.service.ts` | Asset, Department | list, summary, filter-options, get, create, update, delete, restore, bulk, export, validate-tag, department FK | fail-open spread / `?? null` | MIGRATED |
| `modules/vehicles/vehicles.service.ts` | Vehicle, Driver, WorkOrder | list, summary, alerts, get, create, gate-in/out, trip, service-rule, assign-driver | fail-open spread / `?? undefined` | MIGRATED |
| `modules/fleet/fleet.service.ts` | Vehicle | vehicle metadata lookup | fail-open spread | MIGRATED |
| `modules/departments/departments.service.ts` | Department | list, get, create, update, deactivate, uniqueness, parent FK, ancestry | `?? null` (11 sites) | MIGRATED |
| `modules/job-codes/job-codes.service.ts` | JobCode | list, get, create, update, remove, parent FK | `?? null` (7 sites) | MIGRATED |
| `modules/work-orders/work-orders.service.ts` (+ `work-order-parts`, `work-order-assignees`, `work-order-governance`, `work-order-history`, `work-order-queues`, `vendor-repair`) | WorkOrder, PartRequest, WorkOrderPart, WorkOrderAssignee, VendorRepairCase/Quotation/Invoice, Supplier | list/queues, get, create, update, part request, assignees, governance, history, vendor repair, status transitions | `resolveTenantId` returned nullable + spread/`?? null`/`?? undefined` | MIGRATED |
| `modules/inventory/inventory.service.ts` | SparePart, Supplier, PurchaseOrder, StockMovement, WorkOrder | list, get, create, update, bulk delete/category, issue-to-WO, purchase orders + approvals | fail-open spread / `?? null` | MIGRATED |
| `modules/users/users.service.ts` | User, Role, TenantMembership | list, admin-access, get, create, invite, update, delete-guard | `?? undefined` (super-admin aware) | MIGRATED |
| `modules/people/people.service.ts` | Employee, Department, Role, User | list, get, create, update, deactivate/reactivate, technician profile, reset/invite | spread-ternary (9) + `?? null` | MIGRATED |
| `modules/workforce/workforce-employees.service.ts`, `workforce-planning.service.ts` | Employee, Department, Role | create/update employee, department FK, role lookup, workload summary | `?? null` / `?? undefined` | MIGRATED |

Cross-tenant FK validation applied in migrated modules:

- asset -> department (tenant-scoped `findFirst`)
- asset tag lookup scoped to tenant (was global `findUnique` -> cross-tenant enumeration leak)
- vehicle -> driver (`assignDriver` tenant-scoped)
- job-code -> parent job-code (tenant-scoped)
- department -> parent department (tenant-scoped)
- work order -> asset, vehicle (`assertTenantEntityExists` on create); spare part, supplier/vendor,
  requester (createdById), assignee employees, work-order/quotation/invoice all tenant-scoped
- inventory spare part -> supplier (`assertTenantEntityExists` on create); purchase order -> supplier;
  issue-to-work-order tenant-scoped
- people/users -> role (global-or-tenant-owned only), department (tenant-scoped on create + update),
  linked user (tenant-scoped)
- tenant switching -> `TenantContextGuard` now requires an **active** membership in an **active**
  tenant for non-super-admins (disabled memberships / inactive tenants denied)

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

### 4b. Shared reference data (scope: shared-reference-data, status: APPROVED)

- `modules/work-order-taxonomy/work-order-taxonomy.service.ts` (10) — taxonomy entries are either
  tenant-owned or global (`tenantId: null`) seed defaults shared across tenants, keyed by a
  `__global__` cache bucket. `tenantId ?? null` selects the correct scope rather than dropping the
  filter. All controller entry points pass the authenticated actor and the guard forces a resolvable
  tenant for non-super-admins, so the global path is unreachable from tenant-user HTTP requests.
  Retained by design, not a tenant-owned data leak.

### 4c. Tenant-owned business, pending migration (scope: tenant-owned-business, status: PENDING-MIGRATION) — PRODUCTION BLOCKERS

Tenant-owned business modules not yet converted to `requireTenantId()`. Guard enforces tenant
presence at the HTTP boundary, but explicit fail-closed migration is still required. These keep the
verdict at NO-GO.

- `modules/cleaning/cleaning.service.ts` (19)
- `modules/utilities/utilities.service.ts` (11)
- `modules/operations/operations.service.ts` (4)
- `modules/compliance/compliance.service.ts` (1)
- `modules/farm/*` (14 across crops, farm-finance, farm-workers, fields, harvest, irrigation, livestock, soil-tests, spray-logs, traceability, weather)

> Migrated out of this list in the current pass: all `work-orders/*`, `inventory`, `users`,
> `people`, `workforce-employees`, `workforce-planning`, and `auth` (the last was an audit-log
> tenant stamp, not a data-access query). These files are no longer in the exceptions registry, so CI
> now blocks any regression that reintroduces a fail-open pattern in them.

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

**NO-GO.** Work Orders, Inventory & Spare Parts, and Users/People/Employees are now fail-closed with
cross-tenant FK validation, and tenant switching is fail-closed at the guard (active membership +
active tenant required). However, critical tenant-owned business modules — **cleaning, utilities,
operations, compliance, and farm/\*** — remain fail-open pending migration. Until those are converted
to `requireTenantId()`/`tenantWhere()` with cross-tenant FK validation, tenant isolation is NOT
complete and the platform stays NO-GO for production.