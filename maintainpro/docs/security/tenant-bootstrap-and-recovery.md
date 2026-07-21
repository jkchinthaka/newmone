# Tenant Bootstrap and Recovery

## Required states

`INITIALIZING` → `READY` | `NO_MEMBERSHIP` | `SELECTION_REQUIRED` | `RECOVERING` | `ACCESS_DENIED` | `SESSION_EXPIRED` | `ERROR`

## Startup flow (target)

1. Verify session via `GET /auth/me` (BFF cookies).
2. Load memberships via `GET /tenants/me`.
3. Validate preferred tenant from local preference store.
4. Confirm membership active and tenant active.
5. Auto-select if exactly one membership; otherwise prompt selection.
6. Block business mutations until state is `READY`.

## Recovery

On `TENANT_REQUIRED`, `TENANT_ACCESS_DENIED`, `TENANT_INACTIVE`, `MEMBERSHIP_DISABLED`:

- invalidate active tenant preference
- refetch memberships
- show recovery UI
- preserve unsaved form drafts
- do not auto-retry unsafe mutations

## Current implementation status

- Preferred tenant still stored in `localStorage` (`lib/tenant-context.ts`).
- API client clears tenant on tenant-denial codes.
- Full bootstrap provider / mutation gate remains in progress on this branch.