# Permission Matrix — MaintainPro

**UAT phase:** UAT-022  
**Last updated:** 2026-07-02  
**Source of truth:** `apps/api/src/database/seed.ts` (role → permission map), controller `@Roles` / `@Permissions` decorators, [backend-rbac-audit.md](backend-rbac-audit.md)

---

## Enforcement model

All `/api/*` routes pass through global guards (order matters):

1. **`JwtAuthGuard`** — valid JWT required (except documented public auth/health routes).
2. **`TenantContextGuard`** — `X-Tenant-Id` header required; scopes data to tenant.
3. **`RolesGuard`** — checks `@Roles(...)` against `request.user.role` (Prisma `RoleName` or legacy string e.g. `FINANCE_APPROVER`).
4. **`PermissionsGuard`** — checks `@Permissions(...)` against JWT permissions; **falls back to DB role-permission lookup** when JWT omits permissions (`COMPATIBLE_PERMISSION_ALIASES` for legacy keys).

**Legend:** ✅ Yes · ❌ No · **Own** — own records only · **RO** — read-only · **Perm** — requires specific permission key (any role holding it)

### Role name mapping (documentation ↔ Prisma)

| Doc / business name | Prisma `RoleName` | Notes |
|---------------------|-------------------|-------|
| Super Admin | `SUPER_ADMIN` | Full catalog incl. `system.configure` |
| Admin | `ADMIN` | All except `system.configure` |
| Maintenance Manager | `MANAGER` | Primary maintenance operations role |
| Operations Manager | `OPERATIONS_MANAGER` | Cross-module ops + finance PO approval |
| Store Keeper | `INVENTORY_KEEPER` | Inventory, part issue, operational PO approval |
| Security Officer | `SECURITY_OFFICER` | Gate in/out, vehicle view |
| Facility Manager | `FACILITY_MANAGER` | Building hierarchy + facility issues |
| Building Supervisor | `BUILDING_SUPERVISOR` | Facility read + cleaning sign-off |
| Farm Manager | `FARM_MANAGER` | Farm module subset |
| Finance Approver | `FINANCE_APPROVER` *(string)* | Not in `RoleName` enum; used on management-intelligence and fraud-control report endpoints. Finance capability also via `purchase_orders.approve_finance` / `part_requests.approve_finance` permissions held by MANAGER, OPERATIONS_MANAGER, ADMIN |

---

## 1. Dashboard & Action Center

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `dashboard.view`, `dashboard_analytics.view` |
| ADMIN | Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Same as super minus `system.configure` |
| MANAGER | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | Morning briefing, module summaries |
| OPERATIONS_MANAGER | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | Ops KPIs |
| TECHNICIAN | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Own WO widgets |
| INVENTORY_KEEPER | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Inventory landing |
| SECURITY_OFFICER | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Fleet/gate focus |
| SUPERVISOR | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | Cleaning + reports |
| VIEWER | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | Read-only analytics |
| FACILITY_MANAGER | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | Facility dashboard |
| FARM_MANAGER | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Farm scope |
| FINANCE_APPROVER | Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | Reports + billing nav |

---

## 2. Work Orders

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Work Orders | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | `@Permissions work_orders.manage` on POST |
| ADMIN | Work Orders | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Full governance |
| MANAGER | Work Orders | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | `work_orders.manage`, approve/reject endpoints |
| OPERATIONS_MANAGER | Work Orders | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | Same manage permissions as manager |
| ASSET_MANAGER | Work Orders | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | Asset-linked WOs |
| TECHNICIAN | Work Orders | **Own** | ❌ | **Own** | ❌ | ❌ | ❌ | ❌ | `work_orders.view_own`, `work_orders.update_status` |
| MECHANIC | Work Orders | **Own** | ❌ | **Own** | ❌ | ❌ | ❌ | ❌ | Same as technician + `vehicles.edit` |
| SUPERVISOR | Work Orders | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Supervisor verification (governance service) |
| INVENTORY_KEEPER | Work Orders | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | List for parts context only |
| SECURITY_OFFICER | Work Orders | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Read for gate block checks |
| VIEWER | Work Orders | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | No WO list access |
| DRIVER | Work Orders | **Own** | ❌ | **Own** | ❌ | ❌ | ❌ | ❌ | `work_orders.view_own` |
| FARM_MANAGER | Work Orders | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Farm assets |
| FARM_WORKER | Work Orders | **Own** | ❌ | **Own** | ❌ | ❌ | ❌ | ❌ | Status updates only |

**Key permissions:** `work_orders.manage`, `work_orders.update_status`, `work_orders.view_own`  
**Governance (UAT-009):** completion evidence, supervisor verify, approve/reject — audited  
**High-risk:** status transitions, bulk actions (UAT-019) — `@Roles` + service-layer audit

---

