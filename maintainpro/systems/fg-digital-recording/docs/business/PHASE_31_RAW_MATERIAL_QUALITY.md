# Phase 31 — Raw / material receiving quality foundation

**Document status:** Technical foundation — company material catalogues / limits **not** seeded  
**Phase:** 31  
**ADR:** [ADR-043-RAW-MATERIAL-RECEIVING-QUALITY.md](../architecture/ADR-043-RAW-MATERIAL-RECEIVING-QUALITY.md)

## Delivered

| Area | Status |
| --- | --- |
| ERP-mapped MaterialReference | TECHNICALLY SUPPORTED (not inventory master) |
| ReceiptQualityRecord (GRN, supplier, lot, qty, checklist, evidence) | TECHNICALLY SUPPORTED |
| Local quality states PENDING/ACCEPTED/HOLD/REJECTED | TECHNICALLY SUPPORTED |
| Versioned material specification shells | TECHNICALLY SUPPORTED (no invented limits) |
| Lab sample link (Phase 22) | TECHNICALLY SUPPORTED |
| ERP stock/quality outbound | Prepare-only; always blocked (Phase 17) |

## Explicit non-claims

- Does not own ERP inventory or update stock state
- Does not invent material catalogues or specification limits
- Local disposition ≠ ERP stock disposition

## STATUS: PHASE 31 RAW MATERIAL QUALITY COMPLETE
