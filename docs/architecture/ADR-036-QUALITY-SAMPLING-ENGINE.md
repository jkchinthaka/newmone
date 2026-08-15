# ADR-036 — Configurable quality sampling engine

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 24

## Context

Repeating-group sample grids (06H) exist, but sample counts and accept/reject thresholds must not be invented as ISO/AQL tables. The product needs a versioned place to hold **company-approved** sampling configuration later.

## Decision

1. Introduce `apps.sampling` with `SamplingPlan` / `SamplingPlanVersion` / `SamplingRule` / `SampleRequirement`.
2. Optional matching dimensions (product, lot-size range, inspection type, risk class, site, process) remain inactive until configured — no forced activation.
3. Outputs (required sample count, grouping, accept/reject thresholds, inspection level) stay null/blank until approved evidence is loaded. **No ISO/AQL tables are reproduced.**
4. `ChecklistItemSamplingBinding` links REPEATING_GROUP items to an exact plan version and freezes historical context.
5. Resolution is deterministic (priority then code). Same-priority multi-match is flagged as `CONFLICTING_RULES`.
6. Sampling ACCEPT/REJECT/NOT_EVALUATED is advisory and **never** auto RELEASE/HOLD/REJECT.
7. APPROVED/RETIRED versions are immutable. `publish_samplingplan` is separate from `manage_samplingplan`.

## Consequences

- Company sampling tables / external-standard adoption remain **EVIDENCE REQUIRED**.
- Phase 24 does not invent sample sizes or AQL values.
