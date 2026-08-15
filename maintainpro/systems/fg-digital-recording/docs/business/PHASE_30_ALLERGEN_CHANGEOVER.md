# Phase 30 — Allergen / changeover / line-clearance foundation

**Document status:** Technical foundation — company allergen / cleaning content **not** seeded  
**Phase:** 30  
**ADR:** [ADR-042-ALLERGEN-CHANGEOVER-LINE-CLEARANCE.md](../architecture/ADR-042-ALLERGEN-CHANGEOVER-LINE-CLEARANCE.md)

## Delivered

| Area | Status |
| --- | --- |
| Generic AllergenReference shells | TECHNICALLY SUPPORTED (unseeded) |
| Product allergen declaration association | TECHNICALLY SUPPORTED |
| ChangeoverRecord (prev/next, line, time, checklist, packaging, evidence) | TECHNICALLY SUPPORTED |
| LineClearanceRecord via checklist engine | TECHNICALLY SUPPORTED |
| Frozen historical / batch-dossier-ready context | TECHNICALLY SUPPORTED |
| Allergen matrix production-block | Default **OFF** (APR-056 dual gate) |

## Explicit non-claims

- Does not invent Nelna allergen lists, cleaning rules, or sequencing rules
- Does not auto-block/start production unless dual-gated policy is approved
- Does not replace company SOPs

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `CHANGEOVER_ALLERGEN_BLOCK_APPROVED` | `false` | Gates allergen-matrix production block signal |

## STATUS: PHASE 30 ALLERGEN CHANGEOVER FOUNDATION COMPLETE
