# Pre-roadmap reconciliation — Phase 14

This records decisions. It is not authorization logic.

## Maintenance menu

Machinery, Service, and Vehicle Jobs stay filters on the shared Work Order list. Live Map and the Flutter app stay retired.

| Menu item | Route | Decision | Reason |
| --- | --- | --- | --- |
| Maintenance Dashboard | `/maintenance` | KEEP | Open-job signals |
| Requests | `/requests` | KEEP | Request intake |
| Work Orders | `/maintenance/jobs` | KEEP | Shared work-order engine |
| Machinery / Service / Vehicle Jobs | `/maintenance/jobs/machinery`, `/service`, `/vehicle` | KEEP | Same engine, domain filter |
| Planning & Scheduling | `/maintenance/planning` | KEEP | Schedule view |
| Preventive Maintenance | `/maintenance/plans` | KEEP | PM plans |
| Inspections | `/maintenance/inspections` | KEEP | Inspection records |
| Reliability | `/maintenance/reliability` | KEEP | Existing RCA, not a second engine |
| My Jobs | `/work-orders/my` | KEEP | Assigned queue |
| Vendors / External Repairs | `/procurement/vendors` | KEEP | External repair vendors |
| Costs | `/maintenance/costs` | KEEP | Labour, parts, services, recorded total |
| Maintenance History | `/maintenance/history` | KEEP | Links into asset, vehicle, and job history |
| Approvals | `/approvals` | KEEP | Pending approvals |
| Reports & Analytics | `/reports` | KEEP | Canonical report entry |
| Job codes, forecast | `/maintenance/job-codes`, `/maintenance/forecast` | MERGE | Reachable from planning, not a second menu |

## Features

| Feature | Decision | Reason |
| --- | --- | --- |
| Maintenance exceptions | KEEP | Counts and drill-down already share `maintenance-reports.service.ts` |
| High-cost part issues | FINALIZE | Queue risk now uses the same `PART_APPROVAL_HIGH_THRESHOLD` as the exception report |
| Repeated breakdowns | KEEP | Groups corrective/emergency work orders by asset in the last 30 days. Reliability RCA stays the detail engine |
| Completed without evidence | KEEP | Storage being down does not mark every job as missing evidence |
| Parts issued, job not completed / pending returns | KEEP | Existing exception types |
| Maintenance cost summary | KEEP | Page totals are parts + labour + external services |
| Historical part cost | KEEP | ERP snapshot import does not rewrite issued cost snapshots |
| Asset and vehicle history | KEEP | History page routes into those records. Live Map is not required |
| Work-order and request traceability | KEEP | Existing status and conversion records |
| PM occurrence protection | KEEP | Already enforced. Not rebuilt |
| ERP reconciliation history | KEEP | Pending vs acknowledged stays a maintenance record, not a live Bileeta call |
| Global search and notification bell | KEEP | Already in the shell |
| Dashboard customization | DEFER | Not required for this release |
| Predictive maintenance AI | DEFER | Not a current release feature |
| Cleaning workflows | KEEP | Separate from the maintenance job engine. Cleaner role remains |
| Push notifications, live GPS, native mobile | RETIRE | Live Map and Flutter stay retired |
| Bulk user import | DEFER | Already decided in Phase 13 |

## What was checked locally

Signed in as superadmin. Reports showed 258 jobs and consumed maintenance cost LKR 2,797. Exceptions included overdue 3, parts issued but not completed 1, and completed without evidence 1. Costs showed recorded LKR 26.00 equal to parts LKR 26.00 plus labour 0. History opened as a timeline hub. `maintenance-cost-rollup.spec.ts` and `maintenance-reports.spec.ts` passed, 11 tests.

Exception cards with a count above zero now match their drill-down totals. `parts-not-accounted` and `repeated-breakdowns` no longer open the unfiltered work-order list. A completed job is an evidence exception only when it has no uploaded evidence.

Checked against the API on 2026-09-30: completed without evidence 1 = 1, parts issued but job not completed 1 = 1, parts not accounted 1 = 1, repeated breakdowns 1 = 1, overdue 3 = 3, cancelled in 30 days 227 = 227. The overdue CSV export has 3 data rows. Cleaner received 403 on exceptions, costs, and export. A tenant admin who sent another tenant id received 403. Inventory keeper is not given the full exception report. Manager received 200.

The cleaner browser session returns `/reports` and `/reports/maintenance-exceptions` to the action center and does not show the job total. The costs page shows a permission error and hides export. After signing back in as superadmin, reports still show 258 jobs.

Date checks, using UTC date boundaries (`start` at 00:00:00.000Z through `end` at 23:59:59.999Z):

| Range | Overdue card / list / export | Evidence card / list / export | Cancelled card / list / export |
| --- | --- | --- | --- |
| 2020-01-01 to 2026-09-30 | 3 / 3 / 3 | 1 / 1 / 1 | 227 / 227 / 227 |
| 2026-09-30 to 2026-09-30 | 1 / 1 / 1 | 0 / 0 / 0 | 227 / 227 / 227 |
| 2020-01-01 to 2020-01-02 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

A reversed range returns 400, "Invalid date range." Overdue and evidence use `createdAt` inside the selected range. Cancelled uses `updatedAt` in the last 30 days and not after the selected end date. It does not use the selected start date. The card, list, and export share that rule. Clear filters on the exceptions page restores the default 30-day dates.
