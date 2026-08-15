# Phase 20 — UAT / Pilot package

**Package purpose:** Controlled real-business validation before production go-live.

**Hard rule:** Cursor / engineering must **never** invent business PASS results, pilot metrics, or signoff signatures.

## Formal UAT execution (feature freeze @ c08ebec)

| Document | Role |
| --- | --- |
| [UAT_MASTER_EXECUTION.md](UAT_MASTER_EXECUTION.md) | Executable UAT-01…UAT-18 sheets (human Actual/PASS blank) |
| [UAT_DEFECT_REGISTER.md](UAT_DEFECT_REGISTER.md) | Defect log during formal UAT |
| [UAT_SIGNOFF.md](UAT_SIGNOFF.md) | Human sign-off (blank until exit criteria) |
| [evidence/](evidence/) | Per-case screenshots and print evidence |

**Application UAT baseline SHA:** `c08ebec96b8551209bc2228866ceb2fb65031668`  
**Environment until named business testers are assigned:** TECHNICAL UAT DRY RUN (not formal business approval)

## Legacy Phase 20 package (retained)

| Document | Role |
| --- | --- |
| [PREREQUISITES.md](PREREQUISITES.md) | Entry criteria checklist |
| [UAT_PLAN.md](UAT_PLAN.md) | Personas and scenarios |
| [UAT_TEST_RECORD.md](UAT_TEST_RECORD.md) | Executable test record (Actual / PASS-FAIL) |
| [PILOT_SCOPE.md](PILOT_SCOPE.md) | Management-approved scope capture |
| [BASELINE_METRICS.md](BASELINE_METRICS.md) | Paper baseline before pilot |
| [PARALLEL_RUN_RECONCILIATION.md](PARALLEL_RUN_RECONCILIATION.md) | Paper + digital parallel tracking |
| [DEFECT_LOG.md](DEFECT_LOG.md) | Critical defects block go-live |
| [BUSINESS_SIGNOFF.md](BUSINESS_SIGNOFF.md) | Real approval evidence only |
| [PHASE_20_FINAL_REPORT.md](PHASE_20_FINAL_REPORT.md) | Go / no-go summary |
| [../business/PHASE_20_UAT_PILOT.md](../business/PHASE_20_UAT_PILOT.md) | Phase status narrative |
| [../architecture/ADR-034-UAT-PILOT-EVIDENCE-GATE.md](../architecture/ADR-034-UAT-PILOT-EVIDENCE-GATE.md) | Evidence gate — no invented PASS |

## Current outcome

See final report: **STATUS: PHASE 20 UAT/PILOT BLOCKED** until human formal UAT and sign-off complete.
