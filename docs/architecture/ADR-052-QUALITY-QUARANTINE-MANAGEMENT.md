# ADR-052 — Quality Quarantine Management

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 41  

## Context

QA Quarantine, Warehouse Integration, Traceability, and Security teams need an
application-side quality quarantine state for batch/sub-lot references. ERP
remains the authoritative inventory ledger for quantity and location. This
application must not duplicate inventory and must not release quarantine from
checklist PASS alone.

## Decision

1. New modular-monolith app `apps.quality_quarantine` stores organization-scoped
   quarantine records with code, batch/sub-lot, optional quantity/UOM references
   (org-policy gated), source, reason, opened_by/opened_at, owner, status, and
   resolution fields.
2. Supported technical source kinds: QA_HOLD, RETURNED_PRODUCT,
   INCOMING_INSPECTION, LAB_PENDING, NCR, MANUAL — opaque references only; no
   invented catalogues.
3. Inventory boundary: `not_inventory_ledger=True` invariant. Quantity fields are
   quality references only and never become an inventory ledger.
4. ERP sync status is tracked separately as NOT_SENT / PENDING / CONFIRMED /
   FAILED. Outbound sync is dual-gated OFF
   (`QUALITY_QUARANTINE_ERP_SYNC_APPROVED` + org policy stub); prepare-only
   boundary refuses transmission until integration evidence exists.
5. Release requires explicit `release_qualityquarantine` permission and
   `QUALITY_QUARANTINE_RELEASE_APPROVED` (default OFF). Checklist PASS metadata
   never auto-releases.
6. History is append-only via `QualityQuarantineEvent` (no update/delete).
   Opening identity fields are immutable after resolution.

## Consequences

- Quarantine release SOP, quantity-recording policy, and ERP sync enablement
  remain **EVIDENCE REQUIRED** (APR-066).
- Warehouse ERP inventory quantity/location remain outside this module.

## Related

- ADR-018 NCR/Hold, ADR-044 IQC, ADR-051 Returned product quality
