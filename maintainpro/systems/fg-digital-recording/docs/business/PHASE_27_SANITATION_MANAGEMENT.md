# Phase 27 — Sanitation / SSOP checklist workflows

**Document status:** Technical foundation — company SSOP content **not** seeded  
**Phase:** 27  
**Depends on:** Checklist engine, scheduling 07E, reviews/quality, evidence, equipment  
**ADR:** [ADR-039-SANITATION-CHECKLIST-WORKFLOWS.md](../architecture/ADR-039-SANITATION-CHECKLIST-WORKFLOWS.md)

## Delivered

| Area | Status |
| --- | --- |
| Reuse ChecklistTemplate (no separate form engine) | TECHNICALLY SUPPORTED |
| Site / department / line / work area / equipment scopes | TECHNICALLY SUPPORTED |
| Schedule kinds PRE_OP…PERIODIC via configuration | TECHNICALLY SUPPORTED |
| Unseeded ChemicalReference | TECHNICALLY SUPPORTED |
| Verification mode → existing self / Supervisor / QA | TECHNICALLY SUPPORTED |
| FAIL production-stop policy | Default **OFF** (APR-053) |
| Evidence link kind `SANITATION_PROGRAM` | TECHNICALLY SUPPORTED |
| Frozen sanitation_context on submissions | TECHNICALLY SUPPORTED |

## Explicit non-claims

- No invented cleaning chemicals, concentrations, frequencies, or ATP/swab limits
- No invented approval procedure beyond selecting existing workflow layers
- FAIL does not auto-stop production without approved policy

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `SANITATION_FAIL_STOP_PRODUCTION_APPROVED` | `false` | Gates production-stop when org policy enabled |

## STATUS: PHASE 27 SANITATION MANAGEMENT COMPLETE
