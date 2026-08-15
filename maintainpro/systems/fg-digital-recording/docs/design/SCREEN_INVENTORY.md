# Screen Inventory

**Document status:** Proposed classification — not approved  
**Phase:** 01A  
**Last updated:** 2026-08-04

Legend: **MVP** = proposed Phase 1 MVP · **Later** = post-MVP · Responsive priority: Mobile / Tablet / Desktop · Approval status: Proposed (none Approved).

Required data that depends on Nelna forms remains [EVIDENCE REQUIRED].

| Screen ID | Screen | Scope | Responsive priority | Primary persona | Required permissions | Required data | Empty | Loading | Error | Offline | Approval status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-LGN | Login | MVP | Mobile | Any | Public | Employee code + password fields | N/A | Yes | Invalid/generic | Banner if offline | Proposed |
| AUTH-FPC | Forced password change | MVP | Mobile | Any | Authenticated pending change | Policy rules | N/A | Yes | Validation | Block if cannot reach server | Proposed |
| AUTH-RST | Password reset request | MVP | Mobile | Any | Public | Reset identifier | N/A | Yes | Generic | Offline message | Proposed |
| AUTH-LCK | Account locked | MVP | Mobile | Any | Public | Lock message | N/A | — | — | — | Proposed |
| AUTH-DEN | Access denied | MVP | All | Any | Authenticated | — | — | — | Denied | — | Proposed |
| AUTH-EXP | Session expired | MVP | Mobile | Any | Public | — | — | — | — | — | Proposed |
| OP-HOME | Operator home | MVP | Mobile | Operator | operator | Due counts, alerts | Yes | Yes | Yes | Yes | Proposed |
| OP-TASKS | Task list | MVP | Mobile | Operator | operator | Assigned tasks | Yes | Yes | Yes | Yes | Proposed |
| OP-TASK | Task detail | MVP | Mobile | Operator | operator | Task + template meta | — | Yes | Yes | Yes | Proposed |
| OP-CHK | Checklist | MVP | Mobile | Operator | operator | Template items/answers | — | Yes | Yes | Draft-only wording | Proposed |
| OP-FAIL | Failure details | MVP | Mobile | Operator | operator | Reason/measurement/evidence slots | — | Yes | Yes | Yes | Proposed |
| OP-EVD | Evidence capture | MVP | Mobile | Operator | operator | Media + upload state | Yes | Yes | Yes | Local pending | Proposed |
| OP-REV | Review before submit | MVP | Mobile | Operator | operator | Completeness summary | — | Yes | Gaps | Honest sync label | Proposed |
| OP-RES | Submission result | MVP | Mobile | Operator | operator | Server ACK / failure | — | Yes | Retry | Never fake success | Proposed |
| OP-REC | Own record detail | MVP | Mobile | Operator | operator own | Submitted snapshot | — | Yes | Yes | Cached read TBD | Proposed |
| OP-SYNC | Sync status | Later (design now) | Mobile | Operator | operator | Queue states | Yes | Yes | Yes | Core | Proposed |
| OP-MORE | More / profile | MVP | Mobile | Operator | operator | Profile, language, logout | — | Yes | Yes | Yes | Proposed |
| OP-SCAN | Scan | Later / optional | Mobile | Operator | operator | Camera/scan | Yes | Yes | Yes | Yes | Proposed |
| SV-OVR | Supervisor overview | MVP | Mobile/Tablet | Supervisor | supervisor | Counts | Yes | Yes | Yes | Yes | Proposed |
| SV-QUE | Review queue | MVP | Mobile/Tablet | Supervisor | supervisor | Pending reviews | Yes | Yes | Yes | Yes | Proposed |
| SV-REV | Record review | MVP | Tablet | Supervisor | supervisor | Record + evidence | — | Yes | Yes | Degraded | Proposed |
| SV-RET | Return for correction | MVP | Tablet | Supervisor | supervisor | Reason required | — | Yes | Yes | Block if cannot post | Proposed |
| SV-TEAM | Team task view | MVP concept / Later depth | Tablet | Supervisor | supervisor | Team tasks | Yes | Yes | Yes | Yes | Proposed |
| SV-ALT | Alerts | MVP concept | Mobile/Tablet | Supervisor | supervisor | Alerts | Yes | Yes | Yes | Yes | Proposed |
| QA-OVR | QA overview | MVP | Tablet/Desktop | QA | qa | Counts | Yes | Yes | Yes | Yes | Proposed |
| QA-QUE | Verification queue | MVP | Tablet/Desktop | QA | qa | Pending verify | Yes | Yes | Yes | Yes | Proposed |
| QA-VER | Record verification | MVP | Desktop | QA | qa | Full history | — | Yes | Yes | Degraded | Proposed |
| QA-HLD | Hold/reject/reinspection states | MVP concept | Desktop | QA | qa | Reasons | — | Yes | Yes | Block mutate offline | Proposed |
| QA-NC | NC creation concept | Later | Desktop | QA | qa+nc | NC fields | — | Yes | Yes | — | Proposed |
| AD-SHL | Administration shell | MVP | Desktop | Admin | admin | Nav | — | Yes | Yes | — | Proposed |
| AD-USR | User management concept | MVP | Desktop | Admin | admin users | Users | Yes | Yes | Yes | — | Proposed |
| AD-ORG | Organization concept | MVP | Desktop | Admin | admin org | Hierarchy | Yes | Yes | Yes | — | Proposed |
| AD-TPL | Template-management concept | MVP | Desktop | Admin/QA | templates | Templates | Yes | Yes | Yes | — | Proposed |
| AD-ROL | Roles and scope | MVP | Desktop | Admin | admin roles | Roles | Yes | Yes | Yes | — | Proposed |
| MG-KPI | KPI dashboard concept | Later / light MVP optional | Desktop | Management | management | KPIs [DECISION REQUIRED] | Yes | Yes | Yes | Stale badge | Proposed |
| MG-ALT | Critical alerts | MVP concept / Later | Desktop | Management/Site | management | Alerts | Yes | Yes | Yes | Yes | Proposed |
| MG-TRD | Trend drill-down concept | Later | Desktop | Management | management | Series | Yes | Yes | Yes | — | Proposed |
| AU-SRC | Audit search | MVP | Desktop | Auditor | auditor | Filters | Yes | Yes | Yes | — | Proposed |
| AU-PCK | Record pack | MVP | Desktop | Auditor | auditor | Pack sections | — | Yes | Yes | — | Proposed |
| AU-HIS | Audit event history | MVP | Desktop | Auditor | auditor | Events | Yes | Yes | Yes | — | Proposed |
| LD-BLK | Loading blocked state | Later | Mobile/Tablet | Loading role | loading | Block banner | — | Yes | Yes | — | Proposed |

## Notes

- Offline column describes **required design states**; MVP implementation remains online-first per [MVP_SCOPE.md](../requirements/MVP_SCOPE.md).
- Exact field-level required data awaits approved checklist forms [EVIDENCE REQUIRED].
- No screen is Approved until Phase 01A sign-off in [PHASE_01A_DESIGN_APPROVAL.md](../approvals/PHASE_01A_DESIGN_APPROVAL.md).
