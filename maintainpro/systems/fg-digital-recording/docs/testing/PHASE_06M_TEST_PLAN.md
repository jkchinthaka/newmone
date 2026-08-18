# Phase 06M Test Plan — Measurement semantics (Decimal / units / bounds)

**Document status:** Engineering test plan — **not** product-spec approval  
**Phase:** 06M  
**Evidence gate:** Product limits, company unit mappings, and production rounding policies remain **EVIDENCE REQUIRED**. No Nelna specification values are seeded.

## Hard invariant

| Measurement semantics | Is not |
| --- | --- |
| Informational min/max + inclusivity | QA HOLD / REJECT / RELEASE |
| Rounding / precision | Silent business policy default |
| Technical unit catalog | Approved Nelna unit mapping |

`within_informational_bounds` is diagnostic only. Out-of-range NUMBER answers remain saveable/submittable unless a later approved policy says otherwise.

## Scope

- Decimal-safe parse/store (never binary float as authority)
- Explicit `decimal_precision` (0–12) + `rounding_mode` (rounding only when both set)
- Controlled technical unit catalog (blank allowed; free-form rejected)
- Explicit `min_inclusive` / `max_inclusive` (ADR-019 defaults true)
- Frozen `measurement_context` on draft + submission/correction snapshots
- Display without float artifacts; Mongo-safe Decimal-as-string serialization

## Cases

| ID | Case | Expectation |
| --- | --- | --- |
| 06M-T01 | Decimal precision / ceiling | Scale 0–12; values above ceiling rejected |
| 06M-T02 | Zero / negative / large | Stored as Decimal without invented rounding |
| 06M-T03 | Lower/upper inclusive | Boundary membership matches configured flags |
| 06M-T04 | Lower/upper exclusive | Boundary membership matches configured flags |
| 06M-T05 | Rounding | Applied only when both precision and mode configured |
| 06M-T06 | Unit validation | Catalog accepted; free-form rejected |
| 06M-T07 | Historical snapshot | `measurement_context` frozen; later definition edits do not rewrite |
| 06M-T08 | Correction path | Same freeze helper; historical versions immutable |
| 06M-T09 | Mongo serialization | Decimals as strings; JSON round-trip |
| 06M-T10 | Security | Cross-org denied; published immutable; no QAReview from measurement |
| 06M-T11 | Display | No binary float artifacts |

## Out of scope

- Seeding product temperature limits or company unit mappings
- Dual-unit conversion engines
- Auto disposition from informational bounds
