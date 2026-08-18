# Assumption Register

**Document status:** Open assumptions — confirmation required before treating as fact
**Phase:** Living — still no APPROVED rows; technical foundations through Phase 10A do not resolve these
**Last updated:** 2026-08-09
**Approval workflow tracker:** [../governance/APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md)

## Labels

| Label | Meaning |
| --- | --- |
| ASSUMPTION | Working hypothesis only |
| DECISION REQUIRED | Owners must choose |
| OWNER REQUIRED | Named person/role holder needed |
| EVIDENCE REQUIRED | Controlled document or measurement needed |
| APPROVED | Confirmed — **none yet in this register** |

| ID | Statement | Owner | Evidence | Required date | Status | Development impact |
| --- | --- | --- | --- | --- | --- | --- |
| ASM-001 | Product temperature classes used in FG recording will be provided from approved controlled documents | QA owner | Controlled docs | Before Phase 06 content build | EVIDENCE REQUIRED | Blocks template limits and deterministic rules |
| ASM-002 | CCP/OPRP classifications relevant to digital checklists will be supplied by QA | QA owner | HACCP / related docs | Before Phase 06–10 rule config | EVIDENCE REQUIRED | Blocks critical-rule configuration |
| ASM-003 | A complete inventory of paper forms in scope will be provided | QA / FG | Form inventory — use [form-discovery/](form-discovery/) (Phase 06F); APR-028 / APR-036 | Before MVP checklist selection | EVIDENCE REQUIRED | Blocks TEMPLATE-002 confirmation; framework exists; inventory still NOT RECEIVED |
| ASM-004 | Site/org hierarchy depth and naming will be confirmed for pilot | Business / IT | Org chart / site list | Before inventing hierarchy values and before production Shift configuration | DECISION REQUIRED | Organization/Site/Department **models exist** (Phase 03); Phase 04C adds audited lifecycle + controlled import only. Official naming/codes remain unconfirmed — **no company catalogue loaded** |
| ASM-005 | Shift patterns for FG will be documented (names and codes) | Operations | Shift roster policy | Before production Shift configuration / operational use | EVIDENCE REQUIRED | Official Shift names/codes remain unresolved. Phase 04A/04C provide **configurable, unseeded** foundation + controlled import — no seeded Day/Night or Nelna business rows |
| ASM-006 | Night-shift operational day definition (which calendar date a night shift belongs to), timing, and effective-date rules will be confirmed | Operations / QA | Written rule | Before production overnight policy and before Phase 07 due dates | DECISION REQUIRED | Official timings and operational overnight policy remain unresolved. Provisional technical rule (`end_time <= start_time` ⇒ overnight) remains in 04A/04C — not production policy approval |
| ASM-007 | Approximate user numbers by role for pilot and production will be provided | Business / HR / IT | Headcount estimates | Before pilot planning | OWNER REQUIRED | Affects licensing of infra and UAT sizing |
| ASM-008 | Operator language requirements include mandatory Sinhala; English mix for other roles will be confirmed | Business / HR | Language survey / policy | Before Phase 01 content | EVIDENCE REQUIRED | Affects i18n and Figma content; DEBT-01C-R-NOTO still open |
| ASM-009 | Device ownership model (company vs personal) for operators will be decided | IT / Operations | Device policy | Before pilot | DECISION REQUIRED | Affects MDM, PWA install, security |
| ASM-010 | Wi-Fi coverage in recording areas is sufficient for online MVP | IT | Coverage survey | Before pilot | EVIDENCE REQUIRED | May force Phase 14 earlier or paper fallback |
| ASM-011 | Hygiene rules for device use in production areas will be documented | QA / Operations | Hygiene SOP | Before pilot | EVIDENCE REQUIRED | Affects enclosure/device UX guidance |
| ASM-012 | Certification schemes in scope (what the system must support operationally) will be listed without unsupported claims | QA | Scheme list | Before UAT design | EVIDENCE REQUIRED | Affects audit export expectations |
| ASM-013 | Record and evidence retention period will be approved | QA / Legal (TBC) | Retention policy | Before production | EVIDENCE REQUIRED | Affects storage and purge design |
| ASM-014 | ERP API availability and contract will be confirmed before integration work | IT / ERP vendor | API docs | Before Phase 17 | DECISION REQUIRED | Phase 17 blocked until available |
| ASM-015 | Hosting model for test/UAT/staging/production will be chosen | IT owner | Hosting decision | Before Phase 02 non-local envs | DECISION REQUIRED | Affects env strategy execution |
| ASM-016 | RPO and RTO targets will be approved | IT / Management | BC/DR policy | Before Phase 19 sign-off | DECISION REQUIRED | Affects backup architecture |
| ASM-017 | Expected records-per-day and photo volumes for pilot will be estimated | FG / QA | Volume estimate | Before Phase 11 sizing | ASSUMPTION until measured | Affects storage and performance tests |

