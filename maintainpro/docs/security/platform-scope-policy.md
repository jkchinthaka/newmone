# Platform-Scope Policy

Defines how platform (cross-tenant / super-admin) surfaces are authorized, and how
they differ from tenant-scoped and self-service routes.

## Definitions

- **Tenant scope** (`@TenantScoped()` or `@Roles`/`@Permissions` on a tenant
  controller): requires an active tenant and active membership. Operates only on
  active-tenant records. SUPER_ADMIN does not get implicit global access; a
  SUPER_ADMIN performing tenant business must explicitly select a tenant
  (`X-Tenant-Id`), which `TenantContextGuard` resolves.

- **Platform scope** (`@PlatformScoped()` + `@Roles('SUPER_ADMIN')`): requires
  `SUPER_ADMIN`, rejects normal tenant users, is audited, and may access
  cross-tenant/platform data only for a documented business purpose. Must not be
  reachable through an ordinary tenant-scoped service.

- **Public** (`@Public()`): unauthenticated transport only. Must not expose
  business data. Webhooks additionally require `@PublicWebhook(provider)` and
  provider signature verification. Health endpoints must not expose secrets,
  connection strings, credentials, stack traces, internal hostnames, or detailed
  dependency topology.

`@SkipTenantContext()` is not a platform-authorization mechanism. It only skips
tenant resolution (used by genuinely tenant-agnostic self endpoints such as
`GET /auth/me` and the SUPER_ADMIN tenant-listing console). It must always be
paired with an explicit scope (`@SelfService()`, `@Roles`, or `@PlatformScoped()`).

## Enforcement

`scripts/audit-rbac.mjs` (CI gate: `npm run audit:rbac`) fails when:

- a non-public route has no explicit scope;
- a `@PlatformScoped()` route's `@Roles` does not include `SUPER_ADMIN`;
- a `@Public()` webhook route lacks `@PublicWebhook(provider)`.

Exceptions require a reviewed entry in `scripts/rbac-audit-exceptions.json` with an
owner, compensating control and expiry date. Expired exceptions are ignored and
the audit fails.

## Current platform routes

| Route | Scope | Authorization |
|-------|-------|---------------|
| `GET /admin/replication/status` | platform | `@PlatformScoped()` + `@Roles('SUPER_ADMIN')` + `@Permissions('settings.system.manage')` |
| `GET /admin/tenants` (and admin console) | platform | `@SkipTenantContext()` + `@Roles(SUPER_ADMIN, ADMIN)` |

## Cross-tenant reporting services (retained dual-scope)

The following services read across tenant scope for platform/ops reporting and are
registered in `scripts/tenant-audit-exceptions.json`:

- `go-live/pilot-rollout.service.ts`
- `post-go-live/{change-requests,hypercare,releases,support-tickets,training}.service.ts`
- `qa/qa-issues.service.ts`
- `management-intelligence/management-intelligence.service.ts`
- `reports/{maintenance-reports,reports}.service.ts`
- `delivery-readiness/delivery-readiness.service.ts`
- `work-order-taxonomy/work-order-taxonomy.service.ts` (shared reference data)

**Compensating controls today:** their controllers are permission-gated
(`go_live.*`, `delivery.*`, `REPORT_ROLES`, `MANAGEMENT_ROLES`, ...), and
`TenantContextGuard` forces a resolvable active tenant for non-SUPER_ADMIN callers,
so the unfiltered path is not reachable as an anonymous cross-tenant read.

**Target end state (remaining work):** split each into an explicit fail-closed
tenant path (`requireTenantId()`) and an explicit `@PlatformScoped()` platform path,
then remove the corresponding tenant-audit exception entries. This is tracked in
`docs/audits/rbac-platform-scope-migration.md` and `PRODUCTION_READINESS_REPORT.md`.

## Scheduled / provider jobs

Jobs that touch every tenant's data must not be callable as ordinary tenant-user
endpoints. `farm/weather` provider polling (`pollOpenWeather`) is
`@PlatformScoped()` + `@Roles('SUPER_ADMIN')` and fans out per tenant. New
scheduled work must use internal worker execution, a signed internal request, an
explicit super-admin trigger, or a protected scheduler identity.
