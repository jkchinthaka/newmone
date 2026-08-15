# ADR-043 — Raw / material receiving quality foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 31

## Context

Incoming material quality must be recorded against ERP receipts without replacing
ERP inventory ownership. Material catalogues, specification limits, and stock
state remain company/ERP evidence.

## Decision

1. Introduce `apps.receiving` with `MaterialReference` as a thin ERP-mapped shell
   (preferred key: `erp_material_reference`) — not an inventory master.
2. `ReceiptQualityRecord` captures GRN/receipt reference, supplier profile,
   supplier lot, material, quantity/UOM, received date, inspection checklist,
   optional approved material specification version, evidence, and local
   quality state.
3. Local quality states: `PENDING_INSPECTION`, `ACCEPTED`, `HOLD`, `REJECTED`.
   These do **not** update ERP stock.
4. Versioned `MaterialSpecification` / version / parameter shells — no seeded limits.
5. `ReceiptLabSampleLink` + `register_incoming_lab_sample` reuse Phase 22 LIMS.
6. ERP outbound is prepare-only and always blocked pending Phase 17 contract
   (APR-011/017).

## Consequences

- Company material catalogues, incoming specs, and ERP quality/stock effects
  remain **EVIDENCE REQUIRED** (APR-057).
- Reuses `SupplierQualityProfile` — does not invent a second supplier master.
