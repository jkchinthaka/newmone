# Role / Permission Matrix (Final Acceptance)

**Canonical catalog:** `apps/api/src/database/prisma-enums.ts` → `RoleName` (27 values).  
**DB storage:** `Role.name` String (no Prisma native enum).  
**Aliases:** documented in `docs/ROLE_MATRIX.md` — do not casually alter `RoleName`.

## Seeded roles exercised (Action Center local QA)

| Role | Nav / Home | Action Center sections (observed) | KPI strip | Queue badges fetch | Unexpected 403 | Status |
|------|------------|-----------------------------------|-----------|--------------------|----------------|--------|
| ADMIN | Manager Home | system, admin, WO, inventory, invites, facility, FG, reports | yes (reports.view) | yes | none | PASS |
| MANAGER | Manager Home | WO, inventory, facility, reports | yes | yes | none | PASS |
| OPERATIONS_MANAGER | Manager Home | WO, inventory, reports (no facility) | yes | yes | none | PASS |
| SUPERVISOR | Supervisor Home | WO, facility, reports | yes | yes | none | PASS |
| ASSET_MANAGER | Manager Home | WO, inventory, facility, reports | yes | yes | none | PASS |
| FACILITY_MANAGER | Home | WO, facility, reports | no (not in KPI role set) | yes | none | PASS |
| BUILDING_SUPERVISOR | Home | WO, facility, reports | no | yes | none | PASS |
| FLEET_MANAGER | Fleet Home | WO, reports (no facility) | yes | yes | none | PASS |
| COMPLIANCE_MANAGER | Home | WO, reports (no facility) | yes | yes | none | PASS |
| SECURITY_OFFICER | Fleet Home | WO, reports | no | yes | none | PASS |
| TECHNICIAN | My Work | my WOs | no | yes | none | PASS |
| MECHANIC | My Work | my WOs | no | yes | none | PASS |
| INVENTORY_KEEPER | Home | inventory | no | yes | none | PASS |
| PROCUREMENT_OFFICER | Procurement Home | inventory/PO (not REQUESTER) | no | no | none | PASS |
| FINANCE | Reports | vendor/finance (not REQUESTER) | yes | yes | none | PASS |
| VIEWER | Reports | WO, facility, reports (read-only) | yes | yes | none | PASS |
| DRIVER | Fleet Home | fleet links | no | no | none | PASS |
| CLEANER | Home | cleaning/facility | no | no | none | PASS |

## Compatibility aliases (not seeded as distinct RoleName)

| Alias | Classification | Maps to |
|-------|----------------|---------|
| MAINTENANCE_SUPERVISOR | compatibility alias | SUPERVISOR / management |
| STOREKEEPER | compatibility alias | INVENTORY_KEEPER / inventory |
| FINANCE_APPROVER | compatibility alias | FINANCE / MANAGEMENT_VIEWER |
| AUDITOR | compatibility alias | VIEWER |
| REQUESTER | persona/fallback archetype | minimal home for unmapped roles only |

## Enforcement equation (target)

Navigation hint (`allowedRoles`) ≈ Page UX ≈ Button UX ≈ API `@Roles`/`@Permissions` ≈ tenant-scoped Prisma queries.

Deviations found historically (facility 403s, page-1 KPIs) were remediated in PR #42; this acceptance branch re-verifies and documents remaining OPEN journeys.
