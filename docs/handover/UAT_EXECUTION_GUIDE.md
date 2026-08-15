# UAT Execution Guide

## Status

`BLOCKED`

This package is executable by humans, but the repository does not contain evidence that UAT has been run or passed.

## Before starting

Review:

- [../uat/README.md](../uat/README.md)
- [../uat/PREREQUISITES.md](../uat/PREREQUISITES.md)
- [../uat/UAT_PLAN.md](../uat/UAT_PLAN.md)
- [../uat/UAT_TEST_RECORD.md](../uat/UAT_TEST_RECORD.md)
- [../uat/PHASE_20_FINAL_REPORT.md](../uat/PHASE_20_FINAL_REPORT.md)

## Current blockers to remove first

- approved published checklist content is not in place
- approved role mappings are not in place
- SoD evidence is not in place
- hosted UAT environment is not confirmed
- DEBT-01C-R-NOTO remains open

## Human execution sequence

1. Confirm prerequisites in `docs/uat/PREREQUISITES.md`.
2. Confirm the environment path and version under test.
3. Confirm the exact checklist versions and role assignments being tested.
4. Execute scenarios from `docs/uat/UAT_PLAN.md`.
5. Record actual results only in `docs/uat/UAT_TEST_RECORD.md`.
6. Log defects in `docs/uat/DEFECT_LOG.md`.
7. Record pilot scope and parallel-run evidence if used.
8. Complete signoff only with real business participants and real evidence.

## Blank execution tracker

| Field | Value |
| --- | --- |
| UAT environment | |
| Build / SHA under test | |
| Checklist version(s) under test | |
| Recorder mapping approved? | |
| Supervisor mapping approved? | |
| QA mapping approved? | |
| SoD evidence attached? | |
| Sinhala evidence attached? | |
| Scenarios executed | |
| Critical defects open | |
| Business signoff attached | |
| Final UAT result | |

## Reporting rule

Leave results blank until real execution occurs. Do not pre-fill PASS, defect counts, or signoff names.
