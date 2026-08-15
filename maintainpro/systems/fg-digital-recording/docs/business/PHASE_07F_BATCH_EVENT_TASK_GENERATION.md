# Phase 07F — Batch Event → Checklist Task Generation (Adapter Boundary)

**STATUS: PHASE 07F LIVE BATCH CONTRACT REQUIRED**

**Document status:** Technical adapter boundary — **not** live ERP/Bileeta integration  
**Related:** [PRODUCTION_BATCH_SOURCE_CONTRACT.md](../integration/PRODUCTION_BATCH_SOURCE_CONTRACT.md), APR-011, ADR-012, Phases 07B–07E

## Purpose

Provide a safe internal boundary that converts a **technical** external batch event into a `ChecklistTask` when mappings, applicability, and effective version all resolve cleanly.

## Flow

```
ExternalBatchEventInput
  → Organization / Product / Site / Shift mapping
  → Applicability (ONE_MATCH required)
  → Effective Version (ONE_ELIGIBLE required — Phase 07D)
  → ChecklistTask (idempotent)
```

## External identity

| Field | Role |
| --- | --- |
| `source_system` | Opaque configured source label (not a URL/credential) |
| `source_event_id` | Idempotency key with `source_system` |
| `external_batch_id` | Maps to `ChecklistTask.batch_reference` |

## Mapping

Administrator-configured `ExternalBatchMapping` rows resolve external keys to internal entities.

Unknown keys → `MAPPING_FAILED`. No `ChecklistTask` is created.

`external_line_key` is stored as an opaque string only. Production Line master remains EVIDENCE REQUIRED and does not participate in applicability.

## Failure and retry

| Status | Meaning |
| --- | --- |
| `MAPPING_FAILED` | Unknown/inactive mapping |
| `APPLICABILITY_FAILED` | Not exactly ONE_MATCH |
| `VERSION_FAILED` | Effective-version overlap / none / conflict |
| `COMPLETED` | Task created or idempotently returned |

Failed receipts leave **no** partially configured task. Safe retry reuses the same `(source_system, source_event_id)` after mapping correction (`attempt_count` increments).

## Idempotency

Duplicate completed events return the existing task and audit `EXTERNAL_BATCH_EVENT_DUPLICATE`. Concurrent duplicate events serialize on the intake row and create at most one task.

## Security / audit

Audit metadata uses safe identifiers only (`source_system`, `source_event_id`, `external_batch_id`, UUIDs, status codes). No secrets, tokens, or auth headers.

## Explicit non-implementation

- No live Bileeta/ERP connector
- No webhook endpoint, polling worker, or Celery ingestion of production events
- No invented endpoints, credentials, or vendor payload schemas presented as facts
- Production automatic generation remains **BLOCKED** until APR-011 contract evidence exists

## Code

| Piece | Location |
| --- | --- |
| Models | `ExternalBatchMapping`, `ExternalBatchEvent` |
| Service | `apps.scheduling.batch_events` |
| Port | `apps.scheduling.integration.accept_external_batch_event` |
| Tests | `apps/scheduling/tests/test_phase07f_batch_event_generation.py` |
