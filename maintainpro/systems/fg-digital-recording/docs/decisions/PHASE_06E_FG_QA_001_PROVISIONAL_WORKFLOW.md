# Phase 06E — FG-QA-001 Provisional Workflow Decision

**Document status:** OWNER-DIRECTED PROVISIONAL BUSINESS WORKFLOW
**Created:** 2026-08-07 (Phase 06E)
**Authority:** Project owner direction — **not** formal QA / Production sign-off
**Related proposal:** [FG_QA_001_DRAFT_V0_1.md](../business/proposals/FG_QA_001_DRAFT_V0_1.md)

## Purpose

Record owner-accepted provisional workflow direction so Phase 07A can build a safe technical foundation without inventing production policy.

This document does **not**:

- approve FG-QA-001 content for production use
- approve numerical limits (ASM-001 remains OPEN)
- authorize publishing FG-QA-001
- close TEMPLATE-001 / MASTER-001
- authorize Phase 07 production task generation for real batches

## Provisional decisions

| Topic | Owner-directed provisional decision |
| --- | --- |
| Trigger | A checklist is required for **every production batch** |
| Recorder business categories | Production Employee; Store Employee; QA (logical categories — not auto-mapped RBAC roles) |
| Supervisor review | **Every** submitted checklist requires Supervisor review |
| Final authority | **QA** is responsible for the final business disposition decision |
| Failed applicable check (future) | Batch should enter HOLD workflow; remarks required; corrective action recorded; Supervisor review required; QA makes final decision |
| Correction / resubmission (future) | Must **not** silently overwrite the original submitted record; preserve original answers, submission, correction history, actor, timestamp, audit trail |

## Explicit non-claims

- FG-QA-001 remains **PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED**
- Numerical specifications remain unapproved
- No production activation is authorized by this decision
- Phase 07A must **not** implement HOLD automation, response evaluation, recording, Supervisor approval, or QA disposition models
- Exact Django Role records for Production Employee / Store Employee / QA / Supervisor remain pending configuration

## Phase mapping (boundaries)

| Concern | Phase |
| --- | --- |
| Decision formalization | **06E** (this document) |
| Batch checklist task foundation (`batch_reference`) | **07A** |
| Operator recording / submission / correction history | **08** |
| Supervisor review | **09** |
| QA final disposition / verification | **10** |
| HOLD / NC / CAPA automation | later evidence-backed phases |

## Remaining unknowns (still EVIDENCE REQUIRED)

- FG-QA-001 final content approval
- Exact QA-approved numerical limits (ASM-001)
- Product / Site / Department applicability
- Exact user-to-business-role mapping
- Exact Shift relationship to a batch
- Automatic failure-evaluation semantics
- Effective published-version selection policy
- Integration source for production-batch creation

## References

- [FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md](../business/FG_QA_001_INTERNAL_VALIDATION_CHECKLIST.md)
- [PHASE_07_READINESS_GATE.md](../business/PHASE_07_READINESS_GATE.md)
- [ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md](../architecture/ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md)
