# MaintainPro Mobile V2 — RBAC Matrix

**Base SHA:** `2fd697e004da8524b6348c1ad2d33411a873a2a8`  
**Sources:** `prisma/schema.prisma` `RoleName`, `apps/api` permissions seed, `apps/web/lib/navigation.ts`, `permissions.guard.ts` aliases.

## Roles (Prisma `RoleName`)

`SUPER_ADMIN`, `ADMIN`, `OPERATIONS_MANAGER`, `FLEET_MANAGER`, `COMPLIANCE_MANAGER`, `MANAGER`, `TECHNICIAN`, `MECHANIC`, `ASSET_MANAGER`, `INVENTORY_KEEPER`, `PROCUREMENT_OFFICER`, `FINANCE`, `SUPERVISOR`, `SECURITY_OFFICER`, `CLEANER`, `DRIVER`, `VIEWER`, farm roles (`FARM_*`, `FIELD_SUPERVISOR`, `AGRONOMIST`, `VETERINARIAN`, `IRRIGATION_OPERATOR`, `HARVEST_CREW`), facility (`FACILITY_MANAGER`, `BUILDING_SUPERVISOR`).

Web nav also references legacy aliases: `MAINTENANCE_SUPERVISOR`, `STOREKEEPER`, `FINANCE_APPROVER`, `AUDITOR`.

## Guard order (API)

`JwtAuthGuard` → `TenantContextGuard` → `RolesGuard` → `PermissionsGuard`  
Permissions resolved from **DB** role grants (JWT permission list not authoritative in prod).  
`SUPER_ADMIN` bypasses permission checks.  
Aliases: `gate.in.create` / `gate.out.create` ↔ `vehicles.operate`.

## Role-aware Home (mobile)

| Role | Home emphasis |
|---|---|
| TECHNICIAN / MECHANIC | My Jobs, Due, Waiting Parts, Evidence Needed, Quick Start |
| DRIVER | My Vehicle, Trips, Fuel, Report Issue |
| SECURITY_OFFICER | Gate Queue, Scan Vehicle, Gate In/Out, Blocks |
| FG recorder (fg.access) | CL18, CL24, CL30, Drafts |
| SUPERVISOR | Pending Reviews, Team Work, FG Pending |
| QA (fg.qa* / qa.*) | Pending Verification, Exceptions, History |
| MANAGER / OPERATIONS_MANAGER | KPIs, Action Center, Approvals, Alerts |
| ADMIN / SUPER_ADMIN | System, Users, Health, Configuration |

## Critical permissions (mobile-relevant)

| Domain | Permissions |
|---|---|
| Work orders | `work_orders.manage`, `work_orders.update_status`, `work_orders.view_own` |
| Gate | `gate.in.create`, `gate.out.create`, `gate.override.approve`, `vehicles.view` |

### Gate notes (Mobile V2)

- Security home routes to `/gate`.
- Override UI requires JWT `gate.override.approve` **and** server `canOverride`.
- Mobile never treats client-supplied `approvedByUserId` as authority (server ignores it for auth).
- Drivers do not gain Gate from vehicle visibility alone.
| Vehicles | `vehicles.view`, `vehicles.operate`, `vehicles.create`, `vehicles.edit` |
| Inventory | `inventory.*`, `inventory.stock_issue` |
| Part requests | `part_requests.*` |
| FG | `fg.access`, `fg.*` catalogue |
| Scan | `operations.scan_lookup` |
| Notifications | authenticated user scope |
| Admin | `users.*`, `roles.manage`, `settings.*` |

## Mobile QA rule

For each Role × Module × Action:

1. UI action visible only when authorized (nav policy).
2. Unauthorized direct API call must still be rejected by Nest.

UI hiding ≠ security.

## Tenant isolation

Local Drift rows always scoped by `tenantId` + `userId`. Cross-tenant exposure tolerance: **0**.
