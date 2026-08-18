# Phase 07 Production Readiness Gate

**Document status:** Evidence-driven gate — **not** production authorization
**Created:** 2026-08-07 (Phase 07B)
**Depends on:** Phase 07A foundation; Phase 06E provisional workflow; TEMPLATE / MASTER / ASM evidence

## Purpose

Separate **technical foundation** (07A/07B) from **real production task generation**.

Do not mark a gate passed without named evidence.

## Gates

| Gate | Question | Current status |
| --- | --- | --- |
| GATE 1 — Checklist approval | FG-QA-001 final approved definition available? | **NO** — PROJECT-PROPOSED DRAFT — VALIDATION REQUIRED |
| GATE 2 — Published definition | Approved ChecklistVersion published for production use? | **NO** |
| GATE 3 — Batch source | Production-batch source identified (system/API/event)? | **NO / EVIDENCE REQUIRED** |
| GATE 4 — Organization mapping | External batch → Organization mapping approved? | **EVIDENCE REQUIRED** |
| GATE 5 — Recorder role mapping | Production Employee / Store Employee / QA mapped to system roles? | **APPROVAL REQUIRED** — see [CHECKLIST_RECORDER_ROLE_MAPPING.md](CHECKLIST_RECORDER_ROLE_MAPPING.md) |
| GATE 6 — Product applicability | Required? Which Products? | **EVIDENCE REQUIRED** (MASTER-001 / ASM-001 open) |
| GATE 7 — Shift applicability | Required? Which Shifts? | **EVIDENCE REQUIRED** |
| GATE 8 — Site/Department applicability | Required? | **EVIDENCE REQUIRED** |
| GATE 9 — Version-selection policy | Explicit from source vs configured effective published version? | **EVIDENCE REQUIRED** (07A/07B require explicit version) |
| GATE 10 — Failure/retry operational owner | Defined for mapping/poison/retry failures? | **EVIDENCE REQUIRED** |

## Technical foundation already available (does not pass production gates)

- `ChecklistTask` + `batch_reference`
- PUBLISHED-only explicit version binding
- Org/template/batch idempotency
- Integration port (no ERP connector)
- Recording permission catalogue entry (`record_checklisttask`) — unassigned

## Verdict

**Real production checklist-task generation remains BLOCKED.**

## Related

- [PRODUCTION_BATCH_SOURCE_CONTRACT.md](../integration/PRODUCTION_BATCH_SOURCE_CONTRACT.md)
- [PHASE_07_READINESS_GATE.md](PHASE_07_READINESS_GATE.md)
- [PHASE_08_RECORDING_READINESS_GATE.md](PHASE_08_RECORDING_READINESS_GATE.md)
- [ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md](../architecture/ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md)
