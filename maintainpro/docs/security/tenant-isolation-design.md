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

**NO-GO.** 132 fail-open literals remain across 40 files; cross-tenant FK validation is applied only
to migrated modules (assets, vehicles, fleet, departments, job-codes). Do not claim tenant isolation
is complete until the tenant-owned business modules listed in the migration audit are fail-closed.