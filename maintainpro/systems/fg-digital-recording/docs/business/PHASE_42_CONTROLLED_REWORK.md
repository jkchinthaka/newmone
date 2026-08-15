# Phase 42 — Controlled Rework Management

**Status:** Technical foundation complete  
**ADR:** [ADR-053](../architecture/ADR-053-CONTROLLED-REWORK.md)  
**Approval gate:** APR-067 (rework SOP / authorization SoD / ERP stock — EVIDENCE REQUIRED)

## Scope delivered

- Rework cases with source batch/sub-lot, quantity/UOM, reason, instruction, authorization, timestamps, resulting batch, remaining source quantity
- Explicit create / authorize / execute permissions (REJECT does not auto-create)
- Source/result genealogy via Phase 36 nodes/edges
- Quantity conservation for numeric references
- New checklist inspection on the resulting batch only
- Dual-gate ERP stock movement OFF by default

## Explicitly not delivered / gated

- Company rework SOP and authorization matrix (APR-067)
- Treating REJECT as automatic rework
- Reusing source RELEASE / original QA history
- Live ERP quantity/status updates (APR-067)

## Tests

`apps/rework/tests/test_phase42_rework.py` — full/partial rework,
genealogy, quantity conservation, new inspection, authorization, cross-org,
duplicate execution.

## STATUS: PHASE 42 REWORK MANAGEMENT COMPLETE
