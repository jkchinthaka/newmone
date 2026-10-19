# 02 Feature inventory

This is a source map of the release worktree, not a proof that each feature works.

- API modules live under `maintainpro/apps/api/src/modules/` and are registered from `app.module.ts`.
- Web routes live under `maintainpro/apps/web/app/(dashboard)/`.
- Auth: `JwtStrategy`, `JwtAuthGuard`, `TenantContextGuard`, `RolesGuard`, `PermissionsGuard`.
- Work orders: `work-orders.controller.ts` exposes generic `PATCH :id/status`, dedicated verify and close, and `POST bulk/status`.
- Inventory: `inventory.service.ts` and `verified-stock-availability.ts`. Bileeta remains the stock authority.
- Queues: `work-order-queues.service.ts` My Jobs path caps at 500 then filters in memory.

A complete button-to-SQL matrix for every page was not generated in this session.
