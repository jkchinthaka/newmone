# Phase 07D — Checklist Effective Version Policy

**Document status:** Technical foundation — **not** business approval of as-of policy  
**Phase:** 07D  
**Related:** APR-015; ADR-010; Phase 07A explicit version binding; Phase 07C applicability  

---

## Unresolved business decision (do not invent)

**APR-015 — which instant is `as_of`?**

| Candidate | Status |
| --- | --- |
| Task creation time | DECISION REQUIRED |
| Batch creation time | DECISION REQUIRED |
| Production completion time | DECISION REQUIRED |
| Another approved business event | DECISION REQUIRED |

The engine accepts a caller-supplied `as_of` datetime. It does **not** invent which business event supplies that value.

---

## Technical effectivity

On `ChecklistVersion`:

- `effective_from` / `effective_to` — optional inclusive UTC datetimes  
- Null bound = unbounded on that side  
- Only **PUBLISHED** versions are eligible for new selection  
- **RETIRED** versions remain readable for historical task pins  
- Existing `ChecklistTask.checklist_version` pins are **never auto-upgraded**

---

## Selection outcomes

| Outcome | Meaning |
| --- | --- |
| `ONE_ELIGIBLE_VERSION` | Exactly one PUBLISHED version covers `as_of` |
| `NO_ELIGIBLE_VERSION` | BLOCKED — no silent fallback |
| `OVERLAPPING_ELIGIBLE_VERSIONS` | BLOCKED — no arbitrary pick |
| `INVALID_TEMPLATE` | Missing / inactive template |

API: `apps.checklists.effective_version.resolve_effective_checklist_version`  
Task helper: `create_batch_checklist_task_using_effective_version` (explicit UUID path remains for 07A).

---

## Audit

- Publish / retire metadata includes effectivity fields  
- `CHECKLIST_VERSION_EFFECTIVITY_UPDATED` when windows change  

---

## STATUS: PHASE 07D EFFECTIVE VERSION POLICY COMPLETE
