# KPI Definition Catalog (Phase 5D)

**Status:** CONTRACT_DEFINED (source) — runtime validation pending Full-Stack E2E management-info gate  
**Reporting timezone:** `Asia/Colombo`  
**Storage timestamps:** UTC  
**Currency default:** LKR (`en-LK` presentation)  
**Preserve:** Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / workflow `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / workflow `30715842098`

This catalog is the single source of truth for management-information KPIs. Every dashboard card and report metric must map to a key below. Values are computed **server-side**, tenant-scoped, and must never present unavailable or insufficient data as zero.

## Common contract fields

| Field | Rule |
| --- | --- |
| Timezone | Business-day bounds and monthly buckets use `Asia/Colombo` |
| Tenant rule | Mandatory `tenantId` from auth context; never client-trusted alone |
| Empty | Genuine zero allowed only when the source query succeeds and count is zero |
| Degraded | Return `coverageStatus: DEGRADED` / `UNAVAILABLE` with safe reason code; UI must not treat as zero |
| Insufficient | Return `value: null` + `coverageStatus: INSUFFICIENT_DATA` (especially MTBF) |
| Owner | Module owning the authoritative aggregate query |

---

## Work orders

### `wo.total_created`

| Field | Value |
| --- | --- |
| Label | Work orders created |
| Meaning | Count of work orders created in range |
| Sources | `WorkOrder` |
| Numerator | `count(*)` where `createdAt` in range |
| Denominator | n/a |
| Date field | `createdAt` |
| Statuses | All statuses included |
| Tenant rule | `tenantId = context` |
| Role visibility | admin, management, finance (summary), procurement (ops link), supervisor, asset management; technician = own only |
| Empty / degraded | 0 if query ok; UNAVAILABLE if source fails |
| Owner | Reports / WorkOrders aggregate |
| Test IDs | E2E-KPI-001, E2E-DASH-002 |

### `wo.open`

| Field | Value |
| --- | --- |
| Label | Open |
| Meaning | Operationally open work not yet completed/cancelled |
| Sources | `WorkOrder.status` |
| Numerator | status in `OPEN`, `PENDING`, `APPROVED` (not started), `ASSIGNED`, `IN_PROGRESS`, `ON_HOLD`, `TECHNICIAN_COMPLETED`, `REWORK_REQUIRED` per non-overlapping matrix |
| Denominator | n/a |
| Date field | Snapshot as-of (not createdAt); optional created filter for trend |
| Statuses | See meaning; exclude `COMPLETED`, `CANCELLED` |
| Role visibility | admin, management, supervisor; technician own only |
| Owner | WorkOrders aggregate |
| Test IDs | E2E-KPI-002 |

### `wo.pending_approval`

| Field | Value |
| --- | --- |
| Label | Pending approval |
| Meaning | Awaiting operational approval |
| Sources | `WorkOrder.approvalStatus` |
| Numerator | `approvalStatus = PENDING` (or equivalent pending operational) |
| Date field | `createdAt` / `updatedAt` for aging |
| Role visibility | admin, management, supervisor |
| Test IDs | E2E-KPI-004 |

### `wo.approved_not_assigned`

| Field | Value |
| --- | --- |
| Label | Approved, not assigned |
| Meaning | Approved but no active assignee |
| Sources | `WorkOrder` + `WorkOrderAssignee` (canonical); legacy `technicianId` must not double-count |
| Numerator | approved AND no assignee row AND no legacy technician |
| Test IDs | E2E-KPI-002, E2E-KPI-006 |

### `wo.assigned_not_started`

| Field | Value |
| --- | --- |
| Label | Assigned, not started |
| Meaning | Has assignee; status not yet `IN_PROGRESS` |
| Sources | `WorkOrder`, assignees |
| Test IDs | E2E-KPI-002 |

### `wo.in_progress`

| Field | Value |
| --- | --- |
| Label | In progress |
| Meaning | Active execution |
| Sources | `WorkOrder.status = IN_PROGRESS` |
| Test IDs | E2E-KPI-002, E2E-DASH-003 |

### `wo.on_hold`

| Field | Value |
| --- | --- |
| Label | On hold |
| Meaning | Explicitly paused |
| Sources | `WorkOrder.status = ON_HOLD` |
| Test IDs | E2E-KPI-002 |

### `wo.tech_completed_awaiting_verification`

| Field | Value |
| --- | --- |
| Label | Awaiting supervisor verification |
| Meaning | Technician marked complete; supervisor verify pending |
| Sources | `WorkOrder.status = TECHNICIAN_COMPLETED` (or verification state) |
| Test IDs | E2E-KPI-005 |

### `wo.rework_required`

| Field | Value |
| --- | --- |
| Label | Rework required |
| Meaning | Returned for rework after verification failure |
| Sources | `WorkOrder.status = REWORK_REQUIRED` (or equivalent) |
| Role visibility | admin, management, supervisor; technician own |
| Test IDs | E2E-KPI-002, E2E-DASH-003 |

### `wo.completed` / `wo.cancelled`

| Field | Value |
| --- | --- |
| Label | Completed / Cancelled |
| Meaning | Terminal operational states in range by `completedAt` / status change |
| Date field | `completedAt` preferred for completed; `updatedAt` for cancelled if no terminal timestamp |
| Test IDs | E2E-KPI-002 |

### `wo.overdue`

| Field | Value |
| --- | --- |
| Label | Overdue |
| Meaning | Past due and not terminal, OR `slaBreached` / status `OVERDUE` per documented policy |
| Sources | `dueDate`, `status`, `slaBreached` |
| Timezone | Compare due end-of-day Asia/Colombo vs now |
| Test IDs | E2E-KPI-003 |

### `wo.sla_breached`

| Field | Value |
| --- | --- |
| Label | SLA breached |
| Meaning | Explicit SLA breach flag or policy computation |
| Sources | `WorkOrder.slaBreached` / SLA engine |
| Test IDs | E2E-KPI-003 |

### `wo.critical_high_priority`

| Field | Value |
| --- | --- |
| Label | Critical / high priority open |
| Meaning | Open WO with priority `CRITICAL` or `HIGH` |
| Test IDs | E2E-DASH-002 |

### `wo.unassigned`

| Field | Value |
| --- | --- |
| Label | Unassigned |
| Meaning | No canonical assignee and no legacy technicianId |
| Test IDs | E2E-KPI-006 |

### `wo.backlog_age_hours`

| Field | Value |
| --- | --- |
| Label | Average backlog age (hours) |
| Meaning | Mean age of non-terminal WO from `createdAt` to now |
| Numerator | sum(age hours) |
| Denominator | open backlog count |
| Empty | INSUFFICIENT_DATA if denominator 0 |
| Test IDs | E2E-KPI-002 |

### `wo.avg_response_time_hours`

| Field | Value |
| --- | --- |
| Label | Average response time |
| Meaning | Mean hours from create/approve to first start |
| Exclusions | Missing timestamps excluded from denominator |
| Empty | INSUFFICIENT_DATA when fewer than policy minimum samples |
| Test IDs | E2E-KPI-001 |

### `wo.avg_completion_time_hours`

| Field | Value |
| --- | --- |
| Label | Average completion time |
| Meaning | Mean hours from start (or create) to completed |
| Exclusions | Invalid / missing timestamps |
| Test IDs | E2E-KPI-001 |

### `wo.completion_rate`

| Field | Value |
| --- | --- |
| Label | Completion rate |
| Meaning | Completed / (created in range) or documented cohort denominator |
| Numerator | completed in range |
| Denominator | created in range (document if different cohort) |
| Empty | INSUFFICIENT_DATA if denominator 0 |
| Test IDs | E2E-KPI-001 |

### `wo.first_time_completion_rate`

| Field | Value |
| --- | --- |
| Label | First-time completion rate |
| Meaning | Completed without rework / completed |
| Coverage | INSUFFICIENT_DATA when rework history unsupported |
| Test IDs | E2E-KPI-001 |

### `wo.mttr_hours`

| Field | Value |
| --- | --- |
| Label | MTTR |
| Meaning | Mean time to repair for completed corrective work with valid repair intervals |
| Numerator | sum(repair duration hours) |
| Denominator | count of valid repair intervals |
| Empty | `value: null`, `INSUFFICIENT_DATA` when sample < minimum |
| Never | Display as 0 when data insufficient |
| Test IDs | E2E-KPI-012 |

### `wo.mtbf_hours`

| Field | Value |
| --- | --- |
| Label | MTBF |
| Meaning | Mean time between failures for asset/vehicle cohorts with ≥ N inter-failure intervals |
| Numerator | sum(intervals) |
| Denominator | interval count |
| Empty / insufficient | **`value: null` + `coverageStatus: INSUFFICIENT_DATA`** when intervals insufficient — **never display as zero** |
| Owner | Maintenance / Assets analytics |
| Test IDs | E2E-KPI-012 |

---

## Workforce

| Key | Label | Meaning | Sources | Notes | Test IDs |
| --- | --- | --- | --- | --- | --- |
| `wf.employee_pending` | Pending work per employee | Open assigned WO per employee | `WorkOrderAssignee`, `WorkOrder` | Canonical assignee model only | E2E-KPI-006 |
| `wf.technician_workload` | Technician workload | Open + in-progress load | Assignees | No double-count legacy `technicianId` | E2E-KPI-006, E2E-DASH-003 |
| `wf.overdue_per_technician` | Overdue per technician | Overdue assigned to technician | WO + assignees | Own-only for technician variant | E2E-KPI-003 |
| `wf.assignment_capacity` | Assignment capacity | Available vs assigned headcount | Workforce + leave | DEGRADED if leave feed fails | E2E-DASH-002 |
| `wf.leave_conflicts` | Leave / availability conflicts | Assignments overlapping leave | Leave + assignees | INSUFFICIENT_DATA if leave unsupported | E2E-KPI-006 |
| `wf.verification_backlog_supervisor` | Verification backlog | TECHNICIAN_COMPLETED awaiting verify | WO | Per supervisor scope | E2E-KPI-005 |

---

## Inventory

| Key | Label | Meaning | Sources | Formula notes | Test IDs |
| --- | --- | --- | --- | --- | --- |
| `inv.low_stock` | Low stock | Parts at/below reorder threshold | `SparePart` | Same threshold rule as Inventory service | E2E-KPI-007 |
| `inv.out_of_stock` | Out of stock | quantity ≤ 0 | `SparePart` | Active parts only | E2E-KPI-007 |
| `inv.inventory_value` | Inventory value | Σ(qty × unitCost) | Parts | LKR numeric + currencyCode | E2E-KPI-008 |
| `inv.stock_issues` | Stock issues | Issues in range | Movements / stock-issue | Tenant + date | E2E-KPI-007 |
| `inv.stock_receipts` | Stock receipts | GRN/receipts in range | `PurchaseReceipt` | No duplicate replay inflation | E2E-KPI-011 |
| `inv.unreconciled_movements` | Unreconciled movements | Movements pending reconcile | Movements | DEGRADED if reconcile unsupported | E2E-KPI-007 |
| `inv.pending_returns` | Pending returns | Open return requests | Part returns | Inventory/ops roles | E2E-DASH-004 |
| `inv.critical_parts` | Critical parts | Critical flag + low/out | Parts | Admin/management/inventory | E2E-DASH-004 |

---

## Procurement

| Key | Label | Meaning | Sources | Test IDs |
| --- | --- | --- | --- | --- |
| `proc.pending_operational` | Pending operational PO approvals | PO operational pending | `PurchaseOrder` | E2E-KPI-009 |
| `proc.pending_finance` | Pending finance approvals | PO finance pending | PO | E2E-KPI-009, E2E-DASH-005 |
| `proc.approved_not_erp` | Approved not sent to ERP | Approved, not successfully synced | PO + ERP attempt | E2E-KPI-010, E2E-DASH-006 |
| `proc.erp_failed` | Failed ERP syncs | Latest attempt FAILED (no duplicate inflation) | ERP sync records | E2E-KPI-010, E2E-ERP-MON-001 |
| `proc.erp_retries_due` | Retries due | `nextRetryAt ≤ now` and attempts < max | ERP sync | E2E-KPI-010 |
| `proc.ordered_not_received` | Ordered not received | ORDERED with zero receipt qty | PO + receipts | E2E-KPI-011 |
| `proc.partially_received` | Partially received | PARTIALLY_RECEIVED / partial lines | PO + receipts | E2E-KPI-011 |
| `proc.overdue_grn` | Overdue GRN | Past expected receipt date | PO dates | E2E-DASH-006 |
| `proc.outstanding_po_value` | Outstanding PO value | Server line totals for open PO | PO lines | LKR; E2E-KPI-009 |
| `proc.supplier_concentration` | Supplier concentration | Share of spend by supplier | PO | INSUFFICIENT_DATA when volume low |

---

## Fleet / assets

| Key | Label | Meaning | Sources | Test IDs |
| --- | --- | --- | --- | --- |
| `fleet.critical_assets` | Critical assets | Critical/high-risk assets | Assets | E2E-DASH-002 |
| `fleet.overdue_maintenance` | Overdue maintenance | Schedules past due | Maintenance schedules | E2E-KPI-001 |
| `fleet.service_due` | Service due | Upcoming within window | Schedules | Asia/Colombo window |
| `fleet.gate_out_blocked` | Gate-out blocked | Vehicles blocked from gate-out | Fleet / compliance | UNAVAILABLE if module off |
| `fleet.compliance_expired` | Compliance-expired blocks | Expired docs blocking use | Compliance | |
| `fleet.active_breakdowns` | Active breakdowns | Open corrective WO on assets/vehicles | WO + assets | |
| `fleet.downtime_hours` | Downtime | Documented downtime hours in range | Downtime / WO | INSUFFICIENT_DATA if sparse |
| `fleet.vehicle_cost` | Vehicle cost | Cost analytics module totals | Vehicle cost report | Requires `reports.vehicle_cost.view` |
| `fleet.fuel_anomaly` | Fuel anomaly count | Anomaly detections in range | Fuel analytics | Requires `reports.fuel.view` |

---

## Audit / system

| Key | Label | Meaning | Sources | Visibility | Test IDs |
| --- | --- | --- | --- | --- | --- |
| `audit.security_sensitive_changes` | Security-sensitive changes | Role/permission/settings mutations | AuditLog / security events | `audit.view` | E2E-AUDIT-001 |
| `audit.failed_logins` | Failed login events | Queryable safe login failures | Security events | admin + audit | E2E-AUDIT-002 |
| `audit.lock_rate_limit` | Lock / rate-limit events | Account lockouts | Security events | admin + audit | E2E-AUDIT-002 |
| `audit.role_permission_changes` | Role / permission changes | RBAC mutations | AuditLog | audit.view | E2E-AUDIT-001 |
| `audit.unresolved_critical_notifications` | Unresolved critical notifications | Open critical notifications | Notifications | management/admin | E2E-DASH-002 |
| `audit.degraded_dependencies` | Degraded dependencies | Health readiness failures | Health | admin | E2E-DASH-001, E2E-DASH-010 |

---

## Coverage status enum

| Status | Meaning | UI |
| --- | --- | --- |
| `COMPLETE` | Authoritative aggregate succeeded | Show value |
| `DEGRADED` | Partial source failure | Show available value + banner; not silent zero |
| `UNAVAILABLE` | Source failed / unauthorized path | Hide or show unavailable; never fake 0 |
| `INSUFFICIENT_DATA` | Definition requires more samples (e.g. MTBF) | `value: null`; never show 0 |

## Non-goals

- Client-side aggregation of full WO/inventory lists for KPI cards
- Silent FX conversion
- Treating MTBF/MTTR insufficient samples as zero
