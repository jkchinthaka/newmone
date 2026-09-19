# Performance Baseline

**Captured:** 2026-09-19T12:55:43Z against Docker compose (warm host → containers)  
**Baseline commit before FA fixes:** `5687cb2a` (+ local uncommitted acceptance work)

| Metric | Target | Measured (ms) | Status | Notes |
|--------|--------|---------------|--------|-------|
| GET `/health` | <300 | 52 | PASS | |
| POST login (BFF) | <1000–3000 | 945 | PASS | includes bcrypt |
| GET `/work-orders/queues` | <1000 | **1611** | OVER target | Action Center aggregate; candidate for index/query review — **no optimization applied this session** (needs plan evidence) |
| GET `/work-orders?page=1&pageSize=25` | <500 | 225 | PASS | |
| GET `/notifications` | <500 | 29 | PASS | |
| GET `/reporting-kpis/overview` | <500 | 37 | PASS | |
| NAV `/action-center` | <2000–3000 | 433 | PASS | document |
| NAV `/work-orders` | <2000 | 490 | PASS | |
| NAV `/reports` | <2000 | 571 | PASS | |
| NAV `/inventory` | <2000 | **2704** | OVER | cold page; warm not re-measured |
| NAV `/action-center` (warm) | <2000 | 428 | PASS | |

Script: `scripts/verify-final-acceptance-perf.mjs`

## Optimization policy this session

Queues aggregate at 1611ms exceeds the 1s engineering target. Per zero-regression rules, **no speculative optimization** was applied without execution-plan evidence. Tracked as performance follow-up in `PERFORMANCE_OPTIMIZATION_RESULTS.md`.
