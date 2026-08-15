# Phase 20 — UAT plan

## Objective

Validate that approved pilot users can complete controlled FG digital recording workflows safely, with auditability, without inventing master data or bypassing paper policy.

## Personas

| Persona | Primary flows |
| --- | --- |
| Recorder | Login, task, record, Save Draft, submit, correction, resubmit, evidence |
| Supervisor | Queue, approve, return for correction, approve resubmission |
| QA | Queue, RELEASE / HOLD / REJECT, search, reports (as permitted) |
| Admin | Pilot user/role admin within policy; no silent production config |
| Auditor | Read-only search, evidence, audit events |
| Stores / Dispatch | Only if Management includes dispatch in pilot scope (Phase 13) |

## Core scenario catalogue

Detailed executable rows live in [UAT_TEST_RECORD.md](UAT_TEST_RECORD.md).

| Area | Test IDs | Notes |
| --- | --- | --- |
| Auth / session | UAT-AUTH-001–003 | |
| Recording | UAT-REC-001–005 | Requires approved checklist + tasks |
| Supervisor | UAT-SUP-001–004 | |
| Correction | UAT-COR-001–002 | |
| QA dispositions | UAT-QA-001–004 | RELEASE/HOLD/REJECT meaning still business-owned |
| Search / reports / evidence | UAT-SRC-001, UAT-RPT-001, UAT-EVD-001 | |
| Admin / Auditor | UAT-ADM-001, UAT-AUD-001 | |
| Dispatch | UAT-DSP-001 | Conditional |
| Integration | UAT-INT-001 | Conditional — Bileeta still vendor-evidence gated |

## Execution rules

1. Use **only** management-approved pilot scope ([PILOT_SCOPE.md](PILOT_SCOPE.md)).
2. Record Actual results at execution time — never pre-fill PASS.
3. Critical defects → [DEFECT_LOG.md](DEFECT_LOG.md); block go-live.
4. If QA requires paper + digital parallel: use [PARALLEL_RUN_RECONCILIATION.md](PARALLEL_RUN_RECONCILIATION.md).
5. Sinhala operator UAT remains blocked while DEBT-01C-R-NOTO is open (unless Management explicitly scopes English-only pilot — must be written).
