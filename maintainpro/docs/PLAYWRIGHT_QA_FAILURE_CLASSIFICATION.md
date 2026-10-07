# Playwright QA — failure classification

Updated 2026-10-07 after suite stabilization. Full report: `docs/PLAYWRIGHT_QA_STABILIZATION_REPORT.md`.

Legend: **A** app defect · **B** test defect · **C** data/state leakage · **D** env/throttle/infra · **E** timing/selector flake

## Original critical-path 6 (pre-stabilization)

| # | Test | Class | Root cause | Status |
| --- | --- | --- | --- | --- |
| 1 | logout / unauth redirect to `/login` | **A** | Client shell reachable without session | **Still failing** (QA-E2E-AUTH-REDIRECT) |
| 2 | cross-module critical path empty `woId` | **B** | Convert envelope parse | **Fixed** |
| 3 | technician complete 400 | **B** | Missing QR verify | **Fixed** |
| 4 | technician start 409 | **C** | Leftover labour sessions | **Fixed** (cleanup) |
| 5 | HTML description XSS | **A** | Raw script persisted | **Still failing** (QA-E2E-XSS-REQUEST) |
| 6 | request-to-wo empty `woId` | **B** | Same as #2 | **Fixed** |

## Additional failures found during stabilization

| Test / symptom | Class | Notes |
| --- | --- | --- |
| Full-suite mid-run 401 cascade | **B/D** | Refresh rotation + logout poisoned shared storageState — **fixed** (persist + isolate logout + max reuse age) |
| Planning reschedule 400 | **B** | Start-only patch violated date order — **fixed** |
| PM valid create 500 | **B** | Triggers used `type` instead of `kind` — **fixed** |
| Fleet negative odometer → 201 | **A** | QA-E2E-FLEET-ODO — **keep failing** |
| Asset-status start 409 | **B/C** | Admin start + labour leak — **fixed** (tech start + clear sessions) |
| Login 429 on rapid setup | **D** | Orchestration cooldown/reuse — **mitigated** (do not weaken API throttle) |

## Policy

- Do **not** weaken assertions for **A** defects.
- Fix **B**/**C**/**D** in suite/helpers only unless product fix is explicitly in scope.
