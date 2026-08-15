# Phase 06O — Versioned Product Quality Specifications

**Document status:** Technical foundation note — **not** business approval of limits  
**Phase:** 06O  
**Authority:** Complements ADR-009 / APR-006 / ASM-001; does not invent Nelna operational values  

---

## Purpose

Provide versioned **ProductSpecification / SpecificationVersion / SpecificationParameter** models so quality limits can be stored when owners supply evidence — without seeding temperature, weight, microbiological, or other Nelna limits from AI examples.

---

## Domain

| Model | Role |
| --- | --- |
| `ProductSpecification` | Org-scoped identity for one FG Product (`code` unique per product) |
| `SpecificationVersion` | DRAFT → APPROVED → RETIRED; approved history never overwritten |
| `SpecificationParameter` | Parameter metadata: unit, precision, min/max, inclusivity, optional warn bands, test method / approval references |

Unknown bounds remain **empty / pending**. Empty bounds evaluate as **NOT_EVALUATED**, not invent defaults.

---

## Versioning & effectivity

- New approved changes create a **new version** (clone-from-history supported).
- Impossible date ranges (`effective_to` < `effective_from`) are rejected.
- Ambiguous overlapping **APPROVED** effectivity windows for the same specification are rejected by service policy (open-ended nulls treated as unbounded for overlap checks).

---

## Evaluation link (checklist)

Optional rule kind `SPECIFICATION_PARAMETER` pins an exact `SpecificationVersion` + `SpecificationParameter`.

- Historical pins remain valid after retirement (PROTECT FKs).
- Measurement labels: **IN_SPEC** / **OUT_OF_SPEC** / **WARN** / **NOT_EVALUATED**.
- Checklist result mapping: IN_SPEC→PASS, OUT_OF_SPEC→FAIL, WARN→WARN.
- **OUT_OF_SPEC ≠ HOLD / REJECT**; **IN_SPEC ≠ RELEASE**. Specification evaluation does **not** create or modify `QAReview`.

---

## Authorization & audit

- High-privilege: `master_data.manage_productspecification` (org-scoped).
- View: `master_data.view_productspecification`.
- Approve/edit/retire/publish paths emit `security_audit` events (`PRODUCT_SPECIFICATION_*` / `SPECIFICATION_VERSION_*` / `SPECIFICATION_PARAMETER_*`).

---

## Evidence gates (unchanged)

| Item | Status |
| --- | --- |
| APR-006 product specification limits | **EVIDENCE REQUIRED** |
| ASM-001 temperature classes | **EVIDENCE REQUIRED** |
| MASTER-001 product catalogue | **EVIDENCE REQUIRED** |

Do not load production limits without owner evidence. This phase is **technically complete** only.

---

## STATUS: PHASE 06O PRODUCT SPECIFICATIONS COMPLETE
