# Threat Model (Authorization & Multi-Tenancy)

Scope: authorization and tenant-isolation threats for the MaintainPro API. This is
a focused model that complements `authorization-model.md`,
`platform-scope-policy.md`, `tenant-isolation-design.md` and
`farm-tenant-isolation.md`.

## Assets

- Tenant business data (work orders, inventory, fleet, compliance, farm, finance).
- User identities, sessions, roles and memberships.
- Platform/cross-tenant reporting and administration surfaces.
- Payment/billing data and provider integrations (Stripe).
- Audit trail and replicated backup data.

## Trust boundaries

1. Unauthenticated internet -> `@Public()` routes (auth, health, signed webhooks,
   public traceability lookup).
2. Authenticated tenant user -> tenant-scoped and self-service routes.
3. SUPER_ADMIN -> platform-scoped routes and explicit tenant selection.
4. API -> primary/backup MongoDB and external providers.

## Threats and controls

| # | Threat | Control |
|---|--------|---------|
| T1 | Cross-tenant data access (IDOR) | Fail-closed `requireTenantId()` + `tenantWhere()` + cross-tenant FK validation; `npm run audit:tenant` CI gate. |
| T2 | Unscoped/unprotected route reaching business data | Every route carries an explicit scope; `npm run audit:rbac` fails CI on unscoped routes. |
| T3 | Privilege escalation via missing role/permission | Global `RolesGuard` + `PermissionsGuard`; object-level checks in services (maker-checker, SoD). |
| T4 | Tenant user reaching platform/cross-tenant data | `@PlatformScoped()` + `SUPER_ADMIN`; audit fails platform routes lacking SUPER_ADMIN. |
| T5 | Forged/replayed payment webhook | `@PublicWebhook('stripe')` + mandatory signature verification in live mode (fails closed without secret); event allowlist; tenant resolved from verified customer mapping. (Replay/idempotency window: tracked remaining work.) |
| T6 | Self-service route trusting client-supplied identity | `@SelfService()` handlers derive the subject from `req.user.sub`, never from a client id. |
| T7 | Sensitive data leakage via export/audit/replication | Field allowlist + `sensitive-data-redaction.util.ts` before serialization/persistence; see `export-and-bulk-action-policy.md`. |
| T8 | Tenant switching to a tenant without active membership | `TenantContextGuard` requires active membership in an active tenant; audited. |
| T9 | Health/readiness info disclosure | `GET /health` must not expose secrets, connection strings, stack traces or topology. |
| T10 | Authorization regression over time | CI gates (`audit:tenant`, `audit:rbac`) + reviewed, expiring exception registries. |

## Residual risks (open)

- Cross-tenant reporting services retain a documented dual-scope query path
  (compensating controls in `platform-scope-policy.md`); target is explicit
  fail-closed + `@PlatformScoped()` split.
- Stripe webhook lacks an explicit replay/idempotency window.
- Cookie-only auth, CSP, dependency vulnerabilities, backup/restore and
  observability remain go-live blockers (see `PRODUCTION_READINESS_REPORT.md`).
