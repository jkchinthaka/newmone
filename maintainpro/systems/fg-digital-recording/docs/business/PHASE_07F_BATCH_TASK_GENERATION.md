# Phase 07F — Batch Event → ChecklistTask Adapter Boundary

**Document status:** Technical adapter boundary — **not** a live ERP/Bileeta connector  
**Phase:** 07F  
**Related:** ADR-011; ADR-012; [PRODUCTION_BATCH_SOURCE_CONTRACT.md](../integration/PRODUCTION_BATCH_SOURCE_CONTRACT.md); Phases 07A–07E

---

## Prerequisite gate

A **real or formally approved** production-batch integration contract (APR-011 / APR-012 / DL-045) does **not** exist in this repository.

Therefore Phase 07F implements **only** the adapter/service boundary and **stops before live integration**:

- No webhook endpoint
- No polling worker
- No Bileeta/ERP HTTP client
- No invented URLs, credentials, or vendor payload samples presented as facts

## Flow (when a contract is later approved)

```
External Batch Event
  → Organization / Product (/ Site / Shift) mapping
  → Applicability (ONE_MATCH required)
  → Effective Version (ONE_ELIGIBLE required)
  → ChecklistTask (idempotent)
```

## External identity

| Field | Role |
| --- | --- |
| `source_system` | Opaque source-system label |
| `source_event_id` | Idempotency key with `source_system` |
| `external_batch_id` | Maps to `ChecklistTask.batch_reference` |

## Mapping

Administrator-configured `ExternalBatchMapping` rows resolve external keys. Unknown keys → `MAPPING_FAILED`. No partial `ChecklistTask` is created.

## Idempotency & retry

- Duplicate `(source_system, source_event_id)` returns the completed event / same task.
- Failed intakes (`MAPPING_FAILED` / `APPLICABILITY_FAILED` / `VERSION_FAILED`) are safely retriable after configuration correction.

## Security / audit

Audit metadata uses safe identifiers only (`source_system`, `source_event_id`, `external_batch_id`, org/product/task UUIDs). No secrets, tokens, or auth headers.

## Code entrypoints

- `apps.scheduling.integration.accept_external_batch_event`
- `apps.scheduling.batch_events.process_external_batch_event`
- `apps.scheduling.batch_events.upsert_external_batch_mapping`

---

## STATUS: PHASE 07F LIVE BATCH CONTRACT REQUIRED
