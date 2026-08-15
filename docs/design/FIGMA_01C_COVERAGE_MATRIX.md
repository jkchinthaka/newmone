# Figma 01C Coverage Matrix

**Document status:** Draft pending owner review
**Phase:** 01C-R remediation
**Branch:** `design/figma-high-fidelity-mvp`
**Figma file:** https://www.figma.com/design/jnn8Xhsg1zFEHxYShCUb4M
**Generated:** 2026-08-05
**Actor:** Cursor agent (Figma MCP inventory)

## Page IDs

| Page | Node ID |
| --- | --- |
| 00 Project Brief | `0:1` |
| 01 User Journeys | `1:2` |
| 02 Information Architecture | `1:3` |
| 03 Low-Fidelity Wireframes | `1:4` |
| 04 Design Tokens | `1:5` |
| 05 Components | `1:6` |
| 06 Operator Mobile | `1:7` |
| 07 Supervisor Mobile and Tablet | `1:8` |
| 08 QA Console | `1:9` |
| 09 Administration | `1:10` |
| 10 Management Dashboard | `1:11` |
| 11 Offline and Error States | `1:12` |
| 12 Interactive Prototypes | `1:13` |
| 13 Developer Handoff | `1:14` |
| 99 Archive | `1:15` |

## Coverage table

