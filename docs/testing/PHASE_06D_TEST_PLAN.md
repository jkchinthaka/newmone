# Phase 06D Test Plan — FG-QA-001 Draft Loader & Validation Readiness

**Document status:** Phase 06D draft configuration + internal validation readiness
**Last updated:** 2026-08-07
**Proposal:** [FG_QA_001_DRAFT_V0_1.md](../business/proposals/FG_QA_001_DRAFT_V0_1.md) — **NOT APPROVED** for production
**Ops guide:** [FG_QA_001_DRAFT_LOADING.md](../operations/FG_QA_001_DRAFT_LOADING.md)

## Scope

Explicit `load_fg_qa_001_draft` management command and proposal loader service; CSV parse/validate; Organization-scoped DRAFT instantiation; idempotency and divergent-draft stop; never publish / never auto-seed / never Product assign; proposal review banner on FG-QA-001 versions; documentation for internal validation worksheet.

## Out of scope

Automatic publish; migration/startup seeding; runtime recording/submission; scheduling/tasks; automatic RELEASE/HOLD/REJECT; invented numerical limits; electronic business sign-off workflow; Phase 07.

## Coverage areas

| Area | Focus |
| --- | --- |
| Parser | Valid proposal CSV accepted; invalid types/rows/options/ranges rejected; strict headers |
| Command | Organization + actor required; dry-run writes nothing; first load creates Template + DRAFT |
| Idempotency | Identical re-load is no-op; no duplicate Template/DRAFT |
| Divergence | Existing DRAFT that differs from proposal is not overwritten |
| Lifecycle | Loaded version always DRAFT; published history unchanged; new DRAFT after published history when no conflicting draft |
| Content | 7 sections, 42 items; FGQA-41 SELECT options; limits unset |
| Security | Org isolation; no Product assignment; repository-controlled CSV path |
| UI | Proposal banner (NOT APPROVED); definition review only — no execution |
| Rollback | Populate failure leaves no partial rows |

Synthetic Organizations/Users in tests only. Do not treat loaded FG-QA-001 DRAFT content as approved business forms.