## Phase 04 gate summary

ASM-004 / ASM-005 / ASM-006 remain **partially unresolved** for official business values.

| Topic | Status |
| --- | --- |
| Official org/site/department names and codes (ASM-004) | Unresolved |
| Official Shift names and codes (ASM-005) | Unresolved |
| Official timings and operational overnight policy (ASM-006) | Unresolved |
| Configurable unseeded Shift technical foundation (Phase 04A) | Provisionally unblocked by owner direction (2026-08-07) |
| Phase 04C controlled import / lifecycle foundation (no seeded company values) | Implemented — real values still pending ASM-004/005/006 |
| Real-data configuration / operational / production use | Remains blocked |

Do **not** invent Day/Night names, start/end times, shift codes, site/department codes, or claim production overnight policy.

See [PHASE_04_SHIFT_PROVISIONAL_CONFIGURATION.md](../decisions/PHASE_04_SHIFT_PROVISIONAL_CONFIGURATION.md) and [ADR-008](../architecture/ADR-008-CONFIGURABLE-SHIFT-FOUNDATION.md).

## Phase 05 gate summary

MASTER-001 remains **EVIDENCE REQUIRED** for official Product Master inventory and real catalogues.

| Topic | Status |
| --- | --- |
| Official Product Master field inventory / pilot data (MASTER-001) | Unresolved — EVIDENCE REQUIRED — use [MASTER_001_FG_PRODUCT_EVIDENCE_INTAKE.md](MASTER_001_FG_PRODUCT_EVIDENCE_INTAKE.md) |
| Configurable unseeded FG Product technical foundation (Phase 05A) | Implemented (provisional technical only) |
| Product UI authorization hardening (Phase 05B) | Implemented — object-aware manage affordances; site-only does not escalate |
| FG Product master expansion + controlled import (Phase 05C) | Implemented — optional blank mapping fields; header-only CSV import; **no** official catalogue loaded |
| Equipment / calibration foundation (Phase 05D) | Implemented — unseeded equipment + calibration records; fitness labels only; **no** invented intervals; overdue block/warn **EVIDENCE REQUIRED** |
| Training / competency foundation (Phase 05E) | Implemented — unseeded training records + OFF/WARN/BLOCK policy metadata; **no** invented matrix; recording auto-block **not** enabled |
| Site / Product ownership | Unresolved — provisional ownership remains organization-scoped |
| Official category / UOM / ERP catalogues | Unresolved — optional blank columns only where 05C added them; equipment/training assets not seeded |
| Official operator training matrix / gate policy (APR-042) | Unresolved — EVIDENCE REQUIRED |
| Calibration intervals / overdue block-or-warn policy | Unresolved — EVIDENCE REQUIRED |
| Real Product catalogue load | Remains blocked pending MASTER-001 / APR-005 |
| Real-data configuration / operational / production use | Remains blocked |

Do **not** invent product catalogues, ERP mappings, or claim MASTER-001 resolved.

## Phase 06 gate summary

