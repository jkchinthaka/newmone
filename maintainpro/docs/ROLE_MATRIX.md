# Role Matrix

MaintainPro uses **role + permission** RBAC. Frontend navigation and dashboards are **UX hints only** — the API enforces access.

## Built-in roles (canonical `RoleName` values)

SQL Server stores `Role.name` as `String` (no Prisma native enum). The authoritative
catalog is `apps/api/src/database/prisma-enums.ts` → `RoleName` (27 values). Do **not**
casually add values there or invent parallel schema enums — prefer application mapping
for aliases and personas.

| Role | Primary purpose | Key permissions / modules |
|------|-----------------|---------------------------|
| SUPER_ADMIN | Cross-tenant platform admin | Full admin APIs, readiness, tenants |
| ADMIN | Tenant administrator | Users, settings, admin console, reports |
| MANAGER | Planning and oversight | Work orders, approvals, reports, dashboard |
| TECHNICIAN | Field maintenance execution | Assigned work orders, evidence upload |
| MECHANIC | Workshop execution | Work orders (alias patterns) |
| SECURITY_OFFICER | Gate and scan operations | `gate.in.create`, `gate.out.create`, `operations.scan_lookup` |
| DRIVER | Fleet operator | Vehicles, trips, fleet views |
| CLEANER | Cleaning operations | Cleaning modules, scan/report |
| VIEWER | Read-only | Reports, dashboard (read) |
| INVENTORY_KEEPER | Stock control | Inventory, part issue/reserve |
| PROCUREMENT_OFFICER | Purchasing | Procurement module |
| FINANCE | Finance / vendor attention | Reports, finance signals (not requester fallback) |
| COMPLIANCE_MANAGER | Compliance | Compliance, documents |
| SUPERVISOR / ASSET_MANAGER / FACILITY_* / FLEET_* / OPERATIONS_MANAGER | Ops oversight | Mapped via dashboard + Action Center variants |
| FARM_* roles | Farm vertical | Farm module |

## Role drift classification (Action Center / dashboard)

These strings appear in UI/API mapping tables but are **not** in the canonical
`RoleName` catalog. No schema migration is required; normalize via
`resolveDashboardVariant` / `resolveRoleHome` / Action Center helpers.

| Role string | Classification | Application mapping |
|-------------|----------------|---------------------|
| `MAINTENANCE_SUPERVISOR` | Compatibility alias | → SUPERVISOR profile / `management` Action Center variant |
| `STOREKEEPER` | Compatibility alias | → INVENTORY_KEEPER behavior / `inventory` variant |
| `FINANCE_APPROVER` | Compatibility alias | → FINANCE / MANAGEMENT_VIEWER read-only finance path |
| `AUDITOR` | Compatibility alias | → VIEWER / `viewer` variant (read-only) |
| `REQUESTER` | Display/persona alias (fallback archetype) | Default home profile for unmapped/unknown roles; **not** used for FINANCE or PROCUREMENT_OFFICER |
| `VENDOR` | Obsolete / external persona placeholder | Resolves to `minimal`; no seeded canonical role |

Regression coverage: `apps/web/lib/__tests__/dashboard-roles.test.ts`,
`apps/web/lib/__tests__/role-home.test.ts`.

## SECURITY_OFFICER detail

| Check | Expected |
|-------|----------|
| Seeded user | `security@maintainpro.local` |
| Gate-out | `POST /api/vehicles/:id/gate-out` with `gate.out.create` |
| Gate-in | `POST /api/vehicles/:id/gate-in` with `gate.in.create` |
| Scan lookup | Operations controller allows SECURITY_OFFICER |
| Nav visibility | Fleet/security items in `lib/navigation.ts` |
| Post-login | `/dashboard` (until dedicated `/fleet/gate` route ships) |

## Permission model

- Permissions stored as catalog keys (e.g. `work_orders.manage`, `audit.view`)
- Roles link to permissions per tenant
- `PermissionsGuard` checks JWT + DB fallback with alias map
- Fine-grained gates on controllers via `@Permissions(...)`

## Dashboard mapping (web)

| Role group | Dashboard variant | Data source |
|------------|-------------------|-------------|
| Admin / Super Admin | Management + system health | Live APIs |
| Manager / Supervisor | Work orders + reports + action center | Live APIs |
| Technician / Mechanic | Work order summary + my jobs links | Live APIs |
| Security Officer | Fleet-oriented briefing | Partial — links to fleet |
| Cleaner / Driver | Quick links + empty KPI state | Partial |
| Inventory roles (`INVENTORY_KEEPER`; alias `STOREKEEPER`) | Inventory summary cards | Live APIs |
| Viewer / Auditor alias | Reports summary | Live APIs |

Config: `apps/web/lib/dashboard-roles.ts`, `apps/web/lib/action-center.ts`, `components/dashboard/role-dashboard.tsx`.

## Role × module visibility (web nav)

Derived from `apps/web/lib/navigation.ts` `allowedRoles` per item.

| Module | Typical roles |
|--------|---------------|
| Dashboard | Most authenticated roles |
| Admin Console | ADMIN, SUPER_ADMIN |
| System Health | ADMIN, SUPER_ADMIN |
| Work Orders | MANAGER, TECHNICIAN, ADMIN, … |
| Fleet / Vehicles | MANAGER, SECURITY_OFFICER, DRIVER, … |
| Inventory | INVENTORY_KEEPER, ADMIN, MANAGER, … |
| Cleaning | CLEANER, FACILITY_MANAGER, … |
| Farm | FARM_* roles |
| Settings | ADMIN |

## Enterprise personas (roadmap alignment)

Roles not fully modeled as separate dashboards yet — use permission composition:

| Persona | MaintainPro scope | Integration point |
|---------|-------------------|-------------------|
| IT Manager | System health, readiness, queues | Future IT ops dashboard |
| Finance | Reports, billing, WO cost | Export / ERP |
| HR | Training/cert expiry refs | External HRMS |
| QA/Compliance | Compliance module, document expiry | Audit explorer |
| Procurement | Procurement + ERP sync panel | ERP adapter |

See [ENTERPRISE_ROADMAP.md](ENTERPRISE_ROADMAP.md) for persona-specific dashboard plans.

## Seeded demo accounts

Set password via `MAINTAINPRO_SEED_PASSWORD`. Emails in `apps/api/src/database/seed.ts`.

## Changing roles safely

1. Add the value to `RoleName` in `apps/api/src/database/prisma-enums.ts` (canonical catalog)
2. Seed a `Role` row + permissions in the seed catalog
3. Map role → permissions in seed
4. Add navigation `allowedRoles` and Action Center / dashboard buckets
5. Add API `@Roles` / `@Permissions` on new endpoints
6. Extend web role-home/dashboard/Action Center tests and API RBAC tests
7. Prefer compatibility aliases over new catalog entries when the need is only display/persona drift
