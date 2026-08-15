# Final technical handover — Nelna FG Digital Recording System

**Classification:** TECHNICAL HANDOVER COMPLETE — BUSINESS/UAT/PRODUCTION GATES REMAIN  
**Canonical status:** `docs/PROJECT_STATUS.md`  
**Do not treat this document as UAT PASS or PRODUCTION READY.**

## What this handover is

This package describes the technically implementable factory-floor recording system as it exists on `main`. Business values, official SOP, and go-live remain owner-owned.

## Current integration state

| Item | Value |
| --- | --- |
| Canonical repo | `C:\Projects\nelna-fg-digital-recording-system` |
| GitHub | `jkchinthaka/nelna-fg-digital-recording-system` |
| `origin/main` | `4b5914e7b17fb7d752dd6f1f6d1dbd52de0380b6` |
| Feature branch tip (last synced) | may lag; prefer `main` |
| Local HEAD | equals `origin/main` at handover time |

## Technically delivered on main

- Structured RCA (Phase 49) — human confirm only; AI cannot close RCA/NCR/CAPA
- SOURCE RECEIVED company forms NMS/PPU/CL/24, /39, /30, /18 via the checklist engine
- Daily Records workspace with stored-only queue counts
- Print current record with actual saved answers; monthly packs from stored submissions
- Screen UX separate from A4 print preview (`Print A4` / `Print A4 pack`; no auto-print)
- Record history, pagination, CSV export with formula-injection protection
- Supervisor Approve / Return and QA RELEASE / HOLD / REJECT (services + UI; live demo exercised)
- Operator workspaces: NCR, CAPA (including effectiveness), Laboratory, HACCP, Dispatch, Complaints, Quarantine
- Quality trend counts from stored records only
- Online-only recording (no unsafe offline writes)
- Quality gates on main: ruff, format, mypy, Django check, bandit, pip-audit, npm build, pytest **893 passed / coverage 83.45%**
- Pre-UAT defect fixes: RCA `select_for_update` + duplicate-code IntegrityError handling; CL/18 PASS/FAIL labels; malformed date/month validation; admin workflow field lock-down; CSV export 2000-row limit labeled

## Explicitly not claimed

- Formal UAT PASS
- Production readiness
- Business approval of the four source forms
- Official org/site/shift/product catalogues
- Live Bileeta / ERP
- MongoDB cutover
- True offline queue
- Full OEE / invented COPQ
- Invented temperature classes, CCPs, or cost rates
- Speculative Phase 130 integrations

## Read next

1. `OPERATOR_GUIDE.md`
2. `QA_SUPERVISOR_GUIDE.md`
3. `PRINTING_GUIDE.md`
4. `UAT_PLAN.md`
5. `KNOWN_BLOCKERS.md`
6. `docs/PROJECT_STATUS.md`
7. `FINAL_HANDOVER_REPORT.md`
