# Performance Baseline

**Phase 1 captured:** 2026-09-19T12:55:43Z (PR #43)
**Phase 2 re-measured:** 2026-09-19T15:10:47Z against Docker compose

| Metric | Target | Phase 1 (ms) | Phase 2 (ms) | Status | Notes |
|--------|--------|--------------|--------------|--------|-------|
| GET `/health` | <300 | 52 | 57 | PASS | |
| POST login (BFF) | <1000–3000 | 945 | 806 | PASS | |
| GET `/work-orders/queues` | <1000 | **1611** | **154** warm | PASS warm | Cold after restart still ~1.2–1.5s (pool warmup) |
| GET `/work-orders?page=1&pageSize=25` | <500 | 225 | 291 | PASS | |
| GET `/notifications` | <500 | 29 | 23 | PASS | |
| GET `/reporting-kpis/overview` | <500 | 37 | 41 | PASS | |
| NAV `/action-center` | <2000–3000 | 433 | 631 | PASS | |
| NAV `/work-orders` | <2000 | 490 | 2009 | PARTIAL | Next.dev cold compile variance |
| NAV `/reports` | <2000 | 571 | 1342 | PASS | |
| NAV `/inventory` | <2000 | **2704** | **2963** | OVER (dev document) | See optimization results — defer + staleTime applied |
| NAV `/action-center` (warm) | <2000 | 428 | 420 | PASS | |

Script: `scripts/verify-final-acceptance-perf.mjs`
