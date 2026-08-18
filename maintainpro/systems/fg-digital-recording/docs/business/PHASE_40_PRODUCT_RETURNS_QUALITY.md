# Phase 40 — Returned Product Quality

**Status:** Technical foundation complete  
**ADR:** ADR-051  
**Approval gate:** APR-065 (return disposition / quarantine / ERP stock — EVIDENCE REQUIRED)

## Scope delivered

- ERP/SFA return document mapping into local return quality records
- Quarantine on receipt (`not_saleable_via_app`); optional HoldCase link
- Checklist-engine inspection tasks
- Disposition architecture: RELEASE / HOLD / REWORK / REJECT (policy allow-list)
- Dual-gate ERP stock movement OFF by default
- Original batch + return provenance retained

## Explicitly not delivered / gated

- Company-approved disposition path catalogue (APR-065)
- Quarantine duration / warehouse location rules
- ERP stock movement enablement (APR-065)
- Any claim that RELEASE makes stock saleable in ERP

## Tests

`apps/product_returns/tests/test_phase40_product_returns.py` — mapping,
quantity, inspection, quarantine, disposition, ERP disabled, cross-org.

## STATUS: PHASE 40 PRODUCT RETURNS QUALITY COMPLETE
