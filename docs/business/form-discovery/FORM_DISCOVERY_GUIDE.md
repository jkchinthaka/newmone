# Form Discovery Guide

**Document status:** Process guide for real-company form evidence  
**Phase:** 06F  
**Created:** 2026-08-09  
**Rule:** Do not invent Nelna operational values. Empty cells remain EVIDENCE REQUIRED.

## Objectives

1. Discover which **real** company forms exist for FG QA / production / related areas.  
2. Classify each form and each item for digitalization readiness.  
3. Separate **collected paper** from **approved digital content**.  
4. Feed Checklist Engine v2 only from **APPROVED FOR DIGITALIZATION** evidence.

## Roles

| Role | Responsibility |
| --- | --- |
| QA Manager (OWNER TO BE CONFIRMED) | Controlled-document authority; CCP/OPRP; form approval |
| FG / Production (OWNER TO BE CONFIRMED) | Operational forms, frequencies, line/shift use |
| Product Owner / BA | Inventory completeness, gap map, register hygiene |
| IT / Technical Lead | Engine capability mapping only — not form invention |
| UX Researcher | Operator effort, paper→digital interaction notes (non-normative) |

Named individuals remain **OWNER TO BE CONFIRMED** until recorded in the Approval Register.

## Discovery workflow

```text
NOT RECEIVED
    → request / site visit / controlled-doc pull
COLLECTED
    → inventory row + scan/copy reference
UNDER ANALYSIS
    → item classification worksheet
BUSINESS REVIEW REQUIRED
    → owners review classification + digitalization scope
APPROVED FOR DIGITALIZATION
    → only then author ChecklistTemplate DRAFT from evidence
REJECTED / SUPERSEDED
    → retain history; do not digitalize
```

**Collecting a form ≠ approval.** **Analysis ≠ approval.** **FG-QA-001 draft ≠ company form.**

## Form types to *request* (not claim)

Request evidence for forms that **may** exist in the company. Do **not** claim all exist.

| Candidate category | Why requested | Existence claim |
| --- | --- | --- |
| FG Quality / release | Core MVP candidate | Unknown until inventory |
| Temperature monitoring | Common FG control theme | Unknown |
| Weight / fill | Packaging/process checks | Unknown |
| Packaging integrity | FG condition | Unknown |
| Label / date code | Traceability | Unknown |
| Hygiene / GMP | Area & people checks | Unknown |
| Cleaning / sanitation | PRP-style programs | Unknown |
| Metal detector | Often CCP/OPRP-related elsewhere | Unknown — do not invent classification |
| Storage / cold room | Holding conditions | Unknown |
| Loading | Dispatch readiness | Unknown |
| Dispatch | Outbound release | Unknown |
| Vehicle inspection | Transport hygiene/condition | Unknown |
| Shift checks | Start/end of shift | Unknown |
| Other QA/production forms | Catch-all for real company docs | Unknown |

Owners may add categories. Absence from this list does not mean out of scope forever.

## Inventory rules ([FORM_INVENTORY_TEMPLATE.csv](FORM_INVENTORY_TEMPLATE.csv))

- One row per distinct controlled form (or distinct uncontrolled operational sheet if that is what the site uses — mark Current Medium honestly).
- **Form ID:** project tracking ID (e.g. `FORM-REQ-001`), not invented company document numbers. When a real company doc number exists, put it in Version / Approval Reference / Notes as evidenced.
- Leave unknown fields blank or `EVIDENCE REQUIRED`.
- **Status** must use the vocabulary in [FORM_EVIDENCE_REGISTER.md](FORM_EVIDENCE_REGISTER.md).

## Item classification rules ([FORM_ITEM_CLASSIFICATION_TEMPLATE.csv](FORM_ITEM_CLASSIFICATION_TEMPLATE.csv))

- One row per question/check line on the source form.
- Map Response Type to engine primitives only when evidenced; otherwise leave blank and note gap in [RESPONSE_ENGINE_GAP_MAP.md](RESPONSE_ENGINE_GAP_MAP.md).
- CCP? / OPRP? / PRP? / GMP? / Quality? — fill **only** from company HACCP / controlled docs (APR-027 / ASM-002). Never from AI reports.
- Min / Max / Precision / AQL / sample size — fill **only** from company specs (APR-006 / ASM-001 / MASTER-001). Never invent.

## Linkage to FG-QA-001

| Artifact | Role |
| --- | --- |
| [FG_QA_001_DRAFT_V0_1.md](../proposals/FG_QA_001_DRAFT_V0_1.md) | Project-proposed draft for validation dialogue |
| This framework | Path to replace proposal with **real** company forms |
| APR-001 | Final content approval for FG-QA-001 publish |
| APR-028 / APR-036 | Paper inventory + discovery package |

If a collected company form **supersedes** the FG-QA-001 proposal, record SUPERSEDED on the proposal path and APPROVED FOR DIGITALIZATION only on the company form after written approval.

## AI research handling

Claude, Gemini, ChatGPT, and similar outputs used in workshops are:

| Allowed label | Forbidden label |
| --- | --- |
| INDUSTRY RESEARCH | Company evidence |
| PROPOSED DESIGN INPUT | Approved Nelna limit |
| Hypothesis for owner questions | CCP/OPRP fact |
| Gap-brainstorm for engine | ERP payload contract |

**Never** copy AI temperature limits, sample sizes, metal-detector limits, AQL values, product codes, role authority, HACCP rules, or ERP payloads into inventory Min/Max, Criticality, or approval notes as if they were Nelna facts.

If an AI report is stored for transparency, place it under a clearly marked research folder (or note the path here) with header:

`INDUSTRY RESEARCH / PROPOSED DESIGN INPUT — NOT COMPANY EVIDENCE`

## Checklist Engine v2 gate

Do not implement v2 schema features (repeating grids, calculations, conditions, attachments as first-class definition types, etc.) as “required by Nelna” until:

1. At least one real form is **APPROVED FOR DIGITALIZATION**, and  
2. Item classification shows the capability is required by that evidence, and  
3. Architecture/ADR update records the decision.

See [RESPONSE_ENGINE_GAP_MAP.md](RESPONSE_ENGINE_GAP_MAP.md) — gap map only; **no schema implementation in Phase 06F**.

## Evidence handling

- Prefer controlled-document copies, revision-controlled scans, or owner-signed exports.
- Record Evidence Source (path, doc control number, interview date, owner name) — **EVIDENCE REQUIRED** if missing.
- Do not commit secrets, personal data beyond role titles needed for ownership, or production credentials.
