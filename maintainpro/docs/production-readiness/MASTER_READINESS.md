# Master readiness — enterprise operations program

Date: 2026-08-18
Branch: `fix/live-production-remediation`

## Capability status

| Capability | Status | Notes |
|---|---|---|
| Central business rules | IMPLEMENTED | `apps/api/src/modules/policies` |
| State machines | IMPLEMENTED | Reuses existing enums |
| Master data governance | EXTENDED | Mapping queue from ERP mismatches |
| Domain events / outbox | IMPLEMENTED | `DomainEventOutbox` distinct from replication |
| Inventory reservation / available stock | REUSED + WIRED | Existing engine now throws policy codes |
| ERP reconciliation cases | EXTENDED | Detect without auto-adjust; sample seed gated |
| PM auto-advance + forecast | IMPLEMENTED | Default ACTUAL_COMPLETION |
| SLA + business calendar | IMPLEMENTED | Tenant policy; weekends/holidays configurable |
| Approval / delegation matrix | IMPLEMENTED | Maker-checker + amount limits |
| Technician dispatch | IMPLEMENTED | Recommendations only |
| Notification / escalation | IMPLEMENTED | Domain events on existing Notification + Bull |
| Cost allocation / cost per vehicle | EXTENDED | Null cost/km when distance missing |
| Budget / commitments | IMPLEMENTED | Open approved POs; no budget = INSUFFICIENT_DATA |
| Data quality / exceptions | IMPLEMENTED | `BusinessException` queue + UI |
| Warranty + compatibility | IMPLEMENTED | UNKNOWN is not incompatible |
| Vehicle / asset health / repeat failure | IMPLEMENTED | Explainable score, not a gate |
| Procurement recommendations | IMPLEMENTED | No automatic purchase |
| PO 3-way match | PARTIAL | PO vs GRN live; invoice side INSUFFICIENT_DATA |
| Vendor eligibility | PARTIAL | Active/blacklist enforced; contract dates not on Supplier |
| Permit-to-work | POLICY_ONLY | Strict mode off until safety values are approved |
| Fleet driver / trip / fuel | EXTENDED | Conflict, meter, duplicate, clientActionId |
| Accident / claim / fine | REUSED | Existing modules + explicit state machines |
| Offline sync | EXTENDED | Server revalidation + fuel clientActionId |

## Gates (this slice)

Observed locally on 2026-08-18 after `prisma generate`:

- TYPECHECK=PASS
- LINT=PASS
- RBAC=PASS (`npm run audit:rbac`, 697 routes, 0 violations)
- TENANT=PASS (`npm run audit:tenant`)
- FULL_TESTS=PASS (163 suites / 1132 tests)
- BUILD=PASS (`npm run build`, Next.js 143 pages)

Production schema is **not** pushed. Disposable Mongo `db push` is required before live schema apply.

Unrelated FG native UI remains flag-off until Combined-Release Django JSON API is merged.

## Production

PRODUCTION_DEPLOY=NOT_ATTEMPTED
Schema rollback: new collections/fields are additive; disable `/enterprise-ops` usage and stop writing new models if rolled back. Do not drop collections that already contain live exceptions.
