# Master readiness — enterprise operations program

Date: 2026-08-18
Branch: `fix/live-production-remediation`

## Capability status

| Capability | Status | Notes |
|---|---|---|
| Central business rules | IMPLEMENTED | `apps/api/src/modules/policies` |
| Inventory reservation / available stock | REUSED + WIRED | Existing engine now throws policy codes |
| ERP reconciliation cases | EXTENDED | Detect without auto-adjust; sample seed gated |
| PM auto-advance + forecast | IMPLEMENTED | Default ACTUAL_COMPLETION |
| Notification / escalation | IMPLEMENTED | Domain events on existing Notification + Bull |
| Cost allocation / cost per vehicle | EXTENDED | Null cost/km when distance missing |
| Data quality / exceptions | IMPLEMENTED | `BusinessException` queue + UI |
| Warranty + compatibility | IMPLEMENTED | UNKNOWN is not incompatible |
| Vehicle health / repeat failure | IMPLEMENTED | Explainable score, not a gate |
| Procurement recommendations | IMPLEMENTED | No automatic purchase |

## Gates (this slice)

Observed locally on 2026-08-18 after `prisma generate`:

- TYPECHECK=PASS (prior to final commit; `npm run lint` aliases typecheck)
- RBAC=PASS (`npm run audit:rbac`, 688 routes, 0 violations)
- TENANT=PASS (`npm run audit:tenant`)
- FULL_TESTS=PASS (162 suites / 1121 tests)
- BUILD=PASS (`npm run build`, Next.js 137 pages)

Production schema is **not** pushed. Disposable Mongo `db push` is required before live schema apply.

Unrelated FG native UI remains flag-off until Combined-Release Django JSON API is merged.

## Production

PRODUCTION_DEPLOY=NOT_ATTEMPTED
Schema rollback: new collections/fields are additive; disable `/enterprise-ops` usage and stop writing new models if rolled back. Do not drop collections that already contain live exceptions.
