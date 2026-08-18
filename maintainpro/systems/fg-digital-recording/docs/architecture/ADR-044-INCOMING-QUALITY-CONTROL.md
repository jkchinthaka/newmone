# ADR-044 — Incoming Quality Control (IQC) workflow

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 33

## Context

Incoming inspection must orchestrate ERP receipt/GRN events into checklist tasks,
optional sampling and LIMS links, supervisor review, and local quality disposition
without inventing inspection questions or updating ERP stock without approval.

## Decision

1. Introduce `apps.iqc` as workflow orchestration over Phase 31 `receiving`,
   Phase 32 `supplier_quality`, checklist engine, Phase 24 sampling, and Phase 22 LIMS.
2. `IncomingReceiptEvent` provides idempotent `(source_system, source_event_id)` ingest.
3. `IqcInspectionCase` preserves supplier lot → receipt → task → review → decision
   in frozen traceability context.
4. IQC tasks use existing PUBLISHED checklist versions — no hardcoded questions.
5. Sampling uses `resolve_sampling_requirement` (advisory; not QA disposition).
6. Disposition is local only; ERP outbound dual-gated OFF (`IQC_ERP_OUTBOUND_APPROVED`
   + org policy; Phase 17 adapter still required).

## Consequences

- Company IQC checklists, sampling tables, review SoD, and ERP stock effects remain
  **EVIDENCE REQUIRED** (APR-058).
