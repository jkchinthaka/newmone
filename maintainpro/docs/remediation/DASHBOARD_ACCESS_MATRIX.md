# Dashboard Access Matrix (Phase 5D)

**Status:** CONTRACT_DEFINED  
**Preserve:** Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`

Server-side dashboard snapshots must honor this matrix. The browser must not compute organization KPIs from truncated list pages.

## Role taxonomy

| Canonical | Display / alias | Notes |
| --- | --- | --- |
| `FINANCE` | Finance | **Canonical** Prisma / seed role for finance capability |
| `FINANCE_APPROVER` | Finance Approver | **Display / JWT alias only** — same access as `FINANCE`; must not create a second divergent ACL |
| `PROCUREMENT_OFFICER` | Procurement | Procurement variant |
| `MANAGER` / `OPERATIONS_MANAGER` | Management | Management variant |
| `ASSET_MANAGER` | Asset management | Asset-focused management |
| `SUPERVISOR` / `MAINTENANCE_SUPERVISOR` | Supervisor | Verification queues |
| `TECHNICIAN` / `MECHANIC` | Technician | Own work only |
| `INVENTORY_KEEPER` / `STOREKEEPER` | Inventory | Stock + receiving |
| `VIEWER` / `AUDITOR` | Viewer | Approved read-only summaries |
| `DRIVER` | Driver | Fleet/trip links |
| `CLEANER` | Cleaner | Cleaning workflows |
| Unknown / unsupported | Minimal | Quick links only |

## Variants

Legend: **Y** = visible, **Own** = scoped to actor, **RO** = read-only, **—** = hidden / denied.

### Summary matrix

| Variant | KPI cards | Queues | Financial | Audit / security | ERP monitor | Drill-downs | Mutations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| admin | Full ops + health | All | Y | Y | Y (safe) | Broad | Per RBAC |
| management | Org WO/inv/proc | Ops queues | Summary (non-PII) | Limited | Safe summary | Module reports | Per RBAC |
| finance | Approval + spend | Finance PO / PR | Y (canonical FINANCE) | — | Receipt/approval state | Financial + PO | Approvals only |
| procurement | PO / GRN / ERP | Ops + ERP backlog | Outstanding PO value | — | PO sync details | Procurement | PO ops (not erp_apply unless permitted) |
| asset management | Assets / WO / fleet | Maintenance due | Limited cost | — | — | Assets / WO | Per RBAC |
| supervisor | Team WO + verify | Verification backlog | — | — | — | Team WO | Verify |
| technician | Own WO only | Own overdue / rework | — | — | — | Own WO | Status/evidence own |
| inventory | Low/out stock, receipts | Issue / return / GRN | No org finance totals | — | Receiving state only | Inventory / receiving | Issue/receive per RBAC; **no erp_apply** |
| viewer | Approved RO summaries | — | No sensitive finance | No system logs | — | Approved report modules | RO only |
| driver | Trip/vehicle links | — | — | — | — | Vehicles / trips | Limited |
| cleaner | Cleaning tasks | — | — | — | — | Cleaning | Task updates |
| minimal | Welcome / links | — | — | — | — | Allowed nav only | None implied |

## Variant detail

### admin

- Cards: WO pressure, inventory, procurement/ERP safe summary, system health, audit signals, driver intelligence (if permitted).
- Queues: action-center style org queues.
- Finance: totals allowed with `reports.financials.view`.
- Audit/ERP: safe fields only (see ERP monitoring contract).
- Drill-downs: `/reports`, `/work-orders`, `/inventory`, `/procurement`, `/erp`, `/audit-logs` as permitted.

### management

- Cards: organization WO KPIs, inventory signals, procurement backlog summary, reports summary.
- No system administration secrets; ERP safe summary only.
- Drill-downs: operations modules + approved reports.

### finance (`FINANCE` canonical; `FINANCE_APPROVER` alias)

- Cards: finance approval queue, PO value, approved expenditure, receipt/invoice reconciliation where supported.
- No system administration / raw audit dump by default.
- Drill-downs: `/reports` financials, procurement finance paths, billing if permitted.

### procurement

- Cards: pending operational approvals, ERP failure/retry, GRN backlog, outstanding PO value.
- ERP: PO sync operational details (safe); apply/retry only with integration permissions.
- Drill-downs: `/procurement`, receiving.

### asset management

- Cards: critical assets, overdue maintenance, service due, related open WO.
- Limited vehicle/asset cost if `reports.vehicle_cost.view`.
- Drill-downs: assets, maintenance, work orders.

### supervisor

- Cards: team open/in-progress/overdue, verification backlog.
- No org-wide financial figures; no system audit logs.
- Drill-downs: work orders (team scope).

### technician

- Cards: **own** assigned, overdue, in-progress, rework.
- **No** organization-wide financial figures; **no** system audit logs; **no** ERP controls.
- Drill-downs: own work orders only.
- Test IDs: E2E-DASH-003.

### inventory

- Cards: low/out-of-stock, pending issues/returns, receiving queue, critical parts.
- No finance totals beyond approved operational need; **no ERP apply**.
- Drill-downs: inventory, receiving/GRN.
- Test IDs: E2E-DASH-004.

### viewer

- Explicitly approved read-only operational summaries only.
- No user list/filter leakage, no system logs, no sensitive finance unless separately permitted.
- Test IDs: E2E-DASH-007.

### driver / cleaner / minimal

- Focused quick links and module entry points; no org MIS financial/audit/ERP cards.

## Enforcement

- Service + controller assert variant/permissions; unauthorized restricted report → exact **403**.
- Cross-tenant counts blocked (E2E-DASH-009).
- Degraded sources → `DEGRADED`, never silent zero (E2E-DASH-010).

## Test IDs

E2E-DASH-001 … E2E-DASH-012 (see Full-Stack E2E Test Matrix Phase 5D).
