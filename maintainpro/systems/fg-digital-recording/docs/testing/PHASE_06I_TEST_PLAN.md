# Phase 06I Test Plan — Safe Calculated Fields

**Document status:** Phase 06I technical foundation  
**Last updated:** 2026-08-10  
**Architecture:** [ADR-019](../architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md)  
**Primary tests:** `apps/checklists/tests/test_phase06i_calculation.py`, `apps/recording/tests/test_phase06i_calculated_fields.py`

## Scope

Closed whitelist operators `SUM|AVERAGE|MIN|MAX|COUNT|RANGE` with Decimal-safe math. Server recalculates on draft save / submit. Immutable snapshots store `number_value` plus `calculation_context` (operator + inputs). No `eval` / expression language. No seeded Nelna business formulas.

## Out of scope

Free-form formulas; client-authoritative math; conditionals (06J); evaluation engine (06K); invented product limits.

## Coverage areas

| Area | Focus |
| --- | --- |
| Operators | Each whitelist operator; empty inputs; Decimal quantize |
| Security | Reject unknown operators / eval-like payloads; ignore client calculated overrides |
| Definition | Same-version operands; cycle detection; wrong response types |
| Repeating | Per-sample CALCULATED children under REPEATING_GROUP |
| Snapshot | Frozen context; no reinterpretation with future rules |
| Correction | Recalculate from pinned version on resubmit |
| Performance | Bulk select / no query-per-sample |

Synthetic fixtures only.
