# UI → API → DB Mapping Matrix

**Baseline:** PR #43 `ad4ec4e2` · Phase 2: `maintainpro/final-acceptance-phase2`
**Rule:** PASS only when API response = SQL Server row (Prisma read of API DB).

| UI path | HTTP | API prefix | Prisma model(s) | Persist verified |
|---------|------|------------|-----------------|------------------|
| `/login` | POST | `/api/auth/login` | `User` | PASS |
| `/action-center` | GET | `/api/work-orders/queues` | `WorkOrder` counts | PASS |
| `/requests/new` | POST | `/api/maintenance-requests` | `MaintenanceRequest` | PASS (Phase2) |
| `/requests/[id]` convert | POST | `/api/maintenance-requests/:id/convert*` | MR + `WorkOrder` FK | PASS (Phase2) |
| `/work-orders` lifecycle | POST/PATCH | `/api/work-orders*` | `WorkOrder`, `WorkOrderStatusHistory` | PASS (Phase2) |
| `/inventory` stock | POST | `/api/inventory/parts/:id/stock-*` | `SparePart.quantityInStock`, `StockMovement` | PASS (Phase2) |
| `/inventory/stock-counts` | POST | `/api/inventory/stock-counts*` | `StockCountSession`/`Line` | PASS POSTED (Phase2) |
| Planning PM | POST | `/api/planning/pm-plans` | `PmPlan`, `PmPlanRevision`, `PmTrigger` | PASS (Phase2) |
| `/vehicles` + gate | GET | `/api/vehicles`, `/api/fleet-lifecycle/.../gate-eligibility` | `Vehicle` | PASS list/eligibility |
| Approvals inbox | GET | `/api/approvals/inbox` | `ApprovalRequest` | PASS |
| Work permits | GET | `/api/work-permits` | permit models | PASS list |
| Reliability | GET | `/api/reliability/policy` | policy | PASS |

## Aggregate correctness (PR #42 preserved)

| Metric | API | SQL | Match |
|--------|-----|-----|-------|
| Open / in-progress / highPriorityOpen / openUnassigned | `/work-orders/queues` | scoped counts | PASS |

Scripts: `verify-action-center-wo-aggregates.mjs`, `verify-phase2-journeys.mjs` (`ACTION_CENTER_SQL_URL` → API DB).
