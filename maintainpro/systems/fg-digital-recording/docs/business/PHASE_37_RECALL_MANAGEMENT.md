# Phase 37 — Product Recall / Withdrawal Management

**Document status:** Technical foundation — company recall SOPs **not** seeded  
**Phase:** 37  
**ADR:** [ADR-048-PRODUCT-RECALL-MANAGEMENT.md](../architecture/ADR-048-PRODUCT-RECALL-MANAGEMENT.md)

## Intent

Implement controlled product recall/withdrawal case management without inventing
regulatory recall classes, reporting times, or notification obligations.

## Delivered

| Area | Status |
| --- | --- |
| Recall case lifecycle (create/initiate/scope/close) | TECHNICALLY SUPPORTED |
| Affected products / batches | TECHNICALLY SUPPORTED |
| Phase 36 genealogy expansion | TECHNICALLY SUPPORTED |
| Quantity reconciliation shells (no invented variance) | TECHNICALLY SUPPORTED |
| Communication references (no auto-send) | TECHNICALLY SUPPORTED |
| Explicit initiate_recall (not System Admin by default) | TECHNICALLY SUPPORTED |
| Immutable timeline + audit events | TECHNICALLY SUPPORTED |
| External notify / ERP pull dual-gates OFF | TECHNICALLY SUPPORTED |

## Explicit non-claims

- Does not invent regulatory recall classes or reporting deadlines
- Does not auto-contact authorities or customers
- Does not invent acceptable quantity variance
- Does not execute live ERP distribution pulls

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `RECALL_EXTERNAL_NOTIFICATION_APPROVED` | `false` | Gates external notification prepare path |
| `RECALL_ERP_DISTRIBUTION_PULL_APPROVED` | `false` | Gates ERP distribution/customer pull prepare path |

## STATUS: PHASE 37 RECALL MANAGEMENT COMPLETE
