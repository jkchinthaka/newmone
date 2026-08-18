# Checklist Recorder / Reviewer Role Mapping

**Document status:** Configuration worksheet — **not** an approved RBAC assignment
**Created:** 2026-08-07 (Phase 07B)
**Updated:** 2026-08-08 (Phase 10A)
**Permission foundation:** `scheduling.record_checklisttask`; `reviews.review_checklistsubmission`; `quality.qa_review_checklistsubmission`
**Related:** [PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md](../decisions/PHASE_06E_FG_QA_001_PROVISIONAL_WORKFLOW.md), [ADR-015-SUPERVISOR-REVIEW.md](../architecture/ADR-015-SUPERVISOR-REVIEW.md), [ADR-016-CHECKLIST-CORRECTION-RESUBMISSION.md](../architecture/ADR-016-CHECKLIST-CORRECTION-RESUBMISSION.md), [ADR-017-QA-FINAL-REVIEW-DISPOSITION.md](../architecture/ADR-017-QA-FINAL-REVIEW-DISPOSITION.md)



## Phase 03C governance pointers

Technical permission catalogue and proposed (not approved) business categories:

- [PHASE_03C_ROLE_GOVERNANCE.md](../governance/PHASE_03C_ROLE_GOVERNANCE.md)
- [PERMISSION_MATRIX.md](../security/PERMISSION_MATRIX.md)
- [SOD_DECISION_REGISTER.md](../governance/SOD_DECISION_REGISTER.md)

Status: **PHASE 03C BUSINESS ROLE APPROVAL PENDING** (APR-007/008/009/010 remain EVIDENCE REQUIRED).

## Purpose

Map owner-directed **logical** recorder and Supervisor-review business categories to
actual system Roles before production recording/review is enabled.

Do **not** treat this table as populated by engineering guesswork.

## Capability separation

| Capability | Permission (technical) | Meaning |
| --- | --- | --- |
| View task | `scheduling.view_checklisttask` | Inspect orchestration tasks |
| Manage task | `scheduling.manage_checklisttask` | Create/cancel administrative tasks |
| Record checklist | `scheduling.record_checklisttask` | Enter/submit responses |
| Supervisor review | `reviews.review_checklistsubmission` | Review immutable submissions |
| QA final review | `quality.qa_review_checklistsubmission` | Record immutable RELEASE/HOLD/REJECT |

`manage_checklisttask` does **not** imply `record_checklisttask`.
`record_checklisttask` does **not** imply `review_checklistsubmission` or QA review.
`review_checklistsubmission` does **not** imply recording, task management, or QA review.
`qa_review_checklistsubmission` does **not** imply Supervisor review, recording, or manage.

## Intended business categories (provisional)

### Recorders

- Production Employee
- Store Employee
- QA

### Supervisor review

- Supervisor Review (logical category)

These are **not** automatically assigned to any Django Role. Do **not** assume a role
named `SUPERVISOR` exists or should receive permission.

## Recorder mapping table

| Business category | System role (code/UUID) | Scope | Recording permission | Approved by | Approval date | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Production Employee | CONFIGURATION / APPROVAL REQUIRED | CONFIGURATION / APPROVAL REQUIRED | `scheduling.record_checklisttask` | CONFIGURATION / APPROVAL REQUIRED | — | Logical category only |
| Store Employee | CONFIGURATION / APPROVAL REQUIRED | CONFIGURATION / APPROVAL REQUIRED | `scheduling.record_checklisttask` | CONFIGURATION / APPROVAL REQUIRED | — | Logical category only |
| QA | CONFIGURATION / APPROVAL REQUIRED | CONFIGURATION / APPROVAL REQUIRED | `scheduling.record_checklisttask` | CONFIGURATION / APPROVAL REQUIRED | — | Recorder category ≠ QA disposition authority |

## Supervisor Review mapping table

| Business category | System role | Organization/Site/Department scope | Permission | Approved by | Approval date | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Supervisor Review | CONFIGURATION / APPROVAL REQUIRED | CONFIGURATION / APPROVAL REQUIRED | `reviews.review_checklistsubmission` | CONFIGURATION / APPROVAL REQUIRED | — | Logical category only; no auto-assignment |

## QA Final Review mapping table

| Business category | System role | Organization/Site/Department scope | Permission | Approved by | Approval date | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| QA Final Review | CONFIGURATION / APPROVAL REQUIRED | CONFIGURATION / APPROVAL REQUIRED | `quality.qa_review_checklistsubmission` | CONFIGURATION / APPROVAL REQUIRED | — | Logical category only; no auto-assignment; recorder QA category ≠ this permission |

## Segregation of duties

| Rule | Status |
| --- | --- |
| Same user must not both submit and Supervisor-review the same submission | **EVIDENCE REQUIRED** — **not** enforced in Phase 09A |
| Same user must not both submit and QA-review the same submission | **EVIDENCE REQUIRED** — **not** enforced in Phase 10A |
| Same user must not both Supervisor-review and QA-review the same submission | **EVIDENCE REQUIRED** — **not** enforced in Phase 10A |

Architecture keeps `submitted_by`, `SupervisorReview.reviewed_by`, and
`QAReview.reviewed_by` distinct fields so a future SoD rule can be enforced
without schema redesign.

## Future recording eligibility (Phase 08 contract)

A task may eventually be recorded only if:

1. Task status is `PENDING`
2. Bound `ChecklistVersion` remains the historical definition used at task creation
3. Actor has `record_checklisttask` in the task Organization scope
4. Task is not cancelled

## Future Supervisor review eligibility (Phase 09A contract)

A submission may be reviewed only if:

1. Record status is `SUBMITTED`
2. Immutable `ChecklistSubmission` exists
3. No `SupervisorReview` exists yet for that submission
4. Actor has `review_checklistsubmission` in the Organization scope

## Correction / resubmission eligibility (Phase 09B contract)

A correction may start only if:

1. Source submission is the latest for the record
2. Source has `SupervisorReview` with `RETURNED_FOR_CORRECTION`
3. No newer submission exists
4. Task is not `CANCELLED`
5. Actor has `record_checklisttask` in Organization scope

**Ownership locking** (only original submitter may correct): **EVIDENCE REQUIRED** — not enforced.
Any authorized recorder in the Organization scope may start/edit/resubmit a correction.
Manage-task and review permissions do **not** imply correction permission.
## QA final review eligibility (Phase 10A contract)

A submission may receive QA disposition only if:

1. Record status is `SUBMITTED`
2. Submission is the latest for the record
3. `SupervisorReview` exists with decision `APPROVED`
4. No `QAReview` exists yet for that submission
5. Task is not `CANCELLED`
6. Actor has `qa_review_checklistsubmission` in Organization scope

RELEASE / HOLD / REJECT are manual provisional labels only. They do not imply ERP,
inventory, warehouse, or dispatch execution.
