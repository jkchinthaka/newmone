# ADR-010 — Checklist Definition and Versioning (Phase 06A / 06B / 06C / 06D)

**Status:** Accepted (provisional technical direction; 06B governance hardening; 06C response-definition schema; 06D explicit DRAFT proposal loader)
**Date:** 2026-08-07
**Updated:** 2026-08-07 (Phase 06D)

## Context

Phase 06 requires versioned checklist definitions for later scheduling and recording. TEMPLATE-001 / ASM-003 form inventory and official checklist content were not supplied. ASM-001 temperature-class limits remain unresolved. Waiting indefinitely blocks technical progress. The project owner directed a configurable, unseeded definition/versioning foundation. Phase 06B hardens lifecycle governance without inventing content. Phase 06C adds a minimum generic **response-definition** schema so proposed forms (e.g. FG-QA-001 draft) can be structured without inventing limits or enabling runtime execution. Phase 06D adds an **explicit** management-command path to instantiate the FG-QA-001 proposal as an Organization-scoped **DRAFT** for review — never auto-seeded, never auto-published.

## Decision

1. Bounded context: `apps/checklists` — **definitions only**.
2. Entities: `ChecklistTemplate`, `ChecklistVersion`, `ChecklistSection`, `ChecklistItem` (plus SELECT option rows as required by 06C).
3. Organization-scoped templates; **optional** provisional `FGProduct` association.
4. Lifecycle: DRAFT → PUBLISHED → RETIRED only. Transitions are centralized (`assert_version_transition_allowed`). Reverse / skip transitions are denied.
5. Published/retired structure is immutable through services, HTTP mutations, and admin structural paths (including response schema and options).
6. New changes require a new DRAFT (blank or cloned). Cloning copies rows from DRAFT/PUBLISHED/RETIRED sources; rows are never shared; source remains unchanged; SELECT options clone with items.
7. Version numbers allocated under template row lock (`select_for_update` + max+1) with uniqueness constraint and one IntegrityError retry.
8. Contiguous positions are maintained after remove (recompact); reorder uses safe sentinel swap.
9. Template catalogue fields (`code`, `name`, `description`, `product`, `is_active`) are identity/catalogue metadata. Changing them does **not** mutate historical `ChecklistVersion` section/item rows. Historical definition text lives on version-owned rows.
10. **Phase 06C response-definition schema (provisional technical primitives for definition schema only):**
    - `YES_NO`, `YES_NO_NA`, `NUMBER`, `TEXT`, `SELECT`
    - Temperature checks use **NUMBER + unit** (e.g. proposed °C); no separate temperature type
    - Optional NUMBER min/max may remain **unset**; inventing limits is prohibited
    - SELECT requires ≥1 valid option to publish; option values such as RELEASE/HOLD/REJECT are workflow **labels only** — no automatic release engine
    - PHOTO, SIGNATURE, and other types remain deferred
11. No instrument/training/QA-rule/release-blocker fields in 06C.
12. No Schedule/Task/Record/Submission/Review/Verification/Evidence entities.
13. Permissions: `checklists.view_checklisttemplate`, `checklists.manage_checklist` (org-scoped); UI uses precomputed manageable organization IDs.
14. Audit events: `CHECKLIST_TEMPLATE_*`, `CHECKLIST_VERSION_*` with safe metadata (no full question text).
15. Publish requires a non-empty technical definition graph (≥1 section and ≥1 item with non-blank titles/codes/labels) plus valid `response_type` (and SELECT options when applicable). Structural integrity only — not a business minimum question count; min/max not required.
16. FG-QA-001 Draft v0.1 is a **project proposal** — **NOT APPROVED** for production. Documentation artifacts remain the human review source; CSV is the machine-readable loader source.
17. **Phase 06D explicit DRAFT loader:**
    - Management command `load_fg_qa_001_draft` requires `--organization` and `--actor` UUIDs (no defaults).
    - Instantiates Organization-scoped Template + DRAFT only; supports `--dry-run`.
    - Never publishes; never auto-seeds (migrate/startup/fixtures); never assigns Products.
    - Idempotent when existing DRAFT matches proposal fingerprint; **stops** without overwrite when DRAFT diverges.
    - Proposal review banner in management UI; no execution / recording controls.

## Consequences

- Unblocks Phase 06 technical work without inventing approved form content or limits.
- Phase 07 remains evidence-gated ([PHASE_07_READINESS_GATE.md](../business/PHASE_07_READINESS_GATE.md)).
- MASTER-001 / ASM-001 / TEMPLATE-001 evidence remain open (TEMPLATE-001 = PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED).
- Phase 06 roadmap content exit criterion remains unmet until official forms are evidenced and approved.
- Loading a DRAFT for review does not constitute business approval.

## Related

- [PHASE_06_CHECKLIST_PROVISIONAL_CONFIGURATION.md](../decisions/PHASE_06_CHECKLIST_PROVISIONAL_CONFIGURATION.md)
- [RESPONSE_TYPE_DECISION_REGISTER.md](../business/RESPONSE_TYPE_DECISION_REGISTER.md)
- [proposals/FG_QA_001_DRAFT_V0_1.md](../business/proposals/FG_QA_001_DRAFT_V0_1.md)
- [FG_QA_001_DRAFT_LOADING.md](../operations/FG_QA_001_DRAFT_LOADING.md)
- [FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md](../business/FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md)
- [TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md](../business/TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md)
- [MODULE_MAP.md](MODULE_MAP.md)
- [CHECKLIST_DEFINITION_MANAGEMENT_UI.md](../design/CHECKLIST_DEFINITION_MANAGEMENT_UI.md)
- [PHASE_06C_TEST_PLAN.md](../testing/PHASE_06C_TEST_PLAN.md)
- [PHASE_06D_TEST_PLAN.md](../testing/PHASE_06D_TEST_PLAN.md)
