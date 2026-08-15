# ADR-024 — Quality nonconformance, HOLD, and CAPA foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 12

## Context

Formal quality cases (NCR / HOLD / CAPA) must be configurable without inventing Nelna severity, resolution catalogues, or auto-raise rules from FAIL/CCP metadata. Recording correction/resubmission must remain a separate concern.

## Decision

1. Expand `apps.nonconformance` with full NCR fields (source, links, owner, containment, investigation, closure) and proposed lifecycle: OPEN → INVESTIGATING → ACTION_REQUIRED → VERIFICATION → CLOSED.
2. Add `HoldCase` with free-text reason/scope/resolution (no company resolution enum).
3. Expand `apps.capa` with CAPA header (verification, effectiveness review, closure), `CapaActionItem` (owner, due date), and append-only history.
4. Separate create / manage / close permissions for NCR, Hold, and CAPA.
5. Append-only case history + security audit events for lifecycle operations.
6. **No auto case generation** from item evaluation FAIL/CCP or QA disposition in Phase 12.
7. Quantity/sub-lot disposition: optional opaque `quantity_reference` only — no disposition architecture exists yet.
8. Soft retention; no casual hard-delete.

## Explicit non-equivalence

`recording.ChecklistCorrection` ≠ `NonConformanceRecord`. Correction/resubmission does not create or close formal NCR/HOLD/CAPA.

## Consequences

- Production case policies remain EVIDENCE REQUIRED (QA owner).
- Human-only CAPA closure (no AI final decisions).
- HOLD resolution catalogues remain unseeded.
