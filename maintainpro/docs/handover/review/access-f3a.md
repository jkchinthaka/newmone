# F3a preview audit

A super admin start or stop of Access Studio preview writes one audit row. The row records the actor, the target user, and the tenant. Flag off does not write a row and returns the existing preview-unavailable error.

`POST /admin/access-preview/start` and `POST /admin/access-preview/stop` are super-admin only. They reuse the existing key `admin.permission_overrides.access`. No new permission and no schema change.

The web calls start before it stores the preview, and stop after it clears the header so the read-only preview guard does not block the audit. A failed stop restores the preview and shows the error on the banner.

Gates: API tsc 0. Web tsc 0. Web unit 377 passed. Jest `access-preview-audit` 2 passed, key plan passed, parity 974 routes x 27 roles, develop mismatches 0, flag mismatches 0. Tenant audit unapproved 0. RBAC 974 routes, violations 0.

`node scripts/test/access-studio-ui.cjs` was not run. Port 3053 is already in use by another worktree. Ports 3040 and 3041 were not used. qa-reviewer was not run. F4, F5, F6, and F7 are not in this change. PR #126 stays draft.
