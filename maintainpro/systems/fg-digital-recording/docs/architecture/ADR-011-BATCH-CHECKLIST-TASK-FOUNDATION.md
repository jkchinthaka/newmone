# ADR-011 — Batch Checklist Task Foundation (Phase 07A)

**Status:** Accepted (technical foundation; production task generation still gated)
**Date:** 2026-08-07
**Depends on:** ADR-010; Phase 06E provisional workflow decision

## Context

Owner-directed provisional workflow states that a checklist is required for every production batch. Full ProductionBatch master schema, Product/Shift applicability, and FG-QA-001 content approval remain unresolved. Phase 07 needs a safe orchestration foundation without inventing batch ERP fields or enabling checklist execution.

## Decision

1. Introduce bounded context `apps.scheduling` (not `tasks`, to avoid Celery ambiguity; not `schedules` recurrence yet).
2. Model `ChecklistTask` with:
   - Organization, ChecklistTemplate, ChecklistVersion (explicit), `batch_reference`, status `PENDING` | `CANCELLED`
3. Defer full `ProductionBatch` schema; use required trimmed `batch_reference` (case-preserving).
4. Tasks may reference **PUBLISHED** versions only — never DRAFT or RETIRED.
5. Version selection is **explicit** — never auto-select latest published.
6. Dedupe identity: unique `(organization, checklist_template, batch_reference)`.
7. Same identity + same version → idempotent return; same identity + different version → reject (no silent rewrite).
8. Cancel soft-cancels; no hard delete.
9. Permissions: `scheduling.view_checklisttask`, `scheduling.manage_checklisttask` — not recording permissions.
10. Audit: `CHECKLIST_TASK_CREATED`, `CHECKLIST_TASK_CANCELLED` with operational metadata including `batch_reference`.
11. **Phase 07B:** thin integration port + `scheduling.record_checklisttask` catalogue permission (unassigned); no ERP connector; no source_system columns — see [ADR-012](ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md).

## Boundaries

| In Phase 07A | Out of scope |
| --- | --- |
| Manual create / list / detail / cancel UI | Operator recording (08) |
| Explicit published version binding | Supervisor review (09) |
| Org-scoped RBAC + audit | QA disposition (10) |
| | Automatic HOLD / RELEASE / REJECT |
| | Product / Shift / Site task scope fields |
| | Celery / periodic generation |
| | Publishing FG-QA-001 |

| In Phase 07B | Out of scope |
| --- | --- |
| Batch source contract (EVIDENCE REQUIRED fields) | Real ERP/Bileeta connector |
| Integration port delegating to create service | Webhooks / polling |
| `record_checklisttask` permission declaration | Auto role mapping / recording UI |
| Production + Phase 08 readiness gates | Response/submission models |

## Consequences

- FG-QA-001 cannot generate real tasks until approved and published (intentional).
- Real production generation remains blocked until batch source integration and remaining business decisions are evidenced.
- Recurrence/`Schedule` models remain deferred.
- Manage task permission must never be treated as recording permission.

## References

- [PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md](../decisions/PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md)
- [MODULE_MAP.md](MODULE_MAP.md)
- [PHASE_07_READINESS_GATE.md](../business/PHASE_07_READINESS_GATE.md)
- [PHASE_07_PRODUCTION_READINESS_GATE.md](../business/PHASE_07_PRODUCTION_READINESS_GATE.md)
- [ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md](ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md)
