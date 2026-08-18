# Phase 33 — Incoming Quality Control (IQC) workflow

**Document status:** Technical foundation — company IQC content **not** seeded  
**Phase:** 33  
**ADR:** [ADR-044-INCOMING-QUALITY-CONTROL.md](../architecture/ADR-044-INCOMING-QUALITY-CONTROL.md)

## Flow

ERP Receipt / GRN → IQC Task → Recording → Review (if required) → Local disposition → ERP only if approved

## Delivered

| Area | Status |
| --- | --- |
| Idempotent receipt event ingest | TECHNICALLY SUPPORTED |
| ChecklistTask generation (PUBLISHED versions) | TECHNICALLY SUPPORTED |
| Sampling resolve (Phase 24) | TECHNICALLY SUPPORTED |
| Lab sample link (Phase 22) | TECHNICALLY SUPPORTED |
| Supervisor review gate | TECHNICALLY SUPPORTED (when review_required) |
| Local disposition separate from ERP stock | TECHNICALLY SUPPORTED |
| Traceability freeze (lot → receipt → inspection → decision) | TECHNICALLY SUPPORTED |
| ERP outbound | Dual-gate default **OFF** (APR-058) |

## Explicit non-claims

- Does not hardcode incoming inspection questions
- Does not invent sampling AQL tables
- Does not update ERP stock without approved Phase 17 contract

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `IQC_ERP_OUTBOUND_APPROVED` | `false` | Gates IQC → ERP outbound signal |

## STATUS: PHASE 33 IQC COMPLETE
