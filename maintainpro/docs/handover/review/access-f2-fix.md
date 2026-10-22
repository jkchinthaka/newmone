# F2 fix

The 669 `access.*` keys are no longer decorator arguments. `PermissionsGuard` was requiring them even with `ACCESS_STUDIO_ENABLED` false, so any database without those grants returned 403 for every non-super-admin on the touched routes. A handler-level `@Permissions` also replaced the class-level list.

Controllers again match `origin/develop` for `@Roles` and `@Permissions`. Route keys live in `apps/api/src/common/auth/access-route-keys.ts`, keyed by `METHOD path` from the route inventory. The key is one per module and role set (200 keys). Names come from the path, such as `work_orders.evidence.manage` and `approvals.inbox.view`. Renaming a handler does not change the key.

Flag off: `RolesGuard` and `PermissionsGuard` ignore the map. Flag on, and the caller is not `SUPER_ADMIN`: a mapped route skips `@Roles` and requires the existing permission list plus that access key. `SUPER_ADMIN` is unchanged.

The keys are not in `PERMISSION_CATALOG`, so catalog sync does not create them. The roles matrix hides them while the flag is off. Seed version is 2. The grant script stays dry-run by default and still refuses nelna, and refuses MaintainProDev on `--apply`.

Gates: API tsc 0. Web tsc 0. Web unit 368 passed. Jest inventory, key plan, parity, grant, roles guard, permissions guard, admin roles, effective permissions, and permission overrides passed. Parity: 971 routes × 27 roles, develop mismatches 0, flag-on mismatches 0. Tenant audit unapproved 0. RBAC audit violations 0, 971 routes.

F2.7 helper text is still on the overrides card until a live tenant dry-run is clean. F2.9 role-limited badge and F3 are not in this diff. Pull request #126 stays draft. Do not push to `main`.
