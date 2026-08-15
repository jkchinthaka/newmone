# Phase 17 — Bileeta / ERP Integration Boundary

**Document status:** Adapter contracts + mocks — live vendor API **blocked**  
**Phase:** 17  
**ADR:** [ADR-029-BILEETA-INTEGRATION-BOUNDARY.md](../architecture/ADR-029-BILEETA-INTEGRATION-BOUNDARY.md)

## Vendor evidence gate

| Item | Status |
| --- | --- |
| API docs | MISSING (APR-012) |
| Sandbox / test environment | MISSING |
| Auth method | MISSING |
| Base URL | MISSING |
| Batch/product endpoints | MISSING (APR-011) |
| Rate limits | MISSING |
| Error format | MISSING |
| Support owner | MISSING (APR-016) |

## Delivered (without live calls)

- `apps.integrations` anti-corruption layer
- Inbound contract → `scheduling.accept_external_batch_event`
- Mock adapter (timeout / auth / rate-limit / success)
- Live client hard-gated (`BILEETA_LIVE_ENABLED` default false + evidence assert)
- Idempotent attempts, retry/backoff, dead-letter, correlation id
- Outbound disposition command interface — send refused (APR-017)
- Reconciliation for duplicate / mapping-failed / mismatched local events
- Secret redaction helpers; env placeholders only
- Tests: contract, mock sandbox behaviours, timeout/retry, duplicate, bad mapping, auth/rate-limit, redaction, live refuse

## Explicit non-implementation

- No invented Bileeta endpoint paths
- No live polling/webhooks/credentials
- No direct ERP database writes
- No outbound RELEASE/HOLD/REJECT transmission

## STATUS: PHASE 17 BLOCKED — VENDOR API EVIDENCE REQUIRED
