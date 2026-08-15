# Form Evidence Register

**Document status:** Living register for real-company form discovery  
**Phase:** 06F  
**Created:** 2026-08-09  
**Rule:** Silence is not approval. Collection is not digitalization approval.

## Form status vocabulary

| Status | Meaning |
| --- | --- |
| NOT RECEIVED | Form/category requested or expected; no company copy in evidence yet |
| COLLECTED | Copy/scan/controlled extract received; not yet fully classified |
| UNDER ANALYSIS | Item classification in progress |
| BUSINESS REVIEW REQUIRED | Classification ready for QA/Production/IT review |
| APPROVED FOR DIGITALIZATION | Written owner approval to build a digital ChecklistTemplate from this evidence |
| REJECTED | Explicitly out of digitalization scope |
| SUPERSEDED | Replaced by a later form/revision |

**Collecting a form does NOT mean APPROVED FOR DIGITALIZATION.**

## Approval Register linkage

| Approval ID | Topic | Linkage |
| --- | --- | --- |
| APR-001 | FG-QA-001 final content approval | Proposal remains draft until APPROVED; discovery may replace or validate it |
| APR-028 | Paper form inventory in MVP scope | Primary inventory gate (ASM-003) |
| APR-036 | Real form discovery package execution | This folder; owners must return inventory |
| APR-027 | CCP/OPRP classifications | Fill classification CCP?/OPRP? only from this evidence |
| APR-006 | Product specification limits | Fill Min/Max only from this evidence |

## Inventory snapshot (no invented rows)

Use [FORM_INVENTORY_TEMPLATE.csv](FORM_INVENTORY_TEMPLATE.csv) as the working sheet. Until owners return data, the repository inventory is **empty by design**.

| Form ID | Form Name | Status | Evidence Source | Notes |
| --- | --- | --- | --- | --- |
| — | — | — | — | No company form rows recorded yet |

## Candidate request list (existence unknown)

These are **request categories**, not confirmed Nelna forms.

| Request ID | Candidate category | Status | Owner | Blocking |
| --- | --- | --- | --- | --- |
| FORM-REQ-FG-QUALITY | FG Quality / release checklist | NOT RECEIVED | QA Manager (TBC) | TEMPLATE / MVP selection |
| FORM-REQ-TEMPERATURE | Temperature monitoring | NOT RECEIVED | QA Manager (TBC) | Limits (ASM-001) |
| FORM-REQ-WEIGHT | Weight / fill checks | NOT RECEIVED | QA / Production (TBC) | Engine NUMBER/sample gaps |
| FORM-REQ-PACKAGING | Packaging integrity | NOT RECEIVED | QA / Production (TBC) | MVP scope |
| FORM-REQ-LABEL | Label / date code | NOT RECEIVED | QA / Production (TBC) | Traceability |
| FORM-REQ-HYGIENE | Hygiene / GMP | NOT RECEIVED | QA Manager (TBC) | PRP/GMP marking |
| FORM-REQ-CLEANING | Cleaning / sanitation | NOT RECEIVED | QA / Production (TBC) | Frequency/trigger |
| FORM-REQ-METAL-DET | Metal detector | NOT RECEIVED | QA Manager (TBC) | CCP/OPRP evidence |
| FORM-REQ-STORAGE | Storage / cold room | NOT RECEIVED | QA / Warehouse (TBC) | Site-specific |
| FORM-REQ-LOADING | Loading checks | NOT RECEIVED | Dispatch / QA (TBC) | Post-QA workflows |
| FORM-REQ-DISPATCH | Dispatch | NOT RECEIVED | Dispatch / QA (TBC) | Post-QA workflows |
| FORM-REQ-VEHICLE | Vehicle inspection | NOT RECEIVED | Dispatch / QA (TBC) | Scope decision |
| FORM-REQ-SHIFT | Shift checks | NOT RECEIVED | Production (TBC) | Shift applicability |
| FORM-REQ-OTHER | Other QA/production forms | NOT RECEIVED | QA / FG (TBC) | Completeness of ASM-003 |

## Related non-inventory artifacts

| Artifact | Evidence class | Status |
| --- | --- | --- |
| [FG_QA_001_DRAFT_V0_1.md](../proposals/FG_QA_001_DRAFT_V0_1.md) | Project-proposed draft (not company controlled form) | NOT APPROVED — validation only |
| [TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md](../TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md) | Evidence contract | Open |
| AI industry reports (Claude/Gemini/etc.) | INDUSTRY RESEARCH / PROPOSED DESIGN INPUT | Not company evidence |

## Missing forms (summary)

All candidate categories above: **NOT RECEIVED**.  
Complete MVP paper inventory (ASM-003 / APR-028): **NOT RECEIVED**.  
Official FG controlled checklist source: **NOT RECEIVED** (proposal documents that none suitable currently exists).

## Next actions for owners

1. Return completed inventory CSV (or controlled equivalent) for forms in FG MVP scope.  
2. Provide copies/scans with revision and approval references.  
3. Complete item classification for each COLLECTED form.  
4. Decide which forms are APPROVED FOR DIGITALIZATION (written).  
5. Keep FG-QA-001 as proposal until APR-001 is resolved against real evidence.
