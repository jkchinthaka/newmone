# Tenant Isolation Design

**Status:** Partially implemented (Phase 2 foundation)  
**Branch:** `fix/enterprise-production-hardening`

## Policy

| Decorator | Who | Tenant required? | Notes |
|-----------|-----|------------------|-------|
| Default (authenticated) | All roles | **Yes** (403 if missing) | After membership auto-resolve |
| `@TenantScoped()` | Business modules | Yes | Explicit documentation of default |
| `@PlatformScoped()` | SUPER_ADMIN only | Optional | Cross-tenant platform admin |
| `@SkipTenantContext()` | Explicit opt-out | Non-SUPER_ADMIN still require membership tenant | Must not grant silent global reads |
| `@Public()` | Anonymous | N/A | Auth/health/webhooks |

## Enforcement layers

1. **Guard:** `TenantContextGuard` fails closed when no tenant can be resolved.
2. **Helper:** `requireTenantId()` / `tenantWhere()` — services must not use `...(tenantId ? { tenantId } : {})`.
3. **Cross-tenant FK validation:** `assertTenantEntityExists()`, `findTenantEntityOrThrow()`,
   `assertTenantEntitiesExist()` (in `common/utils/tenant-scope.util.ts`). These require an active
   tenant, query by both `id` and `tenantId`, support single and batch ids, and raise a
   non-enumerating `NotFoundException` so callers cannot detect ids owned by another tenant.
4. **Tests:** `tenant-context-fail-closed.spec.ts`, `tenant-fk-validation.spec.ts`, and per-module
   isolation specs (`*-tenant-isolation.spec.ts`).
5. **Regression gate:** `scripts/audit-tenant-queries.mjs` (`npm run audit:tenant`) blocks new
   fail-open patterns in CI; approved/pending exceptions live in
   `scripts/tenant-audit-exceptions.json`.

## Platform exceptions

Platform-level access without a tenant is only allowed on routes explicitly marked
`@PlatformScoped()` / `@SkipTenantContext()` AND restricted to `SUPER_ADMIN`. Any service-level
fail-open that currently relies on super-admin scope is tracked in the exceptions registry with
`scope: platform-super-admin` and must be refactored to an explicit platform decorator.

## Migration status (see `tenant-query-migration-audit.md`)

- **Migrated (fail-closed):** assets, vehicles, fleet, departments, job-codes (+ FK validation).
- **Pending (production blockers):** cleaning, utilities, people, operations, workforce, compliance,
  auth invitation, farm/*.
- **Actor-guard-protected pending:** work-orders/*, work-order-taxonomy, inventory, users.
- **Platform (approved, refactor pending):** reports/*, management-intelligence, post-go-live/*,
  go-live/pilot-rollout, qa, delivery-readiness.

## Known limitations

- 132 fail-open literals remain (grandfathered in the exceptions registry). The guard blocks
  tenantless non-super-admin requests at the boundary, but the service-level literals are not yet
  fail-closed, so a null-tenant or super-admin cross-tenant path is still theoretically reachable in
  unmigrated modules.
- Cross-tenant FK validation is only applied in migrated modules; relation writes in unmigrated
  modules still trust frontend-supplied ids.

**Tenant isolation is NOT complete — verdict remains NO-GO.**