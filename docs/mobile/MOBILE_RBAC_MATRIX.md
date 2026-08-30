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
| TECHNICIAN / MECHANIC | My Jobs, Due, Waiting Parts, Evidence Needed, Vehicles (`/fleet/vehicles`) |
| DRIVER | My Vehicle (`/fleet/vehicles`), Trips/Tasks (`/fleet`), Fuel via vehicle detail, Scan, Alerts |
| SECURITY_OFFICER | Gate Queue, Scan Vehicle, Gate In/Out, Blocks |
| FG recorder (fg.access) | CL18, CL24, CL30, Drafts |
| SUPERVISOR | Pending Reviews, Team Work, FG Pending |
| QA (fg.qa* / qa.*) | Pending Verification, Exceptions, History |
| MANAGER / OPERATIONS_MANAGER | KPIs, Action Center, Fleet hub (`/fleet`), Approvals |
| ADMIN / SUPER_ADMIN | System, Users, Health, Configuration |

## Critical permissions (mobile-relevant)

| Domain | Permissions |
|---|---|
| Work orders | `work_orders.manage`, `work_orders.update_status`, `work_orders.view_own` |
| Gate | `gate.in.create`, `gate.out.create`, `gate.override.approve`, `vehicles.view` |
| Vehicles / Fleet | `vehicles.view`, `vehicles.edit`, `vehicles.operate`, `vehicles.create`, `vehicles.delete` |
| Inventory | `inventory.*`, `inventory.stock_issue` |
| Part requests | `part_requests.*` |
| FG | `fg.access`, `fg.*` catalogue |
| Scan | `operations.scan_lookup` |
| Notifications | authenticated user scope |
| Admin | `users.*`, `roles.manage`, `settings.*` |

### Gate notes (Mobile V2)

- Security home routes to `/gate`.
- Override UI requires JWT `gate.override.approve` **and** server `canOverride`.
- Mobile never treats client-supplied `approvedByUserId` as authority (server ignores it for auth).
- Drivers do not gain Gate from vehicle visibility alone.

### Fleet / Vehicles notes (Mobile V2)

| Permission | Mobile use |
|---|---|
| `vehicles.view` | Fleet hub, vehicles list/detail, fuel analytics, history reads |
| `vehicles.operate` | Trip start/end, fuel log, meter reading (online-only) |
| `vehicles.edit` | Assign driver (online); unassign **blocked** — no API |
| `vehicles.create` / `vehicles.delete` | Not exposed on mobile fleet forms |

- Nav: Fleet → `/fleet`, Vehicles → `/fleet/vehicles` (requires `vehicles.view`).
- DRIVER home cards: My Vehicle → `/fleet/vehicles`; Trips/Tasks → `/fleet`.
- **Drivers directory:** Nest `@Roles("SUPER_ADMIN","ADMIN","ASSET_MANAGER")` — not permission-based. Hub hides Drivers unless role matches; others get 403 on `/api/drivers`.
- FLEET_MANAGER / DRIVER with `vehicles.view` can use vehicles/trips/fuel but not the drivers directory unless also in the Nest role allowlist.
- Live fleet map not shipped; Gate remains separate at `/gate`.

## Mobile QA rule

For each Role × Module × Action:

1. UI action visible only when authorized (nav policy).
2. Unauthorized direct API call must still be rejected by Nest.

UI hiding ≠ security.

## Tenant isolation

Local Drift rows always scoped by `tenantId` + `userId`. Cross-tenant exposure tolerance: **0**.
