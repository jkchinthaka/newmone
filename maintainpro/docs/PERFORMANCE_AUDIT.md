# Performance audit

Measured on 2026-10-01 against local MaintainProDev. Branch `perf/final-full-project-optimization`, based on `main` `95f44ca6`. The older checkpoint `43f2363b` was not merged. Its measurements live in the same path, `maintainpro/docs/PERFORMANCE_AUDIT.md`, at that commit. Only its tenant-scoped queue-summary cache was copied by hand, because the jobs page already used that cache key.

The API on port 3000 was already healthy. A second API start exited because that port was taken. These numbers are from the process that was already listening. The web app on port 3001 answered 200. Docker Desktop was not running, so Redis was not pinged. The API health endpoint still returned 200.

Lab timings are a single local API process talking to local SQL Server. They are not production user metrics. Ten warm samples follow one cold call unless a row says eleven calls. Load rows from the earlier burst in this file are one simultaneous burst, not a sustained soak.

## What changed

| Area | Before (same machine, bug-fixed main) | After | Bottleneck | Change |
| --- | --- | ---: | --- | --- |
| Work Orders, page 20, queue all | cold 278 ms, p50 212 ms, p95 one sample 13.9 s | cold 112 ms, p50 86 ms, p95 92 ms | Each of the 20 rows waited in turn for `computeWorkOrderRiskFactors`, then the high-risk count ran after the other summary counts | Rows are enriched together, and the high-risk count runs with the other summary counts |
| Machinery / Service / Vehicle lists, page 20 | p95 238 / 213 / 200 ms | p95 101 / 84 / 92 ms | Same per-row wait | Same change |
| Queue summary | cold 114 ms, warm p95 35 ms | cold 104 ms, warm p95 34 ms | Already parallel counts | No server change. Sidebar and Action Center now share one tenant-scoped React Query entry for 30 seconds |
| Exceptions report, page 20 | warm p95 418 ms | warm p95 420 ms | Unchanged | Left as-is so card, list, and export stay on the same predicate |

Error rate on the timed reads: 0. `/maintenance-requests?page=1&pageSize=20` and `/reports/maintenance-costs` returned 400 because those query shapes are incomplete, not because the server failed.

## Shared cache

Action Center and the sidebar both call `GET /work-orders/queues`. The cache key is `["work-orders", "queue-summary", "", <active tenant id>]`. A missing tenant is stored as `"none"`, not a shared global bucket. The server still applies tenant and role checks on every miss. Stale time stays 30 seconds. Counts still come from the queue-summary endpoint.

BH-06 through BH-18 are unchanged by this cache. Navigation ownership, validation, idempotency, user delete, and ERP acknowledgement still live on the server.

## Other warm single-user samples (after)

| Endpoint | Cold ms | p50 | p95 |
| --- | ---: | ---: | ---: |
| `/auth/me` | 78 | 60 | 83 |
| Notifications unread | 26 | 9 | 10 |
| Maintenance dashboard | 53 | 23 | 28 |
| My Jobs | 13 | 12 | 14 |
| Assets page 20 | 20 | 15 | 16 |
| PM plans | 23 | 24 | 28 |
| Inspections | 21 | 21 | 23 |
| Reliability summary | 33 | 59 | 117 |
| Fleet overview | 117 | 153 | 209 |
| Gate-eligible vehicles | 50 | 48 | 71 |
| Spare parts | 28 | 59 | 69 |
| ERP events | 23 | 53 | 68 |
| Admin users | 23 | 19 | 21 |
| Maintenance requests, page 20 (`limit`, not `pageSize`) | 55 | 42 | 45 |
| Maintenance costs, 1–30 Sep 2026, page 25 | 121 | 40 | 44 |
| Reports dashboard | 231 | 126 | 134 |
| One existing work-order history | 32 | 34 | 42 |
| One existing request history | 60 | 26 | 59 |
| Global search `pump`, limit 10, super admin | 33 | 36 | 38 |

p99 matched p95 on these small samples. Admin `GET /search` returned 403 because that route requires `assets.view`. That is authorization, not a slow query. Global search waits 250 ms between keystrokes, keeps 20 results by default, and drops a response that is older than the latest keystroke. It does not cancel the HTTP call. Tenant and permission filters stay on the server.

Work-order list warm p99 on the optimized page of 20 was 92 ms, the same as p95 in that ten-sample set. Machinery, service, and vehicle p95 values above are also the p99 for those samples.

