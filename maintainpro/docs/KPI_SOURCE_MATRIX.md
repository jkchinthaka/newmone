# Dashboard KPI Source Matrix

Honest classification of dashboard KPI cards — no fake real-time or demo numbers.

| KPI / widget | Location | Source | Status | Notes |
|--------------|----------|--------|--------|-------|
| Work order totals (open, in progress, overdue, completed) | `WorkOrdersSummary` | Live API `GET /work-orders` | **LIVE** | 60s refresh; zeros are honest |
| Priority work order list | `WorkOrdersSummary` | Live API | **LIVE** | Filtered by role |
| Morning briefing | `RoleDashboard` | Live API aggregates | **LIVE** | Tenant-scoped |
| Inventory low-stock | `/inventory`, dashboard summaries | Live API | **LIVE** | |
| System health summary (admin) | `SystemHealthSummary` | `GET /health/readiness` | **LIVE** | Admin-only |
| Action center counts | `/action-center` | Live API | **LIVE** | |
| Vehicles blocked from gate-out | — | — | **ROADMAP** | Fleet data exists; no dedicated tile |
| Critical assets count | Assets module | Live list; no KPI tile | **PARTIAL** | |
| ERP sync failed count | System health | Readiness API | **PARTIAL** | Mock/disabled on staging |
| Monthly maintenance cost | Reports financials | Reports API | **PARTIAL** | Requires data volume |
| Department-wise issue count | — | — | **NOT AVAILABLE** | Roadmap |
| Technician workload chart | Technician dashboard | WO filter | **PARTIAL** | List-based, not chart |
| Predictive AI insights | `/predictive-ai` | Env-gated / mock | **PARTIAL** | Label as beta where shown |
| Farm/cleaning KPIs | Domain modules | Live when module enabled | **LIVE** | Tenant feature flags |

## UI behavior requirements

- **Loading:** `InlineLoadingState` / `LoadingState` on async KPI sections (implemented on WO summary)
- **Error:** `ErrorState` with retry (implemented on WO summary)
- **Empty:** Show zero or empty-state copy — never seeded demo counts
- **Footnote:** WO summary includes “Counts reflect live tenant work orders…”

## Verification

UAT-005 browser: admin dashboard loads without React errors; KPI footnotes visible where implemented.

See also `docs/UAT_CHECKLIST.md` § Dashboard KPIs.
