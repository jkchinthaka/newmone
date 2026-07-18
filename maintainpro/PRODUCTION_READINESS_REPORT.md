# Production Readiness Report

**Branch:** `fix/enterprise-production-hardening`
**Focus of this iteration:** tenant-isolation migration + cross-tenant FK validation + regression gate.

## Verification (this iteration)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck (api + web) | `npm run typecheck` | PASS |
| Unit/integration tests | `npm run test` | PASS — 850/850 (129 suites) |
| Tenant fail-open guard | `npm run audit:tenant` | PASS — 0 unapproved (132 grandfathered) |
| FK validation tests | `jest tenant-fk-validation` | PASS — 11/11 |
| Vehicle phase2 (fail-closed) | `jest vehicles-phase2` | PASS — 22/22 |

`npm run build` and `npm run lint` were not re-run at the end of this report; `lint` is an alias of
`typecheck` (which passed). Re-run `npm run build` before merge.

## Tenant isolation status

- **Migrated to fail-closed:** assets, vehicles, fleet, departments, job-codes (with cross-tenant
  FK validation on their relations).
- **Remaining fail-open (production blockers):** cleaning, utilities, people, operations, workforce,
  compliance, auth invitation, farm/*.
- **Actor-guard-protected pending:** work-orders/*, work-order-taxonomy, inventory, users.
- **Platform/super-admin (approved, decorator refactor pending):** reports/*,
  management-intelligence, post-go-live/*, go-live/pilot-rollout, qa, delivery-readiness.

See `docs/audits/tenant-query-migration-audit.md` for the per-file inventory.

## Regression prevention

- `scripts/audit-tenant-queries.mjs` fails CI on any new fail-open tenant pattern.
- Wired into `.github/workflows/pr-validation.yml` ahead of lint/typecheck/test/build.

## Known limitations / open risks

- 132 fail-open literals remain (grandfathered); guard blocks tenantless non-super-admins, but
  service-level literals are not yet fail-closed in unmigrated modules.
- Cross-tenant FK validation not yet applied to work-orders, inventory, procurement, facilities,
  cleaning, accidents, fines, evidence, ERP relations.
- `npm audit` still reports outstanding dependency vulnerabilities (operator-owned, tracked
  separately).

## Verdict

**NO-GO.** Critical tenant-owned business modules remain fail-open and cross-tenant FK validation is
incomplete.