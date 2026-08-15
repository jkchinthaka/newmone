# ADR-020 — Supplier Quality Reference Foundation

**Status:** Accepted (technical foundation) — **not** BUSINESS APPROVED / not UAT  
**Date:** 2026-08-10  
**Phase:** 32 (technical)  
**Does not invent:** certificate catalogues, approval matrices, supplier scorecards, ERP payload shapes

## Context

Procurement and QA need supplier-related quality records without creating a competing commercial/financial supplier master. ERP (e.g. Bileeta) remains the commercial SoR for suppliers. NCR/CAPA modules were not previously implemented; this phase adds **minimal generic** NCR/CAPA identity so supplier events can link without inventing HOLD/CAPA automation.

## Decision

1. Introduce `supplier_quality.SupplierQualityProfile` keyed by `(organization, erp_supplier_reference)`.
2. Profiles store optional display labels and free-form `quality_status` text — **no seeded official status catalogue**.
3. Certificates store configurable `certificate_type` strings, optional dates, object-storage evidence key, and verification metadata.
4. Quality events may link to `nonconformance.NonConformanceRecord` and `capa.CorrectiveAction`.
5. Metrics are **count-derived only** (certificates, expiry, events, linked open NCR/CAPA). No invented score or threshold.
6. Permissions separate QA manage (`manage_supplierquality_qa`) from Procurement view (`view_supplierquality_procurement`).
7. No hard delete of operational supplier quality / NCR / CAPA rows via admin.

## Consequences

- ERP connector still required for live supplier sync (Phase 17) — this phase stores references only.
- Evidence module (Phase 11) still owns real file upload; certificates store object keys only.
- Full Phase 12 NCR/CAPA workflow depth remains future work; current NCR/CAPA are identity foundations.
- Official certificate types and approval statuses remain **COMPANY EVIDENCE REQUIRED**.

## References

- MODULE_MAP `supplier_quality`, `nonconformance`, `capa`, `integrations`
- [PHASE_32_SUPPLIER_QUALITY_FOUNDATION.md](../business/PHASE_32_SUPPLIER_QUALITY_FOUNDATION.md)
