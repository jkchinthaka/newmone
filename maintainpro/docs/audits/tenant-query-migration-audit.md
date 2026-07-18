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
| Occurrences migrated to fail-closed | ~85 |
| Occurrences remaining (grandfathered in exceptions) | 67 |
| Files with remaining occurrences | 12 |

The remaining 67 are registered, with an owner and reason, in
`scripts/tenant-audit-exceptions.json`. CI (`npm run audit:tenant`) fails on any **new** fail-open
pattern outside that registry. All 67 are now APPROVED platform/super-admin surfaces plus the
dual-scoped work-order taxonomy reference data; the remaining PENDING-MIGRATION debt is the
**farm/\*** modules (14 occurrences), which are the last tenant-owned business blockers.

> Current pass migrated Cleaning (19), Utilities (11), Operations (4) and Compliance (1) to
> fail-closed, and additionally hardened the compliance-coupled phase-4 modules (accidents,
> insurance claims, traffic fines, vehicle documents) which used the equivalent `!== undefined`
> fail-open form (not one of the four canonical audit patterns, so never in the registry).

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
| `modules/cleaning/cleaning.service.ts` | CleaningLocation, CleaningVisit, FacilityIssue, Room, User | list cleaners/locations, get/create/update/remove location, QR regen, scan/start visit, submit/reject/sign-off, facility issue create/update, create-WO-from-issue, dashboard, analytics, schedule calendar, schedule enforcement, notifications | `?? undefined` (19) + fail-open `assertTenantAccessOrThrow` + `tenantId ?? location.tenantId` fallback | MIGRATED |
| `modules/utilities/utilities.service.ts` | UtilityMeter, MeterReading, UtilityBill | meters list/get/create/update, readings, bills list/get/create/pay, overdue, analytics | spread-ternary + `?? undefined` (11) | MIGRATED |
| `modules/operations/operations.service.ts` | Asset, Vehicle, Driver, WorkOrder | scan lookup (route-hint + generic resolvers) | spread-ternary (4) | MIGRATED |
| `modules/compliance/compliance.service.ts` | Vehicle, VehicleDocument | evaluate, refresh-and-persist, vehicle compliance, fleet summary, expiring docs, gate-out eval | `!== undefined` fail-open + requestContext fallback | MIGRATED |
| `modules/vehicle-documents/vehicle-documents.service.ts` | VehicleDocument, Vehicle | list, get, create, update, verify, reject, remove, valid-on-date | `!== undefined` fail-open; compliance refresh now passes actor | MIGRATED |
| `modules/accidents/accidents.service.ts` | AccidentReport, AccidentEvidence, Vehicle, Driver, User, WorkOrder | list, get, create, update, add evidence, link work order | `!== undefined` fail-open | MIGRATED |
| `modules/insurance-claims/insurance-claims.service.ts` | InsuranceClaim, AccidentReport, Vehicle | list, get, create, update, update status | `!== undefined` fail-open | MIGRATED |
| `modules/traffic-fines/traffic-fines.service.ts` | TrafficFine, Vehicle, Driver, User, WorkOrder | list, get, create, responsibility, payment, link work order | `!== undefined` fail-open | MIGRATED |

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
- cleaning -> assignable cleaner/supervisor (tenant-scoped `ensureAssignableCleaner`), cleaning
  location (scoped `findFirst` + fail-closed `assertTenantAccessOrThrow`), room
  (`assertActiveRoomForTenant` scoped by `id + tenantId`), scanned QR location (must match caller
  tenant), supervisors notified (tenant-scoped)
- utilities -> meter (bill/reading creation validate meter ownership via tenant-scoped `meter()`)
- operations -> asset/vehicle/driver/work-order scan resolvers all tenant-scoped `findFirst`
- compliance -> vehicle resolved by `id + tenantId`; vehicle documents scoped by tenant; document
  verify/reject/refresh pass the authenticated actor so compliance re-evaluation stays tenant-scoped
- accidents -> vehicle (scoped), driver (`assertTenantEntityExists`), technician (`assertTenantEntityExists`)
- insurance claims -> vehicle (scoped), linked accident (`assertTenantEntityExists`)
- traffic fines -> vehicle (scoped), driver (`assertTenantEntityExists`), technician (`assertTenantEntityExists`)
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

- `modules/farm/*` (14 across crops, farm-finance, farm-workers, fields, harvest, irrigation, livestock, soil-tests, spray-logs, traceability, weather)

> Migrated out of this list in the current pass: `cleaning`, `utilities`, `operations`,
> `compliance` (all four removed from the exceptions registry). Additionally, the
> compliance-coupled phase-4 modules — `accidents`, `insurance-claims`, `traffic-fines`,
> `vehicle-documents` — were hardened from the `!== undefined` fail-open form (these were never in
> the registry because they do not match the four canonical audit patterns).
> Prior passes migrated all `work-orders/*`, `inventory`, `users`, `people`, `workforce-*`, and
> `auth`. These files are no longer in the exceptions registry, so CI now blocks any regression that
> reintroduces a fail-open pattern in them. **Farm modules are the only tenant-owned blockers left.**

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

**NO-GO.** Cleaning, Utilities, Operations, Compliance, and the compliance-coupled Accidents /
Insurance claims / Traffic fines / Vehicle documents modules are now fail-closed with cross-tenant
FK validation — joining Work Orders, Inventory & Spare Parts, and Users/People/Employees from prior
passes. Tenant switching remains fail-closed at the guard (active membership + active tenant
required). `npm run audit:tenant` reports **0 unapproved** fail-open patterns.

The verdict stays **NO-GO** for one reason: the **farm/\*** tenant-owned business modules
(14 fail-open occurrences across crops, farm-finance, farm-workers, fields, harvest, irrigation,
livestock, soil-tests, spray-logs, traceability, weather) remain unmigrated. Until they are
converted to `requireTenantId()`/`tenantWhere()` with cross-tenant FK validation, tenant isolation
is NOT complete and the platform stays NO-GO for production.