# Phase 36 — Batch Genealogy Traceability

**Document status:** Technical foundation — company ERP genealogy mapping **not** seeded  
**Phase:** 36  
**ADR:** [ADR-047-BATCH-GENEALOGY-TRACEABILITY.md](../architecture/ADR-047-BATCH-GENEALOGY-TRACEABILITY.md)

## Intent

Support backward and forward product genealogy using authoritative ERP/production data.

## Delivered

| Area | Status |
| --- | --- |
| Generic opaque node kinds (material/supplier/production/rework/FG/sub-lot/shipment) | TECHNICALLY SUPPORTED |
| Backward trace (FG → materials → supplier/receipt) | TECHNICALLY SUPPORTED |
| Forward trace (material → batches → shipments) | TECHNICALLY SUPPORTED |
| Rework parent-child + cycle prevention | TECHNICALLY SUPPORTED |
| Flat Mongo projection (no unbounded embeds); dual-gate OFF | TECHNICALLY SUPPORTED |
| Partner (supplier/customer) field restriction | TECHNICALLY SUPPORTED |

## Explicit non-claims

- Does not invent genealogy without ERP `source_system` / `source_event_id`
- Does not embed unbounded ancestor/descendant trees in Mongo
- Does not introduce a ProductionBatch master
- Does not enable live ERP pull beyond existing Phase 17 gates

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED` | `false` | Gates optional Mongo flat projection writes |

## STATUS: PHASE 36 BATCH GENEALOGY COMPLETE
