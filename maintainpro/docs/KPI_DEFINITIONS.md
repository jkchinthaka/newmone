# KPI Definitions Reference

**Formula version:** `2026-09-15.v1`  
**Source of truth:** `apps/api/src/modules/reporting-kpis/kpi-definitions.ts`

All KPI formulas are immutable records. Formula meaning may NOT be silently changed via UI configuration.  
Version bumps require explicit migration notes in this file and `IMPLEMENTATION_LOG.md`.

---

## Core invariants

| Rule | Rationale |
|------|-----------|
| **N/A ≠ 0** | Inapplicable KPIs (e.g. MTBF without meter data) return `emptyBehavior: "INSUFFICIENT_DATA"`, not 0. Displaying 0 would mislead operators into thinking assets have zero uptime between failures. |
| **Overdue is derived** | `dueAt < now AND status NOT IN {CLOSED, CANCELLED}`. CLOSED WOs with past due dates were completed — they must NOT re-enter the overdue count. |
| **MTTR uses repair cycle** | `repairCompletedAt − repairStartedAt`, not WO creation-to-close. Creation-to-close inflates with approval and parts wait time that is not repair time. |
| **Cost uses immutable snapshots** | `snapshotTotal` captured at WO close, not live `unitCost`. Post-close price changes must not alter historical cost KPIs. |

---

## Formula table

| Code | Display Name | Formula | Unit | Domains | Empty Behavior |
|------|-------------|---------|------|---------|---------------|
| `WO_OVERDUE` | Overdue Work Orders | `count(dueAt < now AND status ∉ terminal)` | count | `*` | ZERO |
| `WO_BACKLOG` | Work Order Backlog | `count(status ∉ terminal)` | count | `*` | ZERO |
| `WO_BACKLOG_AGING` | Backlog Aging | `buckets of (now − createdAt) for non-terminal WOs` | days | `*` | NULL |
| `PM_COMPLIANCE` | PM Compliance | `onTime / dueCount × 100` (cancelled excluded) | % | `*` | NULL |
| `PLANNED_VS_REACTIVE` | Planned vs Reactive | `plannedCount / totalNonCancelled × 100` | % | `*` | ZERO |
| `MTTR` | Mean Time To Repair | `avg(repairCompletedAt − repairStartedAt) in hours` | hours | MACHINERY | NULL |
| `MTBF` | Mean Time Between Failures | `operatingHours / failureCount` | hours | MACHINERY, FLEET_VEHICLE | **INSUFFICIENT_DATA** |
| `AVAILABILITY` | Availability | `(scheduledHours − downtimeHours) / scheduledHours` | ratio | MACHINERY, FLEET | NULL |
| `DOWNTIME` | Downtime | `sum(end − start) in minutes for downtime-tagged WOs` | minutes | MACHINERY | ZERO |
| `RESPONSE_TIME` | Response Time | `avg(acknowledgedAt − reportedAt) in hours` | hours | `*` | NULL |
| `REPEAT_FAILURE` | Repeat Failure | `count(asset+failureCode pairs with ≥2 occurrences in windowDays)` | count | MACHINERY | ZERO |
| `MAINTENANCE_COST` | Maintenance Cost | `sum(snapshotTotal) across closed WOs` | currency | `*` | ZERO |
| `COST_PER_KM` | Cost per KM | `maintenanceCost / distanceKm` (null if distance ≤ 0) | currency/km | FLEET | NULL |
| `FLEET_SERVICE_COMPLIANCE` | Fleet Service Compliance | `onTimeServices / dueServices × 100` | % | FLEET | NULL |
| `FUEL_EFFICIENCY` | Fuel Efficiency | `distanceKm / litres` | km/L | FLEET | NULL |
| `BUILDING_BACKLOG` | Building Backlog | `count(open WOs in FACILITY_CIVIL, BUILDING domains)` | count | BUILDINGS | ZERO |
| `COMPLIANCE_RATE` | Compliance Rate | `validCount / totalCount × 100` | % | `*` | NULL |
| `COMPLIANCE_DUE` | Compliance Due | `count(status = DUE)` | count | `*` | ZERO |
| `COMPLIANCE_EXPIRED` | Compliance Expired | `count(status = EXPIRED)` | count | `*` | ZERO |

---

## Terminal WO statuses

`CLOSED`, `CANCELLED` — WOs in these states are never overdue and never in backlog.

---

## Version history

| Version | Date | Changes |
|---------|------|---------|
| `2026-09-15.v1` | 2026-09-15 | Phase 13 initial registry: 19 KPI codes, pure compute helpers |
