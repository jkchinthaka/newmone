# Phase 38 — Mock Recall Exercises

**Document status:** Technical foundation — company mock-drill SOPs **not** seeded  
**Phase:** 38  
**ADR:** [ADR-049-MOCK-RECALL-EXERCISES.md](../architecture/ADR-049-MOCK-RECALL-EXERCISES.md)

## Intent

Support mock recall exercises without affecting real product/inventory status.

## Delivered

| Area | Status |
| --- | --- |
| Explicit MOCK mode (`MOCK-` prefix + banner + `is_mock`) | TECHNICALLY SUPPORTED |
| Exercise metrics (start/complete/scope/trace/qty/gaps/actions) | TECHNICALLY SUPPORTED |
| No ERP stock / real notify / regulatory / dispatch side effects | TECHNICALLY SUPPORTED |
| Findings → NCR / CAPA / improvement (explicit user action) | TECHNICALLY SUPPORTED |
| Authorization (`run_mock_recall` ≠ `initiate_recall`) | TECHNICALLY SUPPORTED |

## Explicit non-claims

- Does not invent regulatory recall classes or drill scoring thresholds
- Does not change ERP stock or block dispatch from mock exercises
- Does not auto-create NCR/CAPA without explicit user action
- Does not convert mock exercises into real recalls

## Permissions

| Permission | Notes |
| --- | --- |
| `run_mock_recall` | Create/run mock exercises |
| `manage_mock_recall_findings` | Record findings; explicit NCR/CAPA/improvement links |

## STATUS: PHASE 38 MOCK RECALL COMPLETE
