# Role Matrix

MaintainPro uses **role + permission** RBAC. Frontend navigation and dashboards are **UX hints only** — the API enforces access.

## Built-in roles (Prisma `RoleName`)

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
| INVENTORY_KEEPER / STOREKEEPER | Stock control | Inventory, part issue/reserve |
| PROCUREMENT_OFFICER | Purchasing | Procurement module |
| COMPLIANCE_MANAGER | Compliance | Compliance, documents |
| FARM_* roles | Farm vertical | Farm module |
| Legacy aliases | ASSET_MANAGER, SUPERVISOR, etc. | Mapped in guards with aliases |

Full enum: `prisma/schema.prisma` → `RoleName`.

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
| Inventory roles | Inventory summary cards | Live APIs |
| Viewer / Auditor | Reports summary | Live APIs |

Config: `apps/web/lib/dashboard-roles.ts`, `components/dashboard/role-dashboard.tsx`.

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

1. Update Prisma enum if adding role
2. Add permissions in seed catalog
3. Map role → permissions in seed
4. Add navigation `allowedRoles`
5. Add dashboard variant if needed
6. Add API `@Roles` / `@Permissions` on new endpoints
7. Extend tests in `apps/api/test/`
