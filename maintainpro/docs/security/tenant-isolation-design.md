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

**NO-GO.** `npm run audit:tenant` reports **0 unapproved** fail-open patterns (67 approved
platform/super-admin + shared-reference exceptions remain, tracked in the registry). Fail-closed
enforcement with cross-tenant FK validation now covers assets, vehicles, fleet, departments,
job-codes, work-orders (+ sub-services), inventory, users, people, workforce, **cleaning,
utilities, operations, compliance, accidents, insurance-claims, traffic-fines and vehicle
documents**.

The verdict stays NO-GO because the **farm/\*** tenant-owned modules (14 fail-open occurrences)
remain unmigrated. Do not claim tenant isolation is complete until the farm modules listed in the
migration audit are fail-closed with cross-tenant FK validation.