Historical warm numbers from commit `43f2363b`, before the bug-hunt merge and before this list change: work orders p50 203 ms and p95 469 ms; queue summary p50 47 ms and p95 60 ms. The cold duplicate queue calls in that log were 315 ms and 212 ms. This pass remeasured the bug-fixed process instead of reusing those numbers as the after column.

Simple and normal reads are under the 300 ms and 500 ms engineering targets for a single user. The exceptions report stays under 1000 ms alone and misses that target when many requests run together.

## Queue summary

Counts already run in one `Promise.all`. `waiting-evidence` still loads up to 2000 non-terminal work orders and their evidence rows, then applies the same `resolveEvidenceStatus` function as the list. That keeps the badge equal to the list. Replacing it with a cheaper SQL predicate would let the badge and the list disagree, so it was not changed.

`action-required` is one count with an `OR` of approval, overdue, parts, and verification predicates. Existing indexes cover `tenantId + status`, `tenantId + dueDate`, `tenantId + technicianId + status`, and `tenantId + jobDomain + status`.

## Indexes

No index was added.

| Considered | Decision |
| --- | --- |
| `(tenantId, priority, dueDate, updatedAt)` for the default list sort | Rejected. The measured wait was per-row risk queries, not the sort scan. |
| `(workOrderId, deletedAt, status)` on evidence attachments | Rejected for this pass. The nested load is bounded to the page except for the evidence badge, and a new write index was not justified without an execution plan showing that scan. Existing index is `(tenantId, workOrderId)`. |
| Existing redundant single-column indexes (`status`, `priority`, `dueDate`) | Left in place. Dropping them is a schema cleanup, not this performance pass. |

## N+1

`safeEnrichRows` called `computeWorkOrderRiskFactors` one row at a time. Each call loads the work order again, then may count breakdowns and read the vendor case. Those calls now run together for the page. The function itself is unchanged, so risk values stay the same. A later pass could batch the asset counts. That was not required to get the single-user list under 100 ms p95.

Global search debounces 250 ms, caps `pageSize` at 20 by default, and ignores a response that is older than the latest keystroke. It does not abort the in-flight HTTP call. Tenant and permission filters stay on the server.

## Frontend

No shell or bundle redesign. The only client change is the shared queue-summary query. Favorites, the 264 px sidebar, the 80 px collapsed width, search, and the bell are untouched.

## Web Vitals (lab, Next dev, not production)

PerformanceObserver on a local dev server after an API login and a stored tenant. CLS stayed under 0.1. INP was not scored: the lab click was not read by a production interaction observer. Desktop LCP on later routes includes dev compilation and should not be quoted as production LCP.

| Screen | 1440 LCP ms | 1440 CLS | 390 LCP ms | 390 CLS |
| --- | ---: | ---: | ---: | ---: |
| Action Center | 1380 | 0 | 1188 | 0.042 |
| Maintenance dashboard | 692 | 0 | 864 | 0 |
| All Jobs | 5136 | 0.029 | 876 | 0.017 |
| Assets | 4088 | 0.023 | 872 | 0 |
| Inventory | 5568 | 0 | 1556 | 0 |
| Reports | 3768 | 0 | 944 | 0.022 |

## Load burst (local, read-only, 0 HTTP 500s)

| Users | Work orders p95 | Queue summary p95 | Assets p95 | Fleet p95 | Parts p95 | Exceptions p95 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 708 | 290 | 111 | 295 | 247 | 2605 |
| 25 | 1540 | 2072 | 179 | 401 | 215 | 2996 |
| 50 | 2971 | 776 | 253 | 539 | 305 | 4761 |

Throughput for 50 simultaneous work-order list calls was about 17 requests per second. Queue summary at 25 users was slower than at 50 on this run; that is one burst on a warmed pool, not a curve. Exceptions and the work-order list are the concurrency bottlenecks. Both stayed correct (no 500s). No write load was applied to gate, parts, or ERP acknowledgement, so stock quantity and gate state were not touched.

## Write path

Not retimed under load. Create, version checks, conversion, and gate claim behavior from BH-09, BH-10, BH-11, and BH-18 were not changed. List enrichment only changes how many risk lookups run at once.

## Bileeta

No change to `SparePart.quantityInStock`. Consumption still does not increment or decrement the ERP snapshot.

## Remaining bottlenecks

Single-user work-order and queue targets are met on this machine. These are not met, and were not forced:

- Exceptions report under 10 or more simultaneous readers
- Work-order list when 25 or 50 requests arrive together
- `waiting-evidence` still scans up to 2000 jobs for badge/list equality
- Desktop LCP in the Next dev server

Status: PERFORMANCE OPTIMIZATION COMPLETE — REMAINING BOTTLENECKS DOCUMENTED
