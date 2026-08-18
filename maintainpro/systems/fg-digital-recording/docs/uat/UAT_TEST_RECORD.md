# Phase 20 — UAT test record

**Record status:** Opened for business execution — **no scenarios executed in a management-approved pilot environment**.

**Environment:** NOT CONFIGURED (hosted UAT/pilot EVIDENCE REQUIRED)
**Build / commit under test:** _(record at execution)_
**Pilot scope reference:** [PILOT_SCOPE.md](PILOT_SCOPE.md) — incomplete

## Field definitions

| Field | Meaning |
| --- | --- |
| Actual | What the tester observed |
| PASS/FAIL | Business tester judgment vs Expected |
| Observation | Defects, UX notes, data issues |
| Owner | Named business/IT owner of follow-up |
| Retest | Date / result after fix |
| Business Approval | Named approver + date + evidence link — never invented |

## Scenarios

| Test ID | Persona | Preconditions | Steps | Expected | Actual | PASS/FAIL | Observation | Owner | Retest | Business Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-AUTH-001 | All | See UAT_PLAN + approved pilot scope | Execute: Login with valid employee code/password | Behaviour matches approved SOP for Login with valid employee code/password | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-AUTH-002 | All | See UAT_PLAN + approved pilot scope | Execute: Login failure / lockout behaviour (no credential leak) | Behaviour matches approved SOP for Login failure / lockout behaviour (no credential leak) | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-AUTH-003 | All | See UAT_PLAN + approved pilot scope | Execute: Session timeout / logout | Behaviour matches approved SOP for Session timeout / logout | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-REC-001 | Recorder | See UAT_PLAN + approved pilot scope | Execute: See assigned ChecklistTask for approved pilot scope | Behaviour matches approved SOP for See assigned ChecklistTask for approved pilot scope | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-REC-002 | Recorder | See UAT_PLAN + approved pilot scope | Execute: Start recording / open form | Behaviour matches approved SOP for Start recording / open form | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-REC-003 | Recorder | See UAT_PLAN + approved pilot scope | Execute: Save Draft | Behaviour matches approved SOP for Save Draft | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-REC-004 | Recorder | See UAT_PLAN + approved pilot scope | Execute: Submit checklist record | Behaviour matches approved SOP for Submit checklist record | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-REC-005 | Recorder | See UAT_PLAN + approved pilot scope | Execute: Upload required evidence (if item requires) | Behaviour matches approved SOP for Upload required evidence (if item requires) | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-SUP-001 | Supervisor | See UAT_PLAN + approved pilot scope | Execute: Queue shows submitted records in scope | Behaviour matches approved SOP for Queue shows submitted records in scope | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-SUP-002 | Supervisor | See UAT_PLAN + approved pilot scope | Execute: Approve submission | Behaviour matches approved SOP for Approve submission | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-SUP-003 | Supervisor | See UAT_PLAN + approved pilot scope | Execute: Return for correction with reason | Behaviour matches approved SOP for Return for correction with reason | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-COR-001 | Recorder | See UAT_PLAN + approved pilot scope | Execute: Start correction from returned review | Behaviour matches approved SOP for Start correction from returned review | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-COR-002 | Recorder | See UAT_PLAN + approved pilot scope | Execute: Edit correction draft and resubmit | Behaviour matches approved SOP for Edit correction draft and resubmit | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-SUP-004 | Supervisor | See UAT_PLAN + approved pilot scope | Execute: Approve resubmission | Behaviour matches approved SOP for Approve resubmission | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-QA-001 | QA | See UAT_PLAN + approved pilot scope | Execute: QA queue visibility for in-scope records | Behaviour matches approved SOP for QA queue visibility for in-scope records | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-QA-002 | QA | See UAT_PLAN + approved pilot scope | Execute: QA RELEASE disposition | Behaviour matches approved SOP for QA RELEASE disposition | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-QA-003 | QA | See UAT_PLAN + approved pilot scope | Execute: QA HOLD disposition | Behaviour matches approved SOP for QA HOLD disposition | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-QA-004 | QA | See UAT_PLAN + approved pilot scope | Execute: QA REJECT disposition | Behaviour matches approved SOP for QA REJECT disposition | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-SRC-001 | QA / Auditor | See UAT_PLAN + approved pilot scope | Execute: Search / traceability by batch/product/date | Behaviour matches approved SOP for Search / traceability by batch/product/date | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-RPT-001 | QA / Admin | See UAT_PLAN + approved pilot scope | Execute: Governed report run within org RBAC | Behaviour matches approved SOP for Governed report run within org RBAC | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-EVD-001 | QA / Auditor | See UAT_PLAN + approved pilot scope | Execute: Evidence retrieve / audit trail review | Behaviour matches approved SOP for Evidence retrieve / audit trail review | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-ADM-001 | Admin | See UAT_PLAN + approved pilot scope | Execute: User enable/disable and role assignment (pilot users only) | Behaviour matches approved SOP for User enable/disable and role assignment (pilot users only) | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-AUD-001 | Auditor | See UAT_PLAN + approved pilot scope | Execute: Read-only audit / security event visibility | Behaviour matches approved SOP for Read-only audit / security event visibility | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-DSP-001 | Stores/Dispatch | See UAT_PLAN + approved pilot scope | Execute: Dispatch quality flow IF in approved pilot scope | Behaviour matches approved SOP for Dispatch quality flow IF in approved pilot scope | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |
| UAT-INT-001 | Admin / Integration | See UAT_PLAN + approved pilot scope | Execute: Integration path IF vendor evidence complete; else N/A | Behaviour matches approved SOP for Integration path IF vendor evidence complete; else N/A | NOT EXECUTED — no pilot environment / business evidence | NOT EXECUTED | — | OWNER REQUIRED | — | EVIDENCE REQUIRED |

## Summary (engineering — not business PASS)

| Metric | Value |
| --- | --- |
| Total scenarios | 25 |
| Executed | 0 |
| PASS | 0 |
| FAIL | 0 |
| NOT EXECUTED | 25 |
| Blocked by prerequisites | Yes — see [PREREQUISITES.md](PREREQUISITES.md) |
