# Phase 06H Test Plan — Repeating / Sample Foundation

**Document status:** Phase 06H technical foundation  
**Last updated:** 2026-08-10  
**Architecture:** [ADR-019](../architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md)  
**Primary module tests:** `apps/recording/tests/test_phase06h_repeating_samples.py`

## Scope

Backward-compatible `REPEATING_GROUP` + ordered child SIMPLE items + runtime `sample_index` on draft and immutable submission snapshots. Optional `repeat_min` / `repeat_max` / `repeat_default` only when defined on the group. Technical ceiling `REPEAT_SAMPLE_TECHNICAL_CEILING = 100` is an engineering bound — **not** an AQL or Nelna sample count.

## Out of scope

Nested repeating groups; calculated fields (06I); conditionals (06J); evaluation engine (06K); invented sample sizes / AQL; MongoDB cutover; production form content; UAT claims.

## Coverage areas

| Area | Focus |
| --- | --- |
| SIMPLE compatibility | Legacy top-level SIMPLE items keep `sample_index=1`; existing save/submit paths unchanged |
| Definition | Publish validates group/child graph; clone remaps `parent_item`; CALCULATED rejected until 06I |
| One / many samples | Draft + submit preserve group id, child id, sample index, typed value, deterministic order |
| Partial draft | Save Draft allows incomplete repeating rows within technical/repeat_max rules |
| Snapshot immutability | Submission #N snapshots never mutate after create |
| Correction | Returned flow clones editable draft with sample indexes; original submission unchanged |
| Supervisor / QA | Read-only views render exact immutable repeating snapshot via shared section renderer |
| Security | Reject invalid indexes, duplicate conflicting rows, fake item IDs, cross-org / cross-record injection; XSS-safe templates |
| Performance | Bulk select keyed by `(item_id, sample_index)`; editor query budget smoke |
| Concurrency | Unique `(record\|submission, item, sample_index)` constraints |

Synthetic fixtures only. Do **not** invent business sample rules in tests.
