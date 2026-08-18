# PROPOSED DRAFT — NOT APPROVED FOR PRODUCTION USE

# FG-QA-001  
# Finished Goods Quality Release & Dispatch Checklist  
# Draft v0.1

**Document status:** PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED  
**Template code:** FG-QA-001  
**Revision:** Draft v0.1 — Proposed  
**Created:** 2026-08-07 (Phase 06C)  
**Approval:** **NOT APPROVED** for production, pilot, or operational use

## Purpose

The company currently has **no existing formal Finished Goods (FG) checklist** suitable as a controlled digital template source.

This document is a **project-proposed** baseline for **QA / Production / IT** validation only. It is **not** controlled-document content and must **not** be treated as approved Nelna operational rules.

Companion machine-readable proposal (also draft only):  
[FG_QA_001_DRAFT_V0_1.csv](FG_QA_001_DRAFT_V0_1.csv)

## Explicit status links

| ID | Status |
| --- | --- |
| TEMPLATE-001 | **PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED** (not fully approved) |
| ASM-001 | Remains **open** (EVIDENCE REQUIRED) — temperature-class limits unset |
| MASTER-001 | Remains **open** (EVIDENCE REQUIRED) — no Product codes or catalogues invented here |

## Non-claims

- No numerical control limits are invented; NUMBER item **minimum** / **maximum** remain unset.
- Proposed °C units on temperature NUMBER items are **unit proposals only**, not approved ranges.
- SELECT disposition labels (RELEASE / HOLD / REJECT) are **proposed workflow labels only** — **no automatic release**, HOLD, or REJECT engine.
- This artifact must **not** be auto-seeded into Organizations or loaded as production data.
- Phase 07 scheduling / tasks remain **blocked** until evidence gates are met.

---

## Proposed sections and items

Response types below are provisional technical primitives for definition schema review only.

### 1. Area & Hygiene

| # | Code | Item | Required | Response type | Unit | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | FGQA-01 | FG handling/storage area is clean and sanitary | Yes | YES_NO_NA | — | — |
| 2 | FGQA-02 | Required food-handler hygiene/PPE practices are followed | Yes | YES_NO_NA | — | — |
| 3 | FGQA-03 | No visible pest activity, contamination or foreign material is observed | Yes | YES_NO | — | — |
| 4 | FGQA-04 | Applicable measuring device is within valid calibration/check status | Yes | YES_NO_NA | — | — |

### 2. Product Identity & Traceability

| # | Code | Item | Required | Response type | Unit | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | FGQA-05 | Physical product matches the selected FG Product | Yes | YES_NO | — | — |
| 6 | FGQA-06 | Product identification/label information is correct | Yes | YES_NO | — | — |
| 7 | FGQA-07 | Batch/Lot number is present and legible | Yes | YES_NO | — | — |
| 8 | FGQA-08 | Production date is present/correct where applicable | Yes | YES_NO_NA | — | — |
| 9 | FGQA-09 | Expiry/Best-Before information is present/correct where applicable | Yes | YES_NO_NA | — | — |
| 10 | FGQA-10 | Required storage/handling instructions are present where applicable | Yes | YES_NO_NA | — | — |
| 11 | FGQA-11 | Label matches the currently approved Product/label specification | Yes | YES_NO_NA | — | — |

### 3. Packaging & Product Condition

| # | Code | Item | Required | Response type | Unit | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| 12 | FGQA-12 | Primary packaging is clean and suitable | Yes | YES_NO | — | — |
| 13 | FGQA-13 | No visible tear, puncture, leakage or unacceptable package damage | Yes | YES_NO | — | — |
| 14 | FGQA-14 | Seal/closure integrity is acceptable where applicable | Yes | YES_NO_NA | — | — |
| 15 | FGQA-15 | Secondary/outer packaging condition is acceptable where applicable | Yes | YES_NO_NA | — | — |
| 16 | FGQA-16 | No visible foreign material is observed | Yes | YES_NO | — | — |
| 17 | FGQA-17 | Product appearance/colour is acceptable against approved specification | Yes | YES_NO_NA | — | — |
| 18 | FGQA-18 | Product odour is acceptable where sensory checking is permitted | Yes | YES_NO_NA | — | — |

### 4. Measurements & Temperature

