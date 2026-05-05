# Reporting System QA Checklist

## Access and Security
- Verify report routes require authentication and tenant context.
- Verify financial reports are blocked for technician, mechanic, driver, cleaner, and viewer roles.
- Verify system log reports are limited to super admin, admin, and asset manager roles.
- Confirm all report API responses are scoped to the active tenant.

## Dashboard Coverage
- Confirm `/reports` loads summary cards for jobs, completion rate, expenses, and low stock.
- Confirm module cards open Operations, Financials, User Activity, Assets, Inventory, Performance, and System Logs pages.
- Confirm dashboard filters update cards, alerts, and charts.
- Confirm the last-updated timestamp changes after refresh.

## Module Reports
- Validate each module page shows summary cards, decision signals, charts, and a paginated table.
- Validate date range, department, user, asset, status, supplier, category, and search filters where relevant.
- Validate table sorting and page-size controls.
- Validate empty states with filters that intentionally return no data.
- Validate error states by testing with an unavailable API.

## Export and Print
- Export CSV, Excel, and PDF from each module and confirm downloaded files open correctly.
- Confirm exports reflect the current filters and table columns.
- Confirm print output hides filter/export controls and preserves readable tables and charts.

## Data Accuracy
- Compare Operations totals against Work Orders records.
- Compare Financial totals against WorkOrder actual costs, WorkOrderPart costs, MaintenanceLog costs, PurchaseOrder totals, UtilityBill totals, and FarmExpense totals.
- Compare Inventory low-stock counts against SparePart thresholds.
- Compare User Activity and System Logs against AuditLog records.
- Confirm Data Coverage notes remain visible for login history, failed login attempts, and API error logs until dedicated persistence models are added.

## Responsive UI
- Test desktop, tablet, and mobile widths.
- Confirm filter controls wrap cleanly without overlapping.
- Confirm tables scroll horizontally on narrow screens.
- Confirm chart panels maintain stable heights and do not collapse.