# Authorization Model

MaintainPro authorization has four layers, applied in this order by the global
guard chain in `app.module.ts`:

1. `JwtAuthGuard` - authenticates the caller (or allows `@Public()` routes).
2. `TenantContextGuard` - resolves and enforces the active tenant (or allows
   `@SkipTenantContext()` / platform routes).
3. `RolesGuard` - enforces `@Roles(...)`.
4. `PermissionsGuard` - enforces `@Permissions(...)` (with DB fallback and the
   legacy alias map in `permissions.guard.ts`).

On top of route-level guards, services enforce **object-level** authorization
(ownership, assignment, separation of duties) and **tenant isolation**
(`requireTenantId()` + `tenantWhere()` + cross-tenant FK validation).

## Route scopes

Every route declares exactly one scope (enforced by `npm run audit:rbac`):

- `@Public()` - unauthenticated transport only; never business data.
- `@Public()` + `@PublicWebhook(provider)` - integration webhook authenticated by
  provider signature (see `export-and-bulk-action-policy.md` and
  `platform-scope-policy.md`).
- `@SelfService()` - authenticated; the subject is the JWT caller and the caller's
  own resources are the object-level boundary. The handler must derive identity
  from `req.user.sub` and never trust a client-supplied user id.
- `@Roles(...)` / `@Permissions(...)` (optionally `@TenantScoped()`) - tenant
  business route.
- `@PlatformScoped()` + `@Roles('SUPER_ADMIN')` - platform administration.

## Roles

Roles present in the platform (see `RoleName` enum and `CLAUDE.md`):
`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `OPERATIONS_MANAGER`, `ASSET_MANAGER`,
`MAINTENANCE_MANAGER`, `SUPERVISOR`, `TECHNICIAN`, `MECHANIC`, `INVENTORY_KEEPER`,
`SECURITY_OFFICER`, `FLEET_MANAGER`, `FACILITY_MANAGER`, `CLEANER`, `DRIVER`,
`AUDITOR`/`VIEWER`, `FINANCE_APPROVER`, and the farm roles
`FARM_OWNER`/`FARM_MANAGER`/`FARM_WORKER`. Some legacy names (`ASSET_MANAGER`,
`MECHANIC`) remain referenced for backward compatibility.

## Capability model (permissions)

Permissions are named by business capability, not controller. Existing keys use
the `domain.action` convention (e.g. `work_orders.update_status`,
`inventory.manage`, `settings.system.manage`, `go_live.export`). The target
capability groups requested for this hardening map onto existing permissions as
follows:

| Capability group | Existing permission key(s) |
|------------------|----------------------------|
| WORK_ORDER_VIEW / CREATE / ASSIGN / APPROVE / EXECUTE / VERIFY / CLOSE / OVERRIDE | `work_orders.view`, `work_orders.create`, `work_orders.assign`, `work_orders.approve`, `work_orders.update_status`, `work_orders.verify`, `work_orders.close`, override via reason + audit |
| INVENTORY_VIEW / ISSUE / RETURN / ADJUST / APPROVE / EXPORT | `inventory.view`, `part_requests.issue`, `part_requests.return`, `inventory.manage`, `inventory.approve`, `reports.export` |
| FLEET_VIEW / UPDATE, GATE_RECORD / GATE_OVERRIDE | `fleet.view`, `fleet.manage`, `gate.record`, `gate.override.approve` |
| COMPLIANCE_VIEW / CREATE / VERIFY / OVERRIDE | `compliance.view`, `compliance.manage`, `compliance.verify`, override via reason + audit |
| REPORT_VIEW / EXPORT, PLATFORM_REPORT_VIEW / EXPORT | `reports.view`, `reports.export`; platform report access gated by `@PlatformScoped()` + `SUPER_ADMIN` |
| USER_VIEW / MANAGE, ROLE_MANAGE, TENANT_MANAGE | `users.view`, `users.manage`, `roles.manage`, `settings.organization.manage` |
| ERP_VIEW / RECONCILE / OVERRIDE | `erp.view`, `erp.reconcile`, override via reason + audit |
| EVIDENCE_VIEW / UPLOAD / DELETE | parent-record access, `*.report`/upload permissions, delete gated by verification state |
| FARM_VIEW / OPERATE / APPROVE, FARM_FINANCE_VIEW / APPROVE / EXPORT | farm role gating + `@SelfService`/tenant scope; finance view/mutate/approve/export separated |

New capabilities should reuse these keys; do not introduce duplicate or
conflicting permission names.

## Role-to-capability mapping (summary)

| Role | Capabilities (summary) |
|------|------------------------|
| SUPER_ADMIN | All, including platform administration and platform reports. |
| ADMIN | All tenant capabilities; tenant administration; no cross-tenant platform data. |
| MANAGER | View/create/approve across operational modules; reports view/export; billing view. |
| MAINTENANCE_MANAGER | Work-order lifecycle incl. approve/verify/close; maintenance; reports. |
| TECHNICIAN | Work-order view/execute on assigned work; evidence upload. |
| INVENTORY_KEEPER | Inventory view/issue/return/adjust; export. Approval separated. |
| SECURITY_OFFICER | Gate record; gate override with reason (audited). |
| FLEET_MANAGER | Fleet view/update; vehicle compliance. |
| FACILITY_MANAGER | Facilities, cleaning, facility issues; reports. |
| CLEANER | Cleaning tasks/self-service operational updates. |
| DRIVER | Trip/vehicle self-service; assigned work. |
| AUDITOR | Read-only view + audit log access; no mutations. |
| FARM_OWNER / FARM_MANAGER | Farm operate/approve; farm finance view/approve/export. |
| FARM_WORKER | Farm operational tasks; no finance approve/export. |
| FINANCE_APPROVER | Finance approvals and finance exports (audited). |

## Object-level rules (enforced in services)

- Work orders: requester may view permitted requests; assignee may execute
  assigned work; supervisor may assign/verify; approver may approve; lifecycle
  status changes require the relevant permission; overrides require reason + audit.
- Inventory: issue/return require an inventory role; adjustments require elevated
  permission; high-value adjustments require approval (maker-checker); an actor
  cannot approve their own restricted adjustment.
- Gate/fleet: security records entry/exit; override requires a dedicated
  permission, a mandatory reason, and an audit event.
- Compliance: creator does not auto-verify where separation of duties applies;
  expired-document overrides require authorization + reason; corrective
  work-order creation is audited.
- Evidence: uploader cannot delete protected evidence after verification;
  downloads require parent-record access.
- Farm finance: view/mutate/approve/export are separate capabilities; approved
  records require controlled amendment; exports are audited.

## Auditing

Sensitive actions emit structured audit events (actor id, tenant/platform scope,
action, target type/id, before/after where applicable, reason, correlation id,
timestamp, result). Sensitive-data redaction (`sensitive-data-redaction.util.ts`)
runs before audit persistence and replication. See
`export-and-bulk-action-policy.md` for export/bulk-specific audit requirements.