TEMPLATE-001 / ASM-003 form inventory and official checklist content remain **EVIDENCE REQUIRED**. TEMPLATE-001 now has a **project-proposed draft** for validation only — **not** fully approved.

| Topic | Status |
| --- | --- |
| Official checklist forms / questions / limits | Unresolved — EVIDENCE REQUIRED — use [TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md](TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md) and [form-discovery/](form-discovery/) (Phase 06F) |
| TEMPLATE-001 project proposal | **PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED** — Phase 06N **BLOCKED — BUSINESS APPROVAL REQUIRED**; [proposals/FG_QA_001_DRAFT_V0_1.md](proposals/FG_QA_001_DRAFT_V0_1.md); matrix all PENDING DECISION (NOT APPROVED; not auto-seeded; not published) |
| Explicit DRAFT loader (Phase 06D) | Available — `load_fg_qa_001_draft` loads Organization-scoped DRAFT for review only; never publishes; never auto-seeds — see [FG_QA_001_DRAFT_LOADING.md](../operations/FG_QA_001_DRAFT_LOADING.md) |
| Internal validation worksheet | Available — [FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md](FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md) — existence is not approval |
| Owner-directed provisional workflow (Phase 06E) | Recorded — per-batch trigger; recorder categories; Supervisor/QA authority outline; future HOLD/correction invariants — **not** formal QA/Production sign-off — see [PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md](../decisions/PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md) |
| Configurable unseeded definition/versioning engine (Phase 06A) | Implemented (provisional technical only) |
| Lifecycle governance hardening (Phase 06B) | Implemented — centralized transitions; immutability; concurrency tests |
| Response-type schema (Phase 06C) | Provisional technical primitives for **definition schema only** — see [RESPONSE_TYPE_DECISION_REGISTER.md](RESPONSE_TYPE_DECISION_REGISTER.md); PHOTO/SIGNATURE/etc still deferred |
| ASM-001 temperature-class limits | Remains **open** — EVIDENCE REQUIRED; limits unset on FG-QA-001 draft |
| MASTER-001 Product catalogue / fields | Remains **open** — EVIDENCE REQUIRED; no Product codes in FG-QA-001 draft; loader does not assign Products |
| Batch checklist task foundation (Phase 07A) | Implemented technically — `scheduling.ChecklistTask` + `batch_reference`; PUBLISHED-only explicit version; no ProductionBatch master; no recording/HOLD |
| Batch source / ERP connector | Unresolved — EVIDENCE REQUIRED — contract only: [PRODUCTION_BATCH_SOURCE_CONTRACT.md](../integration/PRODUCTION_BATCH_SOURCE_CONTRACT.md); no invented endpoints |
| Recorder role mapping (Phase 07B) | Permission `scheduling.record_checklisttask` exists unassigned; mapping APPROVAL REQUIRED — [CHECKLIST_RECORDER_ROLE_MAPPING.md](CHECKLIST_RECORDER_ROLE_MAPPING.md) |
| Scheduling / recording / review / QA | **08A–09B** recording/submission/correction complete; **09A** Supervisor review complete; **10A** QA disposition technical foundation complete; production recording/review/correction/QA still gated — see readiness gates for Phases 08–10 and PHASE_10_POST_QA_WORKFLOW_GATE |
| Real-content / operational / production use | Remains blocked |

See [PHASE_06_CHECKLIST_PROVISIONAL_CONFIGURATION.md](../decisions/PHASE_06_CHECKLIST_PROVISIONAL_CONFIGURATION.md) and [ADR-010](../architecture/ADR-010-CHECKLIST-DEFINITION-VERSIONING.md).

**No row is APPROVED.** Development must not hard-code these as Nelna facts.

### Phase 06O note (2026-08-10)

Technical versioned product-specification storage is on main (ProductSpecification / SpecificationVersion / SpecificationParameter). **ASM-001 / APR-006 remain EVIDENCE REQUIRED** — no temperature/weight/microbiological Nelna limits were seeded.
