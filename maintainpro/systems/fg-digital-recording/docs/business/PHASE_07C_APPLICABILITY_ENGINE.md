# Phase 07C — Checklist Applicability Engine

**Document status:** Technical foundation — **not** production task-generation authorization  
**Phase:** 07C  
**Related:** APR-013 / APR-014 / APR-015; `PHASE_07_PRODUCTION_READINESS_GATE.md`

---

## Purpose

Determine which checklist template/version applies to an operational context using configurable, version-safe rules — without inventing Nelna Line/Process masters or silently choosing among conflicts.

---

## Dimensions

| Dimension | Status |
| --- | --- |
| Organization | Required scope (no cross-org matching) |
| Product (`FGProduct`) | Optional; null = wildcard |
| Site | Optional; null = wildcard |
| Department | Optional; null = wildcard |
| Shift | Optional; null = wildcard |
| Effective date (`effective_from` / `effective_to`) | Optional; unbounded when blank |
| `process_reference` | Optional **free-text label only** — not a Process master |
| Production Line | **Not modeled** — DECISION REQUIRED / EVIDENCE REQUIRED |
| Process master | **Not modeled** — DECISION REQUIRED / EVIDENCE REQUIRED |

---

## Outcomes (never silent)

| Outcome | Meaning |
| --- | --- |
| `NO_MATCH` | No active valid rule matched |
| `ONE_MATCH` | Exactly one valid rule — may be used by callers |
| `MULTIPLE_MATCHES` | Conflict — **never** auto-pick first |
| `INVALID_INACTIVE_REFERENCE` | Context or matched targets invalid/inactive/non-PUBLISHED |

Rules pin an exact **PUBLISHED** `ChecklistVersion` (never auto-latest).

---

## Historical safety

Existing `ChecklistTask` rows keep their pinned `checklist_version` even if applicability rules change later. Hard delete of rules is refused.

---

## Preview

- Management UI: `scheduling/applicability/preview/`
- CLI: `manage.py preview_checklist_applicability --organization … --actor …`
- Permissions: `scheduling.view_checklistapplicability` / `manage_checklistapplicability`

---

## Production gate

Real automated task generation remains **BLOCKED** until APR-013/014/015 and Phase 07 production gates are evidenced.

---

## STATUS: PHASE 07C APPLICABILITY ENGINE COMPLETE
