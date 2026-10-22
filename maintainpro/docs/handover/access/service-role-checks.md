# Service role checks

These checks stay in the service. A permission grant does not bypass them. The access screen should mark the related actions role-limited.

- `modules/approvals/approval-inbox.service.ts` — `OPERATIONS_ROLES`
- `modules/fleet-lifecycle/fleet-lifecycle.service.ts` — `GATE_OVERRIDE_APPROVER_ROLES`
- `modules/inventory/stock-count.service.ts` — `WRITE_ROLES`
- `modules/management-intelligence/management-intelligence.service.ts` — `BLOCKED_ROLES`, `FULL_ACCESS_ROLES`, `SUPERVISOR_ROLES`, `PARTS_ROLES`
- `modules/reports/maintenance-reports.service.ts` — `BLOCKED_ROLES`, `FULL_ACCESS_ROLES`, `PARTS_ACCESS_ROLES`
- `modules/suppliers/suppliers.service.ts` — `VENDOR_MANAGE_ROLES`
- `modules/vehicles/vehicles.service.ts` — role set used by the vehicle service
- `modules/work-order-taxonomy/work-order-taxonomy.service.ts` — `ADMIN_ROLES`, `TAXONOMY_MANAGER_ROLES`
- `modules/work-orders/vendor-repair.service.ts` — `FINANCE_ROLES`, `VENDOR_REQUEST_ROLES`
- `modules/work-orders/work-order-parts.service.ts` — `STOREKEEPER_ROLES`, `TECHNICIAN_ROLES`
- `modules/work-orders/work-order-queues.service.ts` — `TECHNICIAN_ROLES`, `ADMIN_ROLES`, `MANAGER_ROLES`
- `modules/work-orders/work-orders.service.ts` — role set used by the work order service

Assumption: a role-name `Set` in a service is a guardrail, not a route decorator. Route `@Roles` are not listed here.