## 3. Workforce

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Workforce | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Employee master CRUD |
| ADMIN | Workforce | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | |
| MANAGER | Workforce | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | Leave override audited (UAT-007) |
| OPERATIONS_MANAGER | Workforce | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | Assignment preview |
| ASSET_MANAGER | Workforce | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Assignable employees |
| TECHNICIAN | Workforce | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| Others | Workforce | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |

---

## 4. Assets

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Assets | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | `ASSET_*_ROLES` constants |
| ADMIN | Assets | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Delete limited to ADMIN/SUPER_ADMIN |
| MANAGER | Assets | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | `assets.manage` |
| ASSET_MANAGER | Assets | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | Primary asset owner |
| TECHNICIAN | Assets | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Indirect via WO |
| VIEWER | Assets | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| FARM_MANAGER | Assets | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `assets.manage` |

**Enforcement:** `@Roles(...ASSET_READ_ROLES)` / `ASSET_WRITE_ROLES` / `ASSET_DELETE_ROLES` on `assets.controller.ts`

---

## 5. Vehicles & Fleet

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Vehicles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `@Permissions` on mutations |
| ADMIN | Vehicles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| FLEET_MANAGER | Vehicles | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | `fleet.manage`, gate override |
| MANAGER | Vehicles | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | **RO** | `gate.override.approve`, operate |
| OPERATIONS_MANAGER | Vehicles | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | **RO** | Gate + PO context |
| SECURITY_OFFICER | Vehicles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `gate.out.create`, `gate.in.create` |
| DRIVER | Vehicles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `vehicles.operate` |
| VIEWER | Vehicles | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `vehicles.view` |

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| FLEET_MANAGER | Fleet (geofence, live map) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `@Roles` FLEET_MANAGER + managers |
| MANAGER | Fleet | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `fleet.manage` |
| SECURITY_OFFICER | Fleet / Gate | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Gate UI `/fleet/gate` |

**Gate override permission:** `gate.override.approve` — MANAGER, OPERATIONS_MANAGER, FLEET_MANAGER, ADMIN

---

## 6. Maintenance

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Maintenance | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Schedules, logs, predictive alerts |
| ADMIN | Maintenance | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | |
| ASSET_MANAGER | Maintenance | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Primary maintainer |
| MECHANIC | Maintenance | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Logs + calendar read |
| MANAGER | Maintenance | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Via reports |
| VIEWER | Maintenance | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |

**Enforcement:** `@Roles` on `maintenance.controller.ts` — no separate permission keys

---

## 7. Inventory & Procurement

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Inventory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Full |
| ADMIN | Inventory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| MANAGER | Inventory | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | `inventory.manage`, stock issue |
| INVENTORY_KEEPER | Inventory | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | **Store Keeper** — issue focus |
| ASSET_MANAGER | Inventory | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Parts master |
| MECHANIC | Inventory | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | Stock movements |
| TECHNICIAN | Inventory | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `inventory.manage` read/issue context |
| OPERATIONS_MANAGER | Inventory | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | **RO** | PO operational + finance approve |

### Part requests

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| TECHNICIAN | Part Requests | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `part_requests.create` |
| MANAGER | Part Requests | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | Operational + finance approve |
| INVENTORY_KEEPER | Part Requests | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Operational approve + `part_requests.issue` |
| OPERATIONS_MANAGER | Part Requests | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Dual approval + issue |

**Maker-checker (UAT-020):** requester ≠ approver on same transaction

### Purchase orders

| Role | Module | View | Create | Update | Delete | Approve (Ops) | Approve (Finance) | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------------|-------------------|----------|--------|-------|
| ASSET_MANAGER | Purchase Orders | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Creates PO |
| INVENTORY_KEEPER | Purchase Orders | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | `purchase_orders.approve_operational` |
| MANAGER | Purchase Orders | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | **Finance via permission** |
| OPERATIONS_MANAGER | Purchase Orders | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | Finance approver |
| FINANCE_APPROVER | Purchase Orders | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Report endpoints; map to finance permission |

**Permissions:** `purchase_orders.approve_operational`, `purchase_orders.approve_finance`, `purchase_orders.reject`, `purchase_orders.erp_sync`

---

## 8. Reports & Analytics

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Reports | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `reports.view`; export audited |
| ADMIN | Reports | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | |
| MANAGER | Reports | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `GET /reports/:module/export` |
| OPERATIONS_MANAGER | Reports | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | |
| INVENTORY_KEEPER | Reports | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | Inventory reports |
| VIEWER | Reports | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | |
| TECHNICIAN | Reports | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| FINANCE_APPROVER | Management Intelligence | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `@Roles` includes FINANCE_APPROVER |
| MANAGER | Management Intelligence | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | Profitability summary (UAT-021) |
| TECHNICIAN | Management Intelligence | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Service-layer 403 |

### Fraud & control reports (UAT-020)

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| ADMIN | Fraud Control | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | Admin overrides CSV |
| MANAGER | Fraud Control | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | |
| OPERATIONS_MANAGER | Fraud Control | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | |
| FINANCE_APPROVER | Fraud Control | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | |

