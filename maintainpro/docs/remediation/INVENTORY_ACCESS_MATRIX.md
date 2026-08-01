# Inventory Access Matrix (Phase 5A)

**Document type:** RBAC / business-role access contract for inventory.
**Phase:** 5A — Inventory Keeper access, stock-issue contract, tenant isolation.
**Decision:** **Option A** — minimal compatibility correction (see rationale below).

## Confirmed 403 root cause

`GET /inventory/parts` (and related read routes) required `@Roles(...)` that **omitted** `INVENTORY_KEEPER`, while seed already assigned `inventory.manage` + `inventory.stock_issue` to that role.

Classification: `RBAC_ROUTE_CONTRACT_DEFECT`
Secondary (not chosen for Phase 5A migration): `INVENTORY_READ_PERMISSION_DESIGN_GAP`

## Permission model decision — Option A

| Option | Summary | Selected |
| --- | --- | --- |
| A — Minimal compatibility | Add keeper (and aligned managers) to **read** role lists; keep `inventory.manage` as the read/master permission; keep `inventory.stock_issue` for stock-out | **Yes** |
| B — Least-privilege `inventory.view` | New permission + seed + production bootstrap rollout | No (deferred) |

**Rationale:** Seeds and JWT permission catalogs already treat `inventory.manage` as the inventory read gate. Introducing `inventory.view` would require an incomplete production permission migration without operator-owned rollout. Option A restores the intended business role on routes without broadening delete/ERP/admin capabilities.

## Access matrix

| Operation | Route | Current roles (Phase 5A) | Permission | INVENTORY_KEEPER |
| --- | --- | --- | --- | --- |
| View parts list | `GET /inventory/parts` | `INVENTORY_READ_ROLES` | `inventory.manage` | Allowed |
| View part detail | `GET /inventory/parts/:id` | `INVENTORY_READ_ROLES` | `inventory.manage` | Allowed |
| View movements | `GET /inventory/parts/:id/movements` | `INVENTORY_READ_ROLES` | `inventory.manage` | Allowed |
| View low stock | `GET /inventory/low-stock` | `INVENTORY_READ_ROLES` | `inventory.manage` | Allowed |
| Stock in | `POST /inventory/parts/:id/stock-in` | Admin / asset / mechanic | `inventory.manage` | Denied |
| Stock out | `POST /inventory/parts/:id/stock-out` | Includes keeper + managers | `inventory.stock_issue` | Allowed (WO-linked) |
| Create part | `POST /inventory/parts` | Admin / asset / mechanic | `inventory.manage` | Denied |
| Edit part | `PATCH /inventory/parts/:id` | Admin / asset / mechanic | `inventory.manage` | Denied |
| Delete part | `DELETE /inventory/parts/:id` | Admin / asset manager | `inventory.manage` | Denied |
| Linked WO / purchase history / analytics | various GETs | Admin / asset / mechanic | `inventory.manage` | Denied |
| ERP dry-run / apply | `POST /inventory/erp/...` | See controller (legacy includes keeper on some ERP routes) | ERP perms | **P1 review** — not expanded in 5A |

`INVENTORY_READ_ROLES` = `SUPER_ADMIN`, `ADMIN`, `ASSET_MANAGER`, `MECHANIC`, `INVENTORY_KEEPER`, `MANAGER`, `OPERATIONS_MANAGER`.

## Keeper posture

**May:** view tenant-scoped stock, detail, movements, low-stock; issue stock via authorized WO-linked stock-out.
**Must not (Phase 5A):** user admin, unrestricted part delete, finance approval, system settings, cross-tenant access.

## Seed alignment

Normal seed and E2E seed already grant `inventory.manage` and `inventory.stock_issue` to `INVENTORY_KEEPER`. Phase 5A does **not** change the permission catalog; it aligns route `@Roles` with that business assignment.

## Operator note (Option B deferred)

If product later adopts `inventory.view`, provide an operator-owned permission rollout (catalog + rolePermissions + JWT refresh) before flipping route decorators. Do not auto-run production seed.
