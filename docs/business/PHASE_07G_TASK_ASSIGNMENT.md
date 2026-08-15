# Phase 07G — Checklist Task Assignment

**Document status:** Technical ownership workflow — assignment ≠ authorization  
**Phase:** 07G  

---

## Rule

**Assignment does not grant permission.** Assignees must still hold scoped RBAC (iew / manage / 
ecord / ssign) independently.

## Ownership architecture

| Kind | Status |
| --- | --- |
| USER | Implemented |
| ROLE | Supported ownership metadata |
| DEPARTMENT | Supported ownership metadata |
| SHIFT | Supported ownership metadata |
| TEAM | Opaque ssigned_team_code only — Team master EVIDENCE REQUIRED |

## History

Append-only ChecklistTaskAssignmentEvent for ASSIGN / REASSIGN / UNASSIGN with ssigned_by, ssigned_at, optional reason. Never overwrite or delete history.

## Queues (view-scoped)

- My Tasks — USER ownership for the actor
- Unassigned Tasks — blank ssignee_kind
- Assigned Tasks — any non-blank ownership

Permission: scheduling.assign_checklisttask (distinct from manage/record).

---

## STATUS: PHASE 07G TASK ASSIGNMENT COMPLETE