---

## 9. Audit

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `audit.view` |
| ADMIN | Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | |
| MANAGER | Audit Logs | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | No `audit.view` in seed |
| OPERATIONS_MANAGER | Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `audit.view` |
| COMPLIANCE_MANAGER | Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | |
| SUPERVISOR | Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | |
| VIEWER | Audit Logs | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |

**Enforcement:** `@Permissions('audit.view')` on `audit.controller.ts`; export writes `report_exported` audit event per [audit-trail-standard.md](audit-trail-standard.md)

---

## 10. Admin, Users & Roles

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Admin Console | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | `@Roles` SUPER_ADMIN, ADMIN |
| ADMIN | Admin Console | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Tenants, users, invitations |
| Others | Admin Console | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Users | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | `users.*` permissions |
| ADMIN | Users | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | |
| MANAGER | Users | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `users.view` only |

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Roles & Permissions | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `roles.manage`, `permissions.create` |
| ADMIN | Roles & Permissions | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | |

---

## 11. Settings & System Health

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Settings | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `settings.system.manage`, `settings.organization.manage` |
| ADMIN | Settings | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | |
| MANAGER | Settings | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `settings.view` |
| VIEWER | Settings | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| SUPER_ADMIN | System Health | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `/system-health`, deployment-readiness |
| ADMIN | System Health | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |

---

## 12. Cleaning

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Cleaning | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | |
| ADMIN | Cleaning | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | |
| SUPERVISOR | Cleaning | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | `cleaning.sign_off`, `cleaning.manage` |
| CLEANER | Cleaning | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `cleaning.log_visit`, `cleaning.report_issue` |
| MANAGER | Cleaning | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `cleaning.manage` |

---

## 13. Facilities (Building)

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| FACILITY_MANAGER | Facilities | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | **RO** | `facilities.manage` |
| BUILDING_SUPERVISOR | Facilities | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **RO** | `facilities.view` |
| MANAGER | Facility Issues | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | `facility_issues.manage` |
| SUPERVISOR | Facility Issues | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | |
| CLEANER | Facility Issues | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `facility_issues.report` |
| VIEWER | Facilities | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |

**Permissions:** `facilities.view`, `facilities.manage`, `facility_issues.*`, `facility_inspections.*`

---

## 14. Compliance, Accidents, Insurance, Fines

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| COMPLIANCE_MANAGER | Compliance | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `compliance.view` |
| FLEET_MANAGER | Vehicle Documents | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | `vehicle_documents.verify` |
| DRIVER | Accidents | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `accidents.report` |
| FLEET_MANAGER | Insurance Claims | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | `insurance_claims.approve` |
| MANAGER | Traffic Fines | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `traffic_fines.manage` |

**Enforcement:** `@Permissions` per controller action (accidents, insurance-claims, traffic-fines, compliance, vehicle-documents)

---

## 15. Driver Intelligence & Predictive AI

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| FLEET_MANAGER | Driver Intelligence | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `driver_intelligence.manage` |
| MANAGER | Driver Intelligence | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | |
| DRIVER | Driver Intelligence | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Own eligibility |
| TECHNICIAN | Predictive Insights | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `predictive_insights.view` |
| MANAGER | Predictive AI Actions | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `@Roles` on WO create/assign actions |
| All authenticated | Predictive AI Chat | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **TODO:** tighten RBAC (UAT-022) |

---

## 16. Notifications

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| All authenticated | Notifications (inbox) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | **TODO:** add `@Permissions` (self-service) |
| SUPER_ADMIN | Notification UAT / readiness | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Email/SMS test endpoints |
| ADMIN | Notification templates | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |

---

## 17. Farm (optional module)

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| FARM_OWNER | Farm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Full catalog |
| FARM_MANAGER | Farm | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | `assets.manage`, `work_orders.manage` |
| FIELD_SUPERVISOR | Farm | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | WO manage |
| FARM_WORKER | Farm | **Own** | ❌ | **Own** | ❌ | ❌ | ❌ | ❌ | WO status |

---

## 18. Billing

| Role | Module | View | Create | Update | Delete | Approve | Override | Export | Notes |
|------|--------|------|--------|--------|--------|---------|----------|--------|-------|
| SUPER_ADMIN | Billing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Checkout session |
| ADMIN | Billing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| MANAGER | Billing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| FINANCE_APPROVER | Billing | **RO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Nav visibility only |

---

## Verification

Regenerate route-level audit:

```bash
node scripts/generate-backend-rbac-audit.mjs
```

Run security regression:

```bash
npm run test --workspace @maintainpro/api -- --runInBand test/security-rbac-audit.spec.ts
```

---

## Related documents

- [backend-rbac-audit.md](backend-rbac-audit.md)
- [anti-fraud-policy.md](anti-fraud-policy.md)
- [audit-trail-standard.md](audit-trail-standard.md)
- [uat-index.md](uat-index.md)
