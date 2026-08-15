# Phase 07 Readiness Gate — Scheduling / Tasks

**Document status:** Evidence-driven entry gate — **not** full Phase 07 production authorization
**Created:** 2026-08-07 (Phase 06B)
**Updated:** 2026-08-07 (Phase 06E / 07A)
**Depends on:** Phase 06A–06E; TEMPLATE-001 evidence; batch source for real generation

## Purpose

Distinguish **07A technical foundation** from **full Phase 07 production readiness**.

Do not invent answers. Do not create Schedule recurrence or recording models while production readiness remains open.

## Phase 07A technical foundation — AVAILABLE

- `apps.scheduling.ChecklistTask` with explicit `batch_reference` (no invented ProductionBatch master)
- PUBLISHED-only, explicit ChecklistVersion binding
- PENDING / CANCELLED orchestration lifecycle
- Org-scoped create / cancel / list / detail UI + RBAC + audit
- See [ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md](../architecture/ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md)

## Owner-directed provisional workflow (06E) — NOT formal sign-off

Recorded in [PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md](../decisions/PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md):

- Checklist required per production batch
- Recorder categories: Production Employee / Store Employee / QA (logical; not auto-mapped)
- Supervisor review mandatory on every submission (future Phase 09)
- QA final disposition authority (future Phase 10)
- Failed-check HOLD + remarks + corrective action + Supervisor + QA (future; not automated in 07A)
- Corrections must not silently overwrite originals (future Phase 08+)

## Still unresolved — REAL PRODUCTION TASK GENERATION BLOCKED

- Final FG-QA-001 content approval / publish (TEMPLATE-001 still **PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED**)
- Product applicability (MASTER-001 / ASM-001 open)
- Shift applicability
- Site / Department applicability
- Integration source for production-batch creation
- Exact user-to-business-role mapping
- Effective-version auto-selection policy (07A requires explicit version)
- Automatic failure-evaluation semantics

**Full Phase 07 production readiness remains blocked.**

## Readiness questions

| # | Question | Status |
| --- | --- | --- |
| 1 | At least one approved checklist definition exists (real TEMPLATE content)? | EVIDENCE REQUIRED — FG-QA-001 draft / DRAFT load is proposed review only, not approved |
| 2 | Scheduling trigger / frequency defined? | OWNER-PROVISIONAL: per production batch (06E) — not formal QA/Production sign-off |
| 3 | Scope relationship established (Organization / Product / Shift / Site / Department as applicable)? | EVIDENCE REQUIRED |
| 4 | Version selection / effective-date policy defined? | PARTIAL — 07A uses explicit version only; auto policy EVIDENCE REQUIRED |
| 5 | Who receives generated tasks? | OWNER-PROVISIONAL recorder categories (06E) — RBAC mapping EVIDENCE REQUIRED |
| 6 | What happens when a definition changes after tasks exist? | 07A: historical task version immutable; further policy EVIDENCE REQUIRED |
| 7 | Can tasks reference retired definitions? | NO for new tasks (07A) — retired rejected |
| 8 | Timezone / cutoff rules evidenced? | EVIDENCE REQUIRED |
| 9 | Fill / review / approve / QA verify / resubmit workflow evidenced (TEMPLATE-001 §10)? | OWNER-PROVISIONAL outline (06E); recording/review models not implemented |
| 10 | Batch source / integration for real generation? | EVIDENCE REQUIRED |

## Related

- [PHASE_07_PRODUCTION_READINESS_GATE.md](PHASE_07_PRODUCTION_READINESS_GATE.md)
- [PHASE_08_RECORDING_READINESS_GATE.md](PHASE_08_RECORDING_READINESS_GATE.md)
- [PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md](../decisions/PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md)
- [ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md](../architecture/ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md)
- [ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md](../architecture/ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md)
- [FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md](FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md)
- [TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md](TEMPLATE_001_CHECKLIST_EVIDENCE_INTAKE.md)
- [ROADMAP.md](../ROADMAP.md)
