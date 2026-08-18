# ADR-012 — Batch Source Contract and Recorder Authorization (Phase 07B)

**Status:** Accepted (readiness / architecture; production generation still gated)
**Date:** 2026-08-07
**Depends on:** ADR-011; Phase 06E provisional workflow

## Context

Phase 07A provides ChecklistTask orchestration with `batch_reference`. The real production-batch source (ERP/Bileeta/other) is unknown. Operator recording must not reuse administrative manage permissions. FG-QA-001 remains an unapproved DRAFT.

## Decision

1. **No ProductionBatch model** and **no ERP adapter** until source evidence exists (Phase 17 remains the planned ERP integration window unless earlier evidence justifies otherwise).
2. Publish a **batch source contract** documenting required conceptual fields with EVIDENCE REQUIRED markers — no invented URLs/tables/credentials.
3. Provide a **thin integration port** (`BatchChecklistTaskRequest` → `create_batch_checklist_task`) with only currently supported technical inputs.
4. **No source_system / source_event_id columns now.** Current idempotency remains `(organization, checklist_template, batch_reference)`. Future external-event identity may require a migration after evidence.
5. Introduce catalogue permission **`scheduling.record_checklisttask`** separate from view/manage.
6. **Do not auto-map** Production Employee / Store Employee / QA to system Roles.
7. Document Phase 08 eligibility: PENDING + historical published binding + org-scoped record permission + not cancelled.
8. Supervisor review and QA disposition permissions remain deferred to Phases 09/10.
9. FG-QA-001 stays DRAFT; PUBLISHED-only task creation remains enforced.

## Consequences

- Production task generation and Phase 08 recording remain blocked by readiness gates.
- Manage capability cannot be treated as recording capability.
- External adapters (when evidenced) must call the integration port / domain service — not invent parallel create paths.

## References

- [PRODUCTION_BATCH_SOURCE_CONTRACT.md](../integration/PRODUCTION_BATCH_SOURCE_CONTRACT.md)
- [CHECKLIST_RECORDER_ROLE_MAPPING.md](../business/CHECKLIST_RECORDER_ROLE_MAPPING.md)
- [PHASE_07_PRODUCTION_READINESS_GATE.md](../business/PHASE_07_PRODUCTION_READINESS_GATE.md)
- [PHASE_08_RECORDING_READINESS_GATE.md](../business/PHASE_08_RECORDING_READINESS_GATE.md)
- [ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md](ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md)
