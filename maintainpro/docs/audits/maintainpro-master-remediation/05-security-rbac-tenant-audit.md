# 05 Security, RBAC, and tenant audit

`JwtStrategy` previously returned the token payload after checking only `isActive` and `lockedUntil`. `TenantContextGuard` skipped membership when that token role was `SUPER_ADMIN`.

The guard now loads `user.role.name` and `isActive` before any scope decision and writes that role back onto the request. A demoted technician token that still says `SUPER_ADMIN` fails the membership check. A disabled account fails before tenant access.

Platform routes still require the current role `SUPER_ADMIN`. A current super admin can open an active tenant without a membership row. That preserves the existing platform-admin behavior.

Tests: `jwt-strategy.spec.ts`, `tenant-context-fail-closed.spec.ts`, `cross-tenant-isolation.spec.ts` (25 passed in the first run; the later combined run included the first two files again).

Session revocation beyond inactive, locked, and role reload was not redesigned. Refresh tokens are still the logout mechanism. There is no token version column.
