# Phase 06O Test Plan — Versioned Product Specifications

**Phase:** 06O  
**Outcome:** Technical foundation complete — **no** seeded Nelna limits  

| Scenario | Expectation |
| --- | --- |
| Version immutability | APPROVED/RETIRED refuse structural mutation; hard delete refused |
| Boundary semantics | Empty bounds → NOT_EVALUATED; inclusive/exclusive hard bounds; warn bands |
| Effective dates | Impossible windows rejected; overlapping APPROVED windows rejected |
| Product isolation | Spec codes unique per product; org isolation |
| Historical reference | Checklist pin to retired SpecificationVersion still evaluates |
| Cross-org / authorization | Site-only and cross-org denied for manage |
| Disposition separation | OUT_OF_SPEC does not create QAReview / HOLD / REJECT |
| No seeded limits | Empty tables; docs contain no invented Nelna numeric limits |

Target coverage for `specification_services` + `specification_evaluation` ≥ 80%.
