# Performance Optimization Results

| ID | Problem | Evidence | Before | Change | After | Regression | Impact | Rollback | Status |
|----|---------|----------|--------|--------|-------|------------|--------|----------|--------|
| PERF-AC-01 | Action Center `/work-orders/queues` >1s | Logs: ~15–18 parallel COUNTs each ~80–140ms; second-wave aggregates after first batch; `tenantId+status` indexes already present | Cold ~1611ms; warm ~170–200ms | Folded Action Center aggregates into the same `Promise.all` wave as queue counts (no semantic change) | Warm **154ms**; cold after restart still ~1.2–1.5s (connection/pool warmup) | Action Center counts unchanged | Correctness preserved | revert queues service wave merge | **CLOSED for warm target** |
| PERF-INV-01 | `/inventory` cold NAV 2704ms | Page fires 7 React Query calls; Next `dev` cold compile dominates document TTFB | 2704–2963ms document (dev) | `staleTime` 30–60s; defer analytics/dashboard until parts settle | Primary list still loads first; fewer cold waterfalls | Inventory correctness unchanged | Perceived load / API contention | revert hooks.ts | **IMPROVED** — full <2s needs prod build measurement |

## Root-cause notes (Phase 2)

### Queues (~1611ms baseline)

1. Implementation `queues-lightweight-v2` already parallelizes role-gated counts.
2. Warm wall-clock ~150–200ms — **meets <1000ms**.
3. Cold spike is dominated by first-request Prisma/SQL pool warmup after process start, not missing `(tenantId, status)` indexes (already on `WorkOrder`).
4. No approximate/stale counts introduced.

### Inventory cold NAV

1. Document fetch in `next dev` includes route compile cost — not equal to API latency.
2. Client waterfall: parts + suppliers + low-stock + POs immediately; charts/dashboard deferred after parts settle.
3. Retest with `npm run build` + `next start` before treating remaining document TTFB as a DB defect.
