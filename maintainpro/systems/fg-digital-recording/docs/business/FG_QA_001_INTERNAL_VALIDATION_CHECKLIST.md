# FG-QA-001 Internal Validation Checklist

**Document status:** Stakeholder worksheet — **not** an approval record by existence
**Created:** 2026-08-07 (Phase 06D)
**Proposal under review:** [proposals/FG_QA_001_DRAFT_V0_1.md](proposals/FG_QA_001_DRAFT_V0_1.md)
**TEMPLATE-001 status:** PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED
**ASM-001 / MASTER-001:** Remain OPEN (EVIDENCE REQUIRED)

## Purpose

QA / Production / IT use this worksheet to validate the project-proposed FG-QA-001 draft. Completing or filing this form does **not** by itself approve production use.

Log concrete issues in [templates/FG_QA_001_VALIDATION_ISSUES.csv](templates/FG_QA_001_VALIDATION_ISSUES.csv) (headers only until stakeholders raise real issues).

Leave blanks as **EVIDENCE REQUIRED** where not yet confirmed. Do not invent Nelna operational values.

---

## A. Document identification

| Field | Entry |
| --- | --- |
| Template code | FG-QA-001 |
| Draft version reviewed | EVIDENCE REQUIRED (e.g. Draft v0.1 — Proposed) |
| Review date | EVIDENCE REQUIRED |
| Reviewer name | EVIDENCE REQUIRED |
| Department / role | EVIDENCE REQUIRED |
| Organization context (if reviewing a loaded DRAFT) | EVIDENCE REQUIRED |

---

## B. Overall structure

| Question | Answer | Notes |
| --- | --- | --- |
| Is the checklist purpose correct? | EVIDENCE REQUIRED | |
| Are section names correct? | EVIDENCE REQUIRED | |
| Is section order correct? | EVIDENCE REQUIRED | |
| Is any required section missing? | EVIDENCE REQUIRED | |
| Is any section unnecessary? | EVIDENCE REQUIRED | |

Proposed sections (for reference only — not approved): Area & Hygiene; Product Identity & Traceability; Packaging & Product Condition; Measurements & Temperature; Storage & Stock Control; Dispatch; Final Review / Disposition.

---

## C. Per-item verification

For **every** item (FGQA-01 … FGQA-42), verify the following. Record failures in the validation issues CSV.

| Check | Status guidance |
| --- | --- |
| Wording accurate? | EVIDENCE REQUIRED per item |
| Applicable to intended FG operations? | EVIDENCE REQUIRED per item |
| Required flag correct? | EVIDENCE REQUIRED per item |
| Response type correct? | EVIDENCE REQUIRED per item |
| Unit correct (if any)? | EVIDENCE REQUIRED per item |
| Limits required? (min/max) | EVIDENCE REQUIRED — draft leaves numerical limits unset |
| N/A allowed? | EVIDENCE REQUIRED per item |
| Instruction / help text required? | EVIDENCE REQUIRED per item |

Do not invent missing wording, limits, or applicability answers here.

---

## D. Product applicability

| Question | Answer |
| --- | --- |
| Applies to all FG Products? | EVIDENCE REQUIRED |
| Only selected Products? | EVIDENCE REQUIRED |
| Different requirements by Product? | EVIDENCE REQUIRED |
| Linked Product codes / catalogues | EVIDENCE REQUIRED — MASTER-001 remains open; draft does not assign Products |

---

## E. Shift / process applicability

| Question | Answer |
| --- | --- |
| Every Shift? | EVIDENCE REQUIRED |
| Selected Shifts only? | EVIDENCE REQUIRED |
| Production stage? | EVIDENCE REQUIRED |
| Dispatch only? | EVIDENCE REQUIRED |
| Storage only? | EVIDENCE REQUIRED |
| Other process scope | EVIDENCE REQUIRED |

Official Shift names/codes remain unresolved (ASM-005 / ASM-006). Do not invent them here.

---

## F. Numerical specifications

| Item / measure | Approved min | Approved max | Unit | Source document | Owner |
| --- | --- | --- | --- | --- | --- |
| EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |

ASM-001 temperature-class limits remain **open**. Proposed °C units on draft NUMBER items are unit proposals only, not approved ranges.

---

## G. Workflow

| Question | Answer |
| --- | --- |
| Who records / fills? | OWNER-PROVISIONAL categories: Production Employee / Store Employee / QA — see [PHASE_06E](../decisions/PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md); RBAC mapping EVIDENCE REQUIRED |
| Who performs supervisor review? | OWNER-PROVISIONAL: Supervisor review required on every submission (Phase 09); named role mapping EVIDENCE REQUIRED |
| Who performs QA review? | OWNER-PROVISIONAL: QA final disposition authority (Phase 10); mapping EVIDENCE REQUIRED |
| Who holds release authority? | OWNER-PROVISIONAL: QA final business disposition (not automated in 07A) |
| Correction / resubmission policy | OWNER-PROVISIONAL: must not silently overwrite original; preserve history (Phase 08+) — not implemented yet |

SELECT labels RELEASE / HOLD / REJECT on FGQA-41 are **definition labels only** — not automatic release, HOLD, or REJECT.

---

## H. Scheduling

Mark or describe the intended trigger. **Do not pretreat owner provisional direction as formal QA sign-off.**

| Option | Selected? | Notes |
| --- | --- | --- |
| Per batch | OWNER-PROVISIONAL (06E) | Not formal QA/Production approval |
| Per shift | | EVIDENCE REQUIRED |
| Per day | | EVIDENCE REQUIRED |
| Per dispatch | | EVIDENCE REQUIRED |
| Ad hoc | | EVIDENCE REQUIRED |
| Other | | EVIDENCE REQUIRED |

Phase **07A** technical task foundation exists (`batch_reference`). Real production generation remains blocked until FG-QA-001 is approved/published and batch source/integration is evidenced.

---

## I. Final review decision

Existence of this checklist is **not** approval. Check exactly one outcome when stakeholders decide:

- [ ] APPROVED AS-IS
- [ ] APPROVED WITH CHANGES
- [ ] REQUIRES REVISION
- [ ] REJECTED

| Field | Entry |
| --- | --- |
| Decision date | EVIDENCE REQUIRED |
| Decision by (name / role) | EVIDENCE REQUIRED |
| Conditions / change summary | EVIDENCE REQUIRED |
| Evidence / controlled-document references | EVIDENCE REQUIRED |

Until a named decision is recorded with evidence, TEMPLATE-001 remains **PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED**.

Owner-directed provisional workflow (06E) does **not** complete this section.

---

## Explicit non-claims

- This worksheet does not close ASM-001 or MASTER-001.
- A loaded DRAFT in an Organization does not equal business approval.
- Phase 06E provisional workflow is not formal QA/Production sign-off.
- Phase 07A foundation does not authorize real FG-QA-001 production tasks.
- Do not invent temperature limits, Product catalogues, Shift names, or approval rules.

## Related

- [PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md](../decisions/PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md)
- [TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md](TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md)
- [PHASE_07_READINESS_GATE.md](PHASE_07_READINESS_GATE.md)
- [FG_QA_001_DRAFT_LOADING.md](../operations/FG_QA_001_DRAFT_LOADING.md)
- [ASSUMPTION_REGISTER.md](ASSUMPTION_REGISTER.md)
