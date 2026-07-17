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
3. **Tests:** `tenant-context-fail-closed.spec.ts` + module isolation specs.

## Remaining work

- Migrate remaining ~100 fail-open service spreads to `requireTenantId()`.
- Cross-tenant FK validation on create/update for assets, work orders, inventory, etc.
- Expand isolation matrix to all critical modules.