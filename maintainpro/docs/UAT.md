# UAT Scenarios (Enterprise)

Executable checklist — mark pass/fail with evidence (user, tenant, WO id).

| # | Scenario | Steps (summary) | Expected |
|---|----------|-----------------|----------|
| 1 | Request create | Create breakdown request with asset + evidence | Request persisted, SLA fields set |
| 2 | Approval | Submit WO requiring approval; approve as different user | SoD blocks self-approve |
| 3 | Planning | Assign planned start/technician | Status PLANNED allowed |
| 4 | Assignment | Assign crew | Readiness assignment blocker clears |
| 5 | Technician exec | Acknowledge → start → pause → resume → complete | Invalid transitions rejected |
| 6 | Safety | Require permit/LOTO; attempt start | Start blocked with reasons |
| 7 | Parts | Reserve part concurrently | One wins; other conflict |
| 8 | PM | Run generator twice | Duplicate generationKey prevented |
| 9 | CBM | Post critical reading | Event + dedupe |
| 10 | Breakdown downtime | Multiple segments | Active repair ≠ total elapsed |
| 11 | Reliability | Open RCA + CAPA | Linked to WO/asset |
| 12 | Vendor repair | External repair → quotation → assign | Vendor portal sees only assigned |
| 13 | Gate block | Critical defect | BLOCK outcome |
| 14 | Gate override | Override with approver ≠ requester | Audited; SoD enforced |
| 15 | Fleet service | Service WO on vehicle | Shared WO engine |
| 16 | Meter correction | Request + self-approve | Rejected SOD_VIOLATION |
| 17 | Offline sync | Queue action offline; reconnect | Idempotent; conflict UI if newer server |
| 18 | ERP failure | Force ERP timeout | Exception center entry; WO still usable |
| 19 | Branch access | User without site scope | Denied cross-site |
| 20 | Rework / close | Verify reject → rework → close | History retained |

See also `docs/UAT_CHECKLIST.md` and `docs/UAT_RUNBOOK.md`.
