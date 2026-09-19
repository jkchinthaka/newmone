# UI → API → DB Mapping Matrix

**Baseline:** PR #42 `5687cb2a` · Branch: `maintainpro/final-acceptance-validation`  
**Rule:** PASS only when UI value = API response = SQL Server row (read-only Prisma/SQL).

| UI path | Component / client | HTTP | API prefix | Prisma model(s) | Key fields | Persist verified |
|---------|--------------------|------|------------|-----------------|------------|------------------|
| `/login` | auth login page | POST | `/api/auth/login` | `User`, `RefreshToken` | email, httpOnly cookies | PASS (cookies, no localStorage JWT) |
| `/action-center` | `action-center-page` + queues API | GET | `/api/work-orders/queues` | `WorkOrder` counts | open, inProgress, highPriorityOpen | PASS (UI=API=SQL Docker DB) |
| `/notifications` | notifications UI + Socket.IO | GET/WS | `/api/notifications`, ns `/notifications` | `Notification` | cookie handshake 101 | PASS (handshake) |
| `/requests/new` | request create form | POST | `/api/maintenance-requests` | `MaintenanceRequest`, history | tenantId, status, number | PENDING session proof |
| `/requests/[id]` | convert to WO | POST | `/api/maintenance-requests/:id/convert*` | `MaintenanceRequest`+`WorkOrder` | linkage FKs | PENDING session proof |
| `/work-orders` | editor modal / hooks | POST/PATCH | `/api/work-orders` | `WorkOrder`, status history, assignees | woNumber, status, priority | PENDING session proof |
| `/inventory` | inventory hooks | POST | `/api/inventory/*` | `StockMovement`, `WarehouseItemBalance`, `PartIssue` | qty, warehouse, part | PARTIAL (API tests) |
| `/inventory/stock-counts` | stock count UI | POST | `/api/inventory/stock-counts*` | `StockCountSession`/`Line` | posted ledger | PARTIAL |
| `/approvals/[id]` | approval decide | POST | `/api/approvals/*` | `ApprovalRequest`, `ApprovalDecision` | decision, actor | PARTIAL |
| `/assets` | assets management | POST/PATCH | `/api/assets` | `Asset` | taxonomy FKs | PARTIAL |
| `/vehicles` | vehicles page | POST/PATCH | `/api/vehicles` | `Vehicle` | plate uniqueness | PARTIAL |
| `/fleet/gate` | gate screen | POST | `/api/vehicles/:id/gate-out|gate-in` | `VehicleGateMovement` | eligibility | PARTIAL |
| `/cleaning/issues` | facility issues | POST | `/api/cleaning/issues` | `FacilityIssue` | site/room FKs | PARTIAL |
| `/admin/users` | users admin | POST | `/api/users` | `User`, role links | role, tenant | PARTIAL |
| `/reports` | reports pages | GET | `/api/reports/*`, `/api/reporting-kpis` | various aggregates | tenant scope | PARTIAL |
| `/procurement` | procurement page | POST | inventory/PO endpoints | `PurchaseOrder`+lines | totals | PARTIAL |

## Aggregate correctness (preserved from PR #42)

| Metric | UI | API `/work-orders/queues` | SQL (same DB as API) | Match |
|--------|----|---------------------------|----------------------|-------|
| Open requests | Action Center | `queues[open-requests].count` | `WorkOrder` status OPEN | PASS |
| In progress | Action Center | `queues[in-progress]` (IN_PROGRESS+ON_HOLD) | same | PASS |
| High priority open | Action Center | `summary.highPriorityOpen` | non-terminal HIGH/CRITICAL | PASS |
| Terminal exclusion | — | COMPLETED/CANCELLED/CLOSED excluded from operational aggregates | same | PASS |

Script: `scripts/verify-action-center-wo-aggregates.mjs` (point `ACTION_CENTER_SQL_URL` at API DB).
