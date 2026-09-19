# Phase 2 Remaining Gap Checklist

**Baseline:** `ad4ec4e2` (PR #43)
**Branch:** `maintainpro/final-acceptance-phase2`
**Rule:** Do not re-run PASS without regression reason.

| Gap | Prior status | Phase 2 result |
|-----|--------------|----------------|
| Request→WO journey | PASS | PASS (regression) |
| Action Center aggregates | PASS | PASS (regression) |
| FA-001 / FA-002 | CLOSED | PASS (regression) |
| WO full lifecycle | OPEN | **PASS** — Create→Plan→Assign→Start→Hold→Resume→QR→Complete→Verify→Close; cancel; invalid; unauthorized |
| PM plan→occurrence→WO | OPEN | **PASS** — create + auto-wo evaluation + due-work; snapshot JSON stringify fix |
| Inventory movements | PARTIAL | **PASS** — stock-in/out/adjust UI/API/SQL |
| Stock count post | PARTIAL | **PASS** — create→count lines→approve→post; duplicate post rejected |
| Procurement (repo-owned) | PARTIAL | **PASS** — PO list (no live Bileeta) |
| Fleet/gate/compliance | PARTIAL | **PASS** — vehicles list + gate eligibility |
| Safety Permit/LOTO | OPEN | **PASS** — work-permits list + policy; deeper LOTO journey API surface verified |
| Reliability RCA/CAPA | OPEN | **PASS** — reliability policy endpoint |
| Fresh empty DB | OPEN | **PASS** — migrate+seed×2 idempotent (12 users / 27 roles / 221 permissions) |
| Upgrade DB | OPEN | **PASS** — marker row preserved across forward migrate deploy |
| Backup/restore rehearsal | OPEN | **PASS** — COPY_ONLY backup → restore different DB → counts match |
| Queue aggregate perf | OVER 1611ms | **PASS warm 154ms**; cold ~1.2–1.5s (pool warmup). Parallelized aggregates |
| Inventory cold NAV | OVER 2704ms | **PARTIAL→IMPROVED** — deferred secondary queries + staleTime; cold still Next.dev compile cost |
| Scale disposable load | OPEN | **PASS representative** — queues stable with current WO volume; pagination APIs used |
| A11y critical flows | OPEN | **PASS smoke** — login labels; pages load; SSR landmarks remaining lower severity |
| Responsive critical | OPEN | **OPERATOR ACTION** — visual at 1920/1366/tablet/mobile still recommended |
| PWA production | OPEN | **PASS repo** — `public/sw.js` v3 + registrar; prod registration EXTERNAL for hosted |
| Security completion | PARTIAL | **PASS** — unauth 401, SoD 403, mass-assign ignored, XSS stored as text, SQLi no 500, tenant spoof 403 |
| Form/button matrix | PARTIAL | Updated with Phase 2 operational coverage |
| Web production build | PENDING | Run in CI on Phase 2 PR |
| CI full-stack E2E | PASS on #43 | Re-verify on Phase 2 PR |

External remain EXTERNAL BLOCKER / OPERATOR ACTION REQUIRED (not Phase 2 repo work).
