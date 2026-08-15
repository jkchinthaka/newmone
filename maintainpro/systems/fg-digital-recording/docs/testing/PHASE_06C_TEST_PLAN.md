# Phase 06C Test Plan — Checklist Response Schema & FG-QA-001 Proposal

**Document status:** Phase 06C response-definition schema + proposal artifact  
**Last updated:** 2026-08-07  
**Proposal:** [FG_QA_001_DRAFT_V0_1.md](../business/proposals/FG_QA_001_DRAFT_V0_1.md) — **NOT APPROVED** for production

## Scope

Provisional response-definition schema on checklist items; publish validation; published/retired immutability with response metadata; clone including SELECT options; option integrity; definition-editor UI for response types/options; documentation of the FG-QA-001 draft proposal artifact.

## Out of scope

Runtime recording/submission; scheduling/tasks; automatic RELEASE/HOLD/REJECT; invented numerical limits; seed/import of FG-QA-001 into Organizations; PHOTO/SIGNATURE and other deferred response types.

## Coverage areas

| Area | Focus |
| --- | --- |
| Response schema | Valid YES_NO, YES_NO_NA, NUMBER, TEXT, SELECT; unknown types rejected; NUMBER min/max relationship when both set; non-NUMBER numeric limits rejected |
| Publish | Missing/invalid `response_type` blocks publish; SELECT requires ≥1 valid option; min/max **not** required to publish |
| Immutability | Published/retired versions reject structural and response-schema mutations (services, HTTP, admin paths) |
| Clone | Clone from DRAFT/PUBLISHED/RETIRED copies sections/items/options as independent rows; order preserved; source unchanged |
| Options | SELECT option constraints; duplicate value/position rejected; options cloned with items |
| UI | Draft editor exposes response type; NUMBER unit/limits optional; SELECT option editor; published/retired read-only |
| Proposal artifact | FG-QA-001 Markdown/CSV exist as review-only draft; no auto-seed; limits empty; disposition labels are workflow labels only |

Synthetic fixtures only (e.g. `CHK-RS*`, section/item test labels). Do not load FG-QA-001 proposal content as test seed representing approved business forms.