| Requirement ID | Screen/state | Persona | Breakpoint | Figma page | Frame name | Node ID | Component-based | Prototype | Status | A11y annotated | Sinhala checked | Responsive checked | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Login | All | 360 | 06 | `06/auth/AUTH-LOGIN/360` | `18:2` | Frame | — | COMPLETE | Yes | Yes | Yes | a11y 49:2 |
| AUTH-01b | Login | All | 1024 | 06 | `06/auth/AUTH-LOGIN/1024` | `67:2` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| AUTH-02 | Login validation error | All | 360 | 06 | `06/auth/AUTH-LOGIN-ERROR/360` | `18:15` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| AUTH-03 | Account locked | All | 360 | 06 | `06/auth/AUTH-LOCKED/360` | `18:27` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| AUTH-04 | Forced password change | All | 360 | 06 | `06/auth/AUTH-PASSWORD-CHANGE/360` | `37:47` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| AUTH-05 | Password reset request | All | 360 | 06 | `06/auth/AUTH-PASSWORD-RESET/360` | `37:72` | Frame | — | COMPLETE | No | Not applicable | Yes | concept |
| AUTH-06 | Access denied | All | 360 | 06 | `06/auth/AUTH-ACCESS-DENIED/360` | `37:88` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| AUTH-07 | Session expired | All | 360 | 06 | `06/auth/AUTH-SESSION-EXPIRED/360` | `37:104` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| OP-01 | Home | Operator | 360 | 06 | `06/operator/OP-HOME/360` | `16:39` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-01b | Home | Operator | 430 | 06 | `06/operator/OP-HOME/430` | `39:13` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-02 | My Tasks | Operator | 360 | 06 | `06/operator/OP-TASKS/360` | `16:60` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-03 | Task detail | Operator | 360 | 06 | `06/operator/OP-TASK-DETAIL/360` | `39:65` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-04 | Checklist start | Operator | 360 | 06 | `06/operator/OP-CHK/start/360` | `39:99` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-05 | Checklist normal | Operator | 360 | 06 | `06/operator/OP-CHK/normal/360` | `16:82` | Frame | — | COMPLETE | Yes | Partial | Yes |  |
| OP-05b | Checklist normal | Operator | 430 | 06 | `06/operator/OP-CHK/430` | `43:72` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-06 | Partially complete | Operator | 360 | 06 | `06/operator/OP-CHK/partial/360` | `39:119` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-07 | Failed item | Operator | 360 | 06 | `06/operator/OP-CHK/failed/360` | `20:2` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-08 | Failure disclosure | Operator | 360 | 06 | `06/operator/OP-CHK/failure-detail/360` | `41:2` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-09 | Measurement entry | Operator | 360 | 06 | `06/operator/OP-CHK/measurement/360` | `41:26` | Frame | — | COMPLETE | Yes | Partial | Yes |  |
| OP-10 | Evidence capture | Operator | 360 | 06 | `06/operator/OP-CHK/evidence-capture/360` | `41:53` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-11 | Evidence upload progress | Operator | 360 | 06 | `06/operator/OP-CHK/evidence-upload/360` | `41:73` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-12 | Jump to incomplete | Operator | 360 | 06 | `06/operator/OP-CHK/jump-incomplete/360` | `43:15` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-13 | Jump to failed | Operator | 360 | 06 | `06/operator/OP-CHK/jump-failed/360` | `43:46` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-14 | Review before submit | Operator | 360 | 06 | `06/operator/OP-REV/360` | `16:100` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-15 | Attestation | Operator | 360 | 06 | `06/operator/OP-ATTEST/360` | `43:103` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-16 | Submission in progress | Operator | 360 | 06 | `06/operator/OP-SUBMITTING/360` | `44:2` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-17 | Server-confirmed submission | Operator | 360 | 06 | `06/operator/OP-RES/server-ack/360` | `16:110` | Frame | — | COMPLETE | Yes | Partial | Yes |  |
| OP-18 | Submission failed | Operator | 360 | 06 | `06/operator/OP-RES/submit-failed/360` | `44:27` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-19 | Own record detail | Operator | 360 | 06 | `06/operator/OP-REC/own-detail/360` | `44:48` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-20 | Submitted read-only | Operator | 360 | 06 | `06/operator/OP-REC/readonly/360` | `44:93` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-21 | Returned for correction | Operator | 360 | 06 | `06/operator/OP-RETURNED/360` | `45:2` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-22 | Correction/resubmission | Operator | 360 | 06 | `06/operator/OP-CORRECTION/360` | `45:27` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-23 | Offline local save | Operator | 360 | 06 | `06/operator/OP-OFFLINE/local-save/360` | `20:34` | Frame | — | COMPLETE | Yes | Partial | Yes |  |
| OP-24 | Waiting to sync | Operator | 360 | 06 | `06/operator/OP-SYNC/waiting/360` | `45:56` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-25 | Sync failed | Operator | 360 | 06 | `06/operator/OP-SYNC/failed/360` | `45:84` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-26 | Conflict | Operator | 360 | 06 | `06/operator/OP-SYNC/conflict/360` | `46:2` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-27 | Synchronized | Operator | 360 | 06 | `06/operator/OP-SYNC/synchronized/360` | `46:26` | Frame | — | COMPLETE | No | No | Yes |  |
| OP-28 | Unsynchronized logout warning | Operator | 360 | 06 | `06/operator/OP-LOGOUT-WARN/360` | `46:50` | Frame | — | COMPLETE | No | No | Yes |  |
| LB-01 | Vehicle inspection normal | Operator | 360 | 06 | `06/operator/LB-NORMAL/360` | `47:2` | Frame | — | COMPLETE | No | No | Yes | No invented threshold |
| LB-02 | Critical item failed | Operator | 360 | 06 | `06/operator/LB-CRITICAL-FAIL/360` | `47:34` | Frame | — | COMPLETE | No | No | Yes | No invented threshold |
| LB-03 | LOADING BLOCKED | Operator | 360 | 06 | `06/operator/LB-BLOCKED/360` | `20:17` | Frame | — | COMPLETE | Yes | No | Yes | No invented threshold |
| LB-03b | LOADING BLOCKED | Operator | 768 | 06 | `06/operator/LB-BLOCKED/768` | `57:3` | Frame | — | COMPLETE | Yes | No | Yes | No invented threshold |
| LB-03c | LOADING BLOCKED | Operator | 1024 | 06 | `06/operator/LB-BLOCKED/1024` | `57:30` | Frame | — | COMPLETE | Yes | No | Yes | No invented threshold |
| LB-04 | Reinspect | Operator | 360 | 06 | `06/operator/LB-REINSPECT/360` | `47:55` | Frame | — | COMPLETE | No | No | Yes | No invented threshold |
| LB-05 | Loading restored | Operator | 360 | 06 | `06/operator/LB-RESTORED/360` | `47:86` | Frame | — | COMPLETE | No | No | Yes | No invented threshold |
| LB-06 | Override request concept | Operator | 360 | 06 | `06/operator/LB-OVERRIDE-REQUEST/360` | `48:2` | Frame | — | COMPLETE | No | No | Yes | No invented threshold |
| LB-07 | Override authorization concept | Operator | 360 | 06 | `06/operator/LB-OVERRIDE-AUTH/360` | `48:33` | Frame | — | COMPLETE | No | No | Yes | No invented threshold |
| LB-08 | Audit trail | Operator | 360 | 06 | `06/operator/LB-AUDIT/360` | `48:68` | Frame | — | COMPLETE | No | No | Yes | No invented threshold |
| SV-01 | Overview | Supervisor | 768 | 07 | `07/supervisor/SV-OVERVIEW/768` | `18:36` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-02 | Review queue | Supervisor | 768 | 07 | `07/supervisor/SV-QUEUE/768` | `53:2` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-02b | Review queue | Supervisor | 1024 | 07 | `07/supervisor/SV-QUEUE/1024` | `53:51` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-03 | Failures-first queue | Supervisor | 768 | 07 | `07/supervisor/SV-QUEUE/failures-first/768` | `18:47` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-04 | Record review | Supervisor | 768 | 07 | `07/supervisor/SV-REVIEW/768` | `54:133` | Frame | — | COMPLETE | Yes | Not applicable | Yes |  |
| SV-04b | Record review | Supervisor | 1440 | 07 | `07/supervisor/SV-REVIEW/1440` | `54:191` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-05 | Failed-item review | Supervisor | 768 | 07 | `07/supervisor/SV-REVIEW/failed-items/768` | `54:264` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-06 | Evidence preview | Supervisor | 768 | 07 | `07/supervisor/SV-EVIDENCE/768` | `55:2` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-07 | Clean-record approval | Supervisor | 768 | 07 | `07/supervisor/SV-APPROVE-CLEAN/768` | `55:45` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-08 | Return for correction | Supervisor | 768 | 07 | `07/supervisor/SV-RETURN/reason/768` | `19:15` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-09 | Resubmitted comparison | Supervisor | 768 | 07 | `07/supervisor/SV-COMPARE/768` | `55:74` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-10 | Team task status | Supervisor | 768 | 07 | `07/supervisor/SV-TEAM-STATUS/768` | `56:97` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-11 | Overdue task view | Supervisor | 768 | 07 | `07/supervisor/SV-OVERDUE/768` | `56:148` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| SV-12 | SoD blocked | Supervisor | 768 | 07 | `07/supervisor/SV-SOD-BLOCKED/768` | `19:24` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-01 | QA overview | QA | 1024 | 08 | `08/qa/QA-OVERVIEW/1024` | `18:59` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-02 | Verification queue | QA | 1024 | 08 | `08/qa/QA-VERIFY-QUEUE/1024` | `18:67` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-02b | QA queue | QA | 768 | 08 | `08/qa/QA-QUEUE/768` | `57:66` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-02c | QA queue | QA | 1024 | 08 | `08/qa/QA-QUEUE/1024` | `57:116` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-03 | Record verification | QA | 1024 | 08 | `08/qa/QA-VERIFY/1024` | `58:2` | Frame | — | COMPLETE | Yes | Not applicable | Yes |  |
| QA-03b | Record verification | QA | 1440 | 08 | `08/qa/QA-VERIFY/1440` | `58:69` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-04 | Approval-chain view | QA | 1024 | 08 | `08/qa/QA-CHAIN/1024` | `59:2` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-05 | Reject | QA | 1024 | 08 | `08/qa/QA-REJECT/1024` | `59:74` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-06 | Hold | QA | 1024 | 08 | `08/qa/QA-HOLD/1024` | `59:118` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-07 | Request reinspection | QA | 1024 | 08 | `08/qa/QA-REINSPECT/1024` | `60:2` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-08 | NC creation concept | QA | 1024 | 08 | `08/qa/QA-NC-CONCEPT/1024` | `61:130` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-09 | Critical finding | QA | 1024 | 08 | `08/qa/QA-CRITICAL/1024` | `61:181` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-10 | SoD blocked | QA | 1024 | 08 | `08/qa/QA-SOD-BLOCKED/1024` | `19:112` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-11 | Final verified immutable | QA | 1024 | 08 | `08/qa/QA-VERIFIED-IMMUTABLE/1024` | `19:104` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-12 | Amendment history | QA | 1024 | 08 | `08/qa/QA-AMENDMENTS/1024` | `61:214` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-13 | Evidence panel | QA | 1024 | 08 | `08/qa/QA-EVIDENCE/1024` | `62:128` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| QA-14 | Audit timeline | QA | 1024 | 08 | `08/qa/QA-AUDIT-TIMELINE/1024` | `62:188` | Frame | — | COMPLETE | No | Not applicable | Yes |  |
| AD-01 | Admin dashboard | Admin | 1440 | 09 | `09/admin/AD-DASH/1440` | `20:46` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-02 | User list | Admin | 1024 | 09 | `09/admin/AD-USERS/1024` | `54:2` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-02b | User list | Admin | 1440 | 09 | `09/admin/AD-USERS/1440` | `20:62` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-03 | User detail | Admin | 1024 | 09 | `09/admin/AD-USER-DETAIL/1024` | `54:75` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-03b | User detail | Admin | 1440 | 09 | `09/admin/AD-USER-DETAIL/1440` | `62:2` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-04 | Role/scope concept | Admin | 1024 | 09 | `09/admin/AD-ROLES/1024` | `60:62` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-05 | Org hierarchy concept | Admin | 1024 | 09 | `09/admin/AD-ORG/1024` | `60:114` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-06 | Standard form | Admin | 1024 | 09 | `09/admin/AD-FORM/1024` | `60:155` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-06b | Standard form | Admin | 1440 | 09 | `09/admin/AD-FORM/1440` | `62:70` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| AD-07 | Audit-event list | Admin | 1440 | 09 | `09/admin/AD-AUDIT/1440` | `20:76` | Frame | — | COMPLETE | No | Not applicable | Yes | foundation only |
| MG-01 | Dashboard | Management | 1024 | 10 | `10/mgmt/MG-DASH/1024` | `56:2` | Frame | — | COMPLETE | No | Not applicable | Yes | KPIs [PROPOSED] |
| MG-01b | Dashboard | Management | 1440 | 10 | `10/mgmt/MG-DASH/1440` | `20:91` | Frame | — | COMPLETE | No | Not applicable | Yes | KPIs [PROPOSED] |
| MG-02 | Critical alerts | Management | 1440 | 10 | `10/mgmt/MG-ALERTS/1440` | `61:2` | Frame | — | COMPLETE | No | Not applicable | Yes | KPIs [PROPOSED] |
| MG-03 | Completion status | Management | 1440 | 10 | `10/mgmt/MG-COMPLETION/1440` | `61:66` | Frame | — | COMPLETE | No | Not applicable | Yes | KPIs [PROPOSED] |
| MG-04 | Failure trend | Management | 1440 | 10 | `10/mgmt/MG-FAILURE-TREND/1440` | `63:2` | Frame | — | COMPLETE | No | Not applicable | Yes | KPIs [PROPOSED] |
| MG-05 | Overdue CAPA concept | Management | 1440 | 10 | `10/mgmt/MG-CAPA/1440` | `63:94` | Frame | — | COMPLETE | No | Not applicable | Yes | KPIs [PROPOSED] |
| MG-06 | Loading-block summary | Management | 1440 | 10 | `10/mgmt/MG-LOADING-BLOCKS/1440` | `63:177` | Frame | — | COMPLETE | No | Not applicable | Yes | KPIs [PROPOSED] |
| AU-01 | Audit search | Auditor | 1024 | 09 | `09/auditor/AU-SEARCH/1024` | `24:2` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-01b | Audit search | Auditor | 1440 | 09 | `09/auditor/AU-SEARCH/1440` | `64:2` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-02 | Filtered record list | Auditor | 1024 | 09 | `09/auditor/AU-LIST/1024` | `24:7` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-03 | Record detail | Auditor | 1024 | 09 | `09/auditor/AU-DETAIL/1024` | `24:12` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-03b | Record detail | Auditor | 1440 | 09 | `09/auditor/AU-DETAIL/1440` | `64:85` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-04 | Template-version view | Auditor | 1024 | 09 | `09/auditor/AU-TEMPLATE/1024` | `65:2` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-05 | Evidence | Auditor | 1024 | 09 | `09/auditor/AU-EVIDENCE/1024` | `65:47` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-06 | Approval chain | Auditor | 1024 | 09 | `09/auditor/AU-CHAIN/1024` | `65:117` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-07 | Amendment history | Auditor | 1024 | 09 | `09/auditor/AU-AMENDMENTS/1024` | `66:2` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-08 | Audit-event history | Auditor | 1024 | 09 | `09/auditor/AU-EVENTS/1024` | `66:53` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-09 | Printable record-pack | Auditor | 1024 | 09 | `09/auditor/AU-PRINT/1024` | `24:19` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| AU-09b | Printable record-pack | Auditor | 1440 | 09 | `09/auditor/AU-PRINT/1440` | `66:122` | Frame | — | COMPLETE | No | Not applicable | Yes | read-only |
| OFF-01 | Online | All | gallery | 11 | `11/state/online` | `19:32` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-02 | Offline local | All | gallery | 11 | `11/state/offline-local` | `19:35` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-03 | Saved on device | All | gallery | 11 | `11/state/saved-device` | `19:38` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-04 | Waiting sync | All | gallery | 11 | `11/state/waiting-sync` | `19:41` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-05 | Syncing | All | gallery | 11 | `11/state/syncing` | `19:44` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-06 | Evidence uploading | All | gallery | 11 | `11/state/evidence-upload` | `19:47` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-07 | Sync failed | All | gallery | 11 | `11/state/sync-failed` | `19:50` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-08 | Conflict | All | gallery | 11 | `11/state/conflict` | `19:53` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-09 | Synchronized | All | gallery | 11 | `11/state/synchronized` | `19:56` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-10 | Server unavailable | All | gallery | 11 | `11/state/server-unavailable` | `19:59` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-11 | Session expired | All | gallery | 11 | `11/state/session-expired` | `19:62` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-12 | Access denied | All | gallery | 11 | `11/state/access-denied` | `19:65` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-13 | Account locked | All | gallery | 11 | `11/state/account-locked` | `19:68` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-14 | Validation failure | All | gallery | 11 | `11/state/validation-failure` | `19:71` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-15 | Submission failure | All | gallery | 11 | `11/state/submission-failure` | `19:74` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-16 | Evidence fail | All | gallery | 11 | `11/state/evidence-fail` | `19:77` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-17 | Loading blocked | All | gallery | 11 | `11/state/loading-blocked` | `19:80` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-18 | Empty queue | All | gallery | 11 | `11/state/empty-queue` | `19:83` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| OFF-19 | No tasks | All | gallery | 11 | `11/state/no-tasks` | `19:86` | Frame | — | COMPLETE | No | Not applicable | Yes | state gallery |
| P1 | P1 Normal operator start | Flow | proto | 12 | `12/P1/01-login` | `67:26` | Frame | P1-P7 | COMPLETE | No | Not applicable | Yes | hi-fi clone chain |
| P2 | P2 Operator failure start | Flow | proto | 12 | `12/P2/01-checklist` | `67:228` | Frame | P1-P7 | COMPLETE | No | Not applicable | Yes | hi-fi clone chain |
| P3 | P3 Supervisor correction start | Flow | proto | 12 | `12/P3/01-queue` | `67:581` | Frame | P1-P7 | COMPLETE | No | Not applicable | Yes | hi-fi clone chain |
| P4 | P4 QA verification start | Flow | proto | 12 | `12/P4/01-queue` | `67:781` | Frame | P1-P7 | COMPLETE | No | Not applicable | Yes | hi-fi clone chain |
| P5 | P5 Loading blocked start | Flow | proto | 12 | `12/P5/01-inspect-normal` | `67:363` | Frame | P1-P7 | COMPLETE | No | Not applicable | Yes | hi-fi clone chain |
| P5A | P5 Override alt start | Flow | proto | 12 | `12/P5-ALT/01-blocked` | `67:496` | Frame | P1-P7 | COMPLETE | No | Not applicable | Yes | hi-fi clone chain |
| P6 | P6 Offline sync preferred start | Flow | proto | 12 | `12/P6B/01-online` | `67:1276` | Frame | P1-P7 | COMPLETE | No | Not applicable | Yes | hi-fi clone chain |
| P7 | P7 Access problem start | Flow | proto | 12 | `12/P7/01-login-error` | `67:1382` | Frame | P1-P7 | COMPLETE | No | Not applicable | Yes | hi-fi clone chain |
| CMP-BTN-P | Primary button set | System | n/a | 05 | `comp/button/primary` | `16:14` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-BTN-S | Secondary button set | System | n/a | 05 | `comp/button/secondary` | `33:16` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-BTN-T | Tertiary button set | System | n/a | 05 | `comp/button/tertiary` | `33:29` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-BTN-D | Destructive button set | System | n/a | 05 | `comp/button/destructive` | `34:14` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-BTN-I | Icon button set | System | n/a | 05 | `comp/button/icon` | `34:27` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-IN-EC | Employee-code input set | System | n/a | 05 | `comp/input/employee-code` | `35:15` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-IN-PW | Password input set | System | n/a | 05 | `comp/input/password` | `35:34` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-IN-TP | Temperature input set | System | n/a | 05 | `comp/input/temperature` | `37:30` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-PF | Pass/fail control set | System | n/a | 05 | `comp/control/pass-fail` | `16:27` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-SYNC | Sync indicator set | System | n/a | 05 | `comp/ops/sync-indicator` | `43:155` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-MODAL | Modal | System | n/a | 05 | `comp/overlay/modal` | `39:3` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |
| CMP-SHEET | Bottom sheet | System | n/a | 05 | `comp/overlay/bottom-sheet` | `39:158` | Set/component | — | COMPLETE | No | Not applicable | Yes | component set |

