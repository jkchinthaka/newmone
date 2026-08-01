# Work Order RBAC Matrix (Phase 5B)

Role expectations for lifecycle E2E actors (Tenant A unless noted).

## Lifecycle actors

| Actor | Role | Lifecycle responsibilities |
| --- | --- | --- |
| `manager-a` | MANAGER | Create WO (`requiresApproval:true`), submit, assign, plan PATCH, list/read, cannot self-approve |
| `admin-a` | ADMIN | Approve (maker-checker checker), verify-supervisor, read |
| `tech-a` | TECHNICIAN | Start IN_PROGRESS, notes, evidence notes, technician completion |
| `inventory-a` | INVENTORY_KEEPER | Stock-out linked to WO |
| `admin-b` | ADMIN (Tenant B) | Cross-tenant isolation negative only |

## Endpoint access (lifecycle scope)

| Endpoint | manager-a | admin-a | tech-a | inventory-a | admin-b |
| --- | --- | --- | --- | --- | --- |
| `POST /work-orders` | Yes | Yes | No | No | Tenant B only |
| `PATCH /work-orders/:id/approve` | Yes (not own WO) | Yes | No | No | N/A |
| `POST /work-orders/:id/assign` | Yes | Yes | No | No | No |
| `PATCH /work-orders/:id/status` | Yes | Yes | Yes (assigned) | No | No |
| `POST /work-orders/:id/notes` | Yes | Yes | Yes | No | No |
| `POST /inventory/.../stock-out` | No | No | No | Yes | No |
| `POST /work-orders/:id/verify-supervisor` | Yes | Yes | **403** | No | **403/404** on Tenant A WO |
| `GET /work-orders/:id` | Yes | Yes | Yes | No | **403/404** cross-tenant |

## Maker-checker (Option A)

- **Maker:** creator (`createdById` = authenticated actor at create time)
- **Checker:** different user with `MANAGER`/`ADMIN`/`OPERATIONS_MANAGER` + `work_orders.manage`
- Self-approve without emergency override → **403 Forbidden**

## Permission notes

- Create/assign/plan/verify-supervisor require `work_orders.manage` (managers/admins).
- Status updates require `work_orders.update_status` (technicians included).
- Stock-out requires `inventory.stock_issue` (inventory keeper).

## E2E negative mapping

| Test | Proves |
| --- | --- |
| E2E-WO-NEG-001 | Execution RBAC + approval gate (400) |
| E2E-WO-NEG-003 | Assignment gate before start (400) |
| E2E-WO-NEG-006 | Supervisor verify role restriction (403) |
| E2E-WO-NEG-010 | Tenant isolation on read (403/404) |
| E2E-WO-NEG-015 | BFF CSRF on status mutation (403) |
