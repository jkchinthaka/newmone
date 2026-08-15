# ADR-051 — Returned Product Quality Workflow

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 40  

## Context

Returns, Warehouse, QA, ERP, and Traceability teams need returned finished goods
to enter a controlled local quality assessment workflow. ERP/SFA remains system
of record for return documents and inventory. This application must not make
returned stock saleable or move ERP stock without approved integration evidence.

## Decision

1. New modular-monolith app `apps.product_returns` stores organization-scoped
   return quality records keyed by opaque ERP/SFA return (and optional line)
   references, with product, original batch, quantity/UOM references, customer
   reference, reason/condition/temperature references, optional evidence id,
   and `received_at`.
2. On create, records enter quality quarantine (`QUARANTINED`) with
   `not_saleable_via_app=True`. Optional HoldCase linkage is supported; this
   app never marks stock saleable.
3. Inspection uses the checklist engine via explicit PUBLISHED
   ChecklistTemplate/Version → `create_batch_checklist_task` (original batch
   as batch reference). Checklist item content is owner-configured — never
   invented here.
4. Disposition architecture supports RELEASE / HOLD / REWORK / REJECT as
   technical paths. Organization policy may restrict the allow-list; company
   SOP remains **EVIDENCE REQUIRED** (APR-065). RELEASE is local quality only
   and does not imply ERP saleable status.
5. ERP stock movement is dual-gated OFF:
   `PRODUCT_RETURNS_ERP_STOCK_MOVEMENT_APPROVED` + org policy stub; outbound
   boundary prepares commands but refuses transmission until integration
   approval.
6. Traceability preserves original batch and return provenance in record
   fields and metadata.

## Consequences

- Return disposition SOP, quarantine durations, and ERP movement enablement
  remain **EVIDENCE REQUIRED** (APR-065).
- Evidence binaries remain in object storage; `RETURN_QUALITY_RECORD` is an
  allowlisted linked kind.

## Related

- ADR-033 Receiving, ADR-034 IQC, ADR-018 NCR/Hold, ADR-050 Complaints
