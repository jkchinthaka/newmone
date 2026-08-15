# ADR-029 — Bileeta / ERP integration boundary (evidence-gated)

**Status:** Accepted (adapter contracts + mocks only; live blocked)  
**Date:** 2026-08-10  
**Phase:** 17

## Context

Automatic production-batch ingestion and any outbound QA disposition to ERP/Bileeta require a real vendor contract. APR-011 / APR-012 / ASM-014 remain **EVIDENCE REQUIRED**. Inventing endpoints, auth flows, or payload schemas would violate project constitution.

## Decision

1. Introduce `apps.integrations` as the anti-corruption layer. Domain checklist models/views must not embed ERP HTTP logic.
2. Maintain a **vendor evidence register** (API docs, sandbox, auth, base URL, batch/product endpoints, rate limits, error format, support owner). Live HTTP is forbidden until every item is PRESENT.
3. Implement **mock/contract adapters** and inbound DTOs aligned to the Phase 07F technical consumer (`source_event_id`, `external_batch_id`, org/product/site/shift/line keys). Quantity/UOM/production-date/vendor status remain EVIDENCE REQUIRED candidates and do not drive domain behaviour.
4. Unknown external codes fail into mapping/dead-letter states — **no guessed mapping**.
5. Secrets only via environment/vault placeholders (`BILEETA_CLIENT_*`); TLS verification required; timeouts configured; secret redaction for logs/metadata.
6. Reliability primitives: idempotent `IntegrationAttempt`, retry/backoff policy, dead-letter status, correlation id, internal error classification.
7. Outbound RELEASE/HOLD/REJECT command interface is **prepared only**; `send_disposition_to_erp` always refuses until APR-017.
8. Reconciliation inspects local `ExternalBatchEvent` receipts for duplicates, mapping failures, and batch mismatches.

## Consequences

- **STATUS: PHASE 17 BLOCKED — VENDOR API EVIDENCE REQUIRED** until owners supply artefacts.
- Factory-floor recording remains independent of ERP availability (constitution).
- Completing evidence later requires updating the register and an approved endpoint catalogue — still no invented URLs in code.