| # | Code | Item | Required | Response type | Unit | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| 19 | FGQA-19 | Actual pack/product weight | Yes | NUMBER | unset (no Product specification evidenced) | unset |
| 20 | FGQA-20 | Actual pack/count quantity where applicable | Yes | NUMBER | — | unset |
| 21 | FGQA-21 | Actual product temperature | Yes | NUMBER | °C (proposed) | unset |
| 22 | FGQA-22 | Product temperature meets approved Product specification | Yes | YES_NO_NA | — | — |
| 23 | FGQA-23 | Actual storage/cold-room temperature | Yes | NUMBER | °C (proposed) | unset |
| 24 | FGQA-24 | Storage temperature is within approved operating specification | Yes | YES_NO_NA | — | — |
| 25 | FGQA-25 | No unacceptable temperature-abuse condition is observed where applicable | Yes | YES_NO_NA | — | — |

### 5. Storage & Stock Control

| # | Code | Item | Required | Response type | Unit | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| 26 | FGQA-26 | Product is stored under the required approved condition | Yes | YES_NO | — | — |
| 27 | FGQA-27 | Batch/Lot segregation is maintained | Yes | YES_NO | — | — |
| 28 | FGQA-28 | HOLD/REJECT material is segregated from releasable Product | Yes | YES_NO_NA | — | — |
| 29 | FGQA-29 | Required stock-rotation method is being followed | Yes | YES_NO_NA | — | — |
| 30 | FGQA-30 | Traceability information is sufficient to identify the lot | Yes | YES_NO | — | — |

### 6. Dispatch

| # | Code | Item | Required | Response type | Unit | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| 31 | FGQA-31 | Vehicle/container is visibly clean and suitable where dispatch applies | Yes | YES_NO_NA | — | — |
| 32 | FGQA-32 | No visible contamination or unacceptable transport condition exists | Yes | YES_NO_NA | — | — |
| 33 | FGQA-33 | Vehicle/load temperature before dispatch | Yes | NUMBER | °C (proposed) | unset |
| 34 | FGQA-34 | Transport temperature meets approved Product specification | Yes | YES_NO_NA | — | — |
| 35 | FGQA-35 | Product is protected from contamination/damage during loading | Yes | YES_NO_NA | — | — |
| 36 | FGQA-36 | Product, Batch/Lot and Quantity match dispatch requirement | Yes | YES_NO_NA | — | — |
| 37 | FGQA-37 | Required dispatch/traceability documentation is complete | Yes | YES_NO_NA | — | — |

### 7. Final Review / Disposition

| # | Code | Item | Required | Response type | Unit | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| 38 | FGQA-38 | All identified non-conformities have remarks/deviation information recorded | Yes | YES_NO_NA | — | — |
| 39 | FGQA-39 | Corrective action/disposition is recorded where a deviation exists | Yes | YES_NO_NA | — | — |
| 40 | FGQA-40 | Supervisor review completed | Yes | YES_NO | — | — |
| 41 | FGQA-41 | Proposed final disposition | Yes | SELECT | — | — |
| 42 | FGQA-42 | Authorized QA/release verification completed where required | Yes | YES_NO_NA | — | — |

#### Item 41 — proposed SELECT options (workflow labels only)

| Option value | Meaning in this draft |
| --- | --- |
| RELEASE | Proposed label only — **not** automatic release |
| HOLD | Proposed label only — **not** automatic hold |
| REJECT | Proposed label only — **not** automatic reject |

Do **not** implement automatic release, HOLD, or REJECT decisions from these labels in Phase 06C (or from this draft alone).

---

## Future review questions (all EVIDENCE REQUIRED)

These questions remain open. Do not invent answers to unblock Phase 07+.

| Topic | Question | Status |
| --- | --- | --- |
| Scheduling | When is this checklist due (shift / batch / daily / hourly / before-after / ad hoc)? | EVIDENCE REQUIRED |
| Who fills | Which role(s) complete the checklist on the floor? | EVIDENCE REQUIRED |
| Who reviews | Which role(s) perform supervisor review? | EVIDENCE REQUIRED |
| Who approves | Which role(s) approve / authorize release-related verification? | EVIDENCE REQUIRED |
| QA authority | What is the QA authority model for verification and disposition? | EVIDENCE REQUIRED |
| Product limits | What Product-specific acceptance criteria and numerical limits apply (links to ASM-001 / MASTER-001)? | EVIDENCE REQUIRED |

---

## Related

- [TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md](../TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md)
- [RESPONSE_TYPE_DECISION_REGISTER.md](../RESPONSE_TYPE_DECISION_REGISTER.md)
- [ASSUMPTION_REGISTER.md](../ASSUMPTION_REGISTER.md)
- [PHASE_07_READINESS_GATE.md](../PHASE_07_READINESS_GATE.md)
- [ADR-010-CHECKLIST-DEFINITION-VERSIONING.md](../../architecture/ADR-010-CHECKLIST-DEFINITION-VERSIONING.md)
