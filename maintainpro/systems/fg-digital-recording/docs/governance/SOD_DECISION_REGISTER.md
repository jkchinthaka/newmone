# Segregation of Duties (SoD) Decision Register

**Document status:** Open decision register — **not** enforced Nelna policy  
**Phase:** 03C  
**Rule:** No response = **PENDING**. Silence is not approval. Do not invent SoD rules in application code until APR-010 is APPROVED with named owners.

Related: [APPROVAL_REGISTER.md](APPROVAL_REGISTER.md) APR-010; [PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md](../business/PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md)

## Open questions

| ID | Question | Owner | Response | Status | Enforcement in app |
| --- | --- | --- | --- | --- | --- |
| SOD-01 | Can a recorder Supervisor-review their own submission? | QA Manager / Management Sponsor | — | **PENDING** | Phase 09C surfaces PENDING explicitly; PROHIBIT/ALLOW only when org governance has owner `evidence_reference` |
| SOD-02 | Can a Supervisor act as QA for the same submission? | QA Manager / Management Sponsor | — | **PENDING** | Not enforced (10A) |
| SOD-03 | Can QA record production checks? | QA Manager / Production Manager | — | **PENDING** | Permissions are separable; mapping unapproved |
| SOD-04 | Can System Admin / Django superuser make QA disposition? | QA Manager / IT Manager | — | **PENDING** | Superuser bypasses RBAC technically; **not** business QA authority |
| SOD-05 | Can a user publish checklist definitions and approve their own content? | QA Manager | — | **PENDING** | Publish is technical; content approval evidence-gated |
| SOD-06 | Can specification editor approve their own change? | QA Manager | — | **PENDING** | Spec editor authority unresolved |

## Technical readiness for future enforcement

Distinct fields already exist:

- `ChecklistSubmission.submitted_by`
- `SupervisorReview.reviewed_by`
- `QAReview.reviewed_by`

Future SoD rules can compare these without schema redesign once APR-010 is APPROVED.
