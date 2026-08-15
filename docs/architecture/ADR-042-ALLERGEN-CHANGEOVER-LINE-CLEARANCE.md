# ADR-042 — Allergen / changeover / line-clearance foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 30

## Context

Allergen Control, Production Changeover, Food Safety, and QA need configurable shells for allergen references, product declarations, changeover records, and line clearance — without inventing Nelna allergen catalogues, cleaning sequences, or automatic production start/stop matrices.

## Decision

1. Introduce `apps.changeover` with:
   - `AllergenReference` — generic unseeded allergen code/name shell
   - `ProductAllergenDeclaration` — draft/approve product association to optional allergen references (EVIDENCE REQUIRED for company mappings)
   - `ChangeoverRecord` — previous/next product, line, time, cleaning checklist template/version, packaging artwork hook, verification, evidence metadata, frozen context
   - `LineClearanceRecord` — checklist-engine driven clearance (template/version/submission), optional packaging hook, frozen context
   - `AllergenRiskPolicy` — org stub dual-gated with `CHANGEOVER_ALLERGEN_BLOCK_APPROVED` (default OFF)
2. Line clearance prefers checklist engine bindings over hardcoded cleaning fields.
3. Do **not** automatically block/start production from an allergen matrix unless org policy is enabled **and** settings approval is true; callers must assert `matrix_conflict_asserted` (never invented by the platform).
4. Frozen changeover/clearance context marks `batch_dossier_ready` for later batch-dossier traceability.
5. Evidence linked kinds: `CHANGEOVER_RECORD`, `LINE_CLEARANCE_RECORD`.

## Consequences

- Company allergen lists, cleaning rules, sequencing rules, and matrix block policy remain **EVIDENCE REQUIRED** (APR-056).
- Production-block signal is advisory architecture only until formal policy and integration wiring exist.
