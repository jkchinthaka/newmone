# Procurement Lifecycle Contract (Phase 5C)

Status: CONTRACT_IMPLEMENTED (source) - runtime pending Full-Stack E2E.
Preserve Phase 5B: workflow 30712469601, SHA fe3b3992d883d33c916b3595769add2c4db8878a, totals 103/0/0.

## Path

Work-order part requirement -> PartRequest -> operational approval -> finance (when required) -> PO create -> PO operational approval -> PO finance (when required) -> MOCK ERP submit -> ORDERED -> GRN receipt(s) -> atomic stock-in -> PARTIALLY_RECEIVED / RECEIVED -> audit / notifications.

## Stage summary

- PartRequest: create / approve / finance / reject / issue
- PurchaseOrder: create (server totals, createdById) / operational / finance / reject
- ERP: MOCK only in E2E; idempotent; retry policy
- GRN: POST receipts only; atomic stock-in; no PATCH RECEIVED

## Numbering

Tenant-scoped unique (tenantId + poNumber). Production migration operator-owned.
