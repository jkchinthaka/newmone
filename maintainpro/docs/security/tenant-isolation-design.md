# Tenant Isolation Design (Security)

This is the security-owned entry point for tenant isolation. The full design, enforcement layers,
platform exceptions, migration status and known limitations are maintained in:

- `docs/audits/tenant-isolation-design.md` — design and enforcement model
- `docs/audits/tenant-query-migration-audit.md` — per-file fail-open inventory and migration status
- `scripts/tenant-audit-exceptions.json` — machine-readable registry of approved/pending exceptions

## Summary

- Fail-closed at the boundary via `TenantContextGuard`.
- `requireTenantId()` / `tenantWhere()` for all business queries.
- Cross-tenant FK validation via `assertTenantEntityExists` / `findTenantEntityOrThrow` /
  `assertTenantEntitiesExist`.
- CI regression gate: `npm run audit:tenant`.

## Current verdict

**Tenant-isolation migration: COMPLETE.** `npm run audit:tenant` reports **0 unapproved** fail-open
patterns and **0 pending tenant-owned migrations** (52 approved platform/super-admin +
shared-reference exceptions remain, tracked in the registry). Fail-closed enforcement with
cross-tenant FK validation now covers assets, vehicles, fleet, departments, job-codes, work-orders
(+ sub-services), inventory, users, people, workforce, cleaning, utilities, operations, compliance,
accidents, insurance-claims, traffic-fines, vehicle documents, and **all `farm/*` modules** (crops,
fields, harvest, irrigation, livestock, soil-tests, spray-logs, farm-workers, farm-finance,
traceability, weather). See `docs/security/farm-tenant-isolation.md`.

**Overall production verdict: NO-GO.** Tenant isolation being complete does not make the platform
production-ready on its own. Remaining non-tenant blockers: the `@PlatformScoped()` refactor of the
super-admin reporting surfaces (currently APPROVED fail-open exceptions), outstanding `npm audit`
dependency vulnerabilities, and the broader RBAC / cookie-auth / CSP / CI / infrastructure /
backup / observability go-live items tracked in the go-live docs.