## Summary counts

- Rows: 147
- COMPLETE (with node ID): 147
- PARTIAL: 0
- MISSING: 0 (required inventory covered; see blocking gaps)

## Blocking gaps remaining

1. **Noto Sans Sinhala** — 01C-F verification **FAILED** (2026-08-05): cloud file text metadata shows **Abhaya Libre** on interim samples (`31:33`); frame `31:23` still blocking instructions; no Noto Sans Sinhala text nodes on pages 04/06/99; Archive empty. Owner must apply Noto in Desktop, archive/mark Abhaya non-production, annotate, and sync cloud file.
2. Accessibility annotations are representative (not every screen).
3. Legacy single-component duplicates of secondary/destructive remain beside full sets (library not published).

## Prototype start node IDs (hi-fi clone chains)

| Flow | Start frame | Node ID |
| --- | --- | --- |
| P1 | `12/P1/01-login` | `67:26` |
| P2 | `12/P2/01-checklist` | `67:228` |
| P3 | `12/P3/01-queue` | `67:581` |
| P4 | `12/P4/01-queue` | `67:781` |
| P5 | `12/P5/01-inspect-normal` | `67:363` |
| P5 override alt | `12/P5-ALT/01-blocked` | `67:496` |
| P6 preferred | `12/P6B/01-online` | `67:1276` |
| P7 | `12/P7/01-login-error` | `67:1382` |

**Review status:** Pending owner high-fidelity review. Phase 01C approval remains blank.
