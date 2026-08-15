# ADR-047 — Batch Genealogy Traceability

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 36  

## Context

Traceability, ERP integration, data architecture, and QA need backward and
forward product genealogy (FG ↔ materials ↔ suppliers; materials ↔ batches ↔
shipments) without inventing links or embedding unbounded graphs.

## Decision

1. New modular-monolith app `apps.batch_genealogy` stores **opaque** genealogy
   nodes and directed ERP-sourced edges in **PostgreSQL** (ADR-002 SoR).
2. Node kinds cover: raw material lot, supplier lot, production batch, rework
   batch, FG batch, sub-lot/pallet, shipment/customer reference.
3. Edges require `source_system` + `source_event_id` (idempotent). Genealogy is
   **never invented** locally.
4. Backward/forward traces use **bounded batched BFS** with cycle prevention on
   ingest; rework edges preserve parent→child (`REWORKED_FROM` / `is_rework`).
5. Supplier/customer fields are **restricted** (`view_genealogy_partner`);
   redacted by default.
6. Mongo representation is a **flat edge-list / node document projection** only —
   never unbounded embedded trees. Projection is dual-gated OFF
   (`BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED` + org policy; APR-061).
7. Opaque keys align with existing `batch_reference` / ERP external ids — no
   ProductionBatch master.

## Consequences

- Live ERP genealogy mapping and partner-reveal/Mongo cutover remain
  **EVIDENCE REQUIRED** (APR-061).
- PostgreSQL remains SoR; Mongo stays optional projection (APR-020 PENDING).

## Related

- ADR-002 PostgreSQL SoR, ADR-018 Mongo POC, ADR-029 integrations, ADR-046 EBR
