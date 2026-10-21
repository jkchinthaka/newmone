# Work order flow v1.0.3

Current: a manager plans an OPEN job, then assigns. Assign while approval is pending fails with a status error. The role named SUPERVISOR was on plan/verify routes but not in `SUPERVISOR_ROLES`. The work-order list had Edit and Cancel, not one next step. COMPLETED and OVERDUE appeared in status filters. Request permission was missing for security and inventory.

New: an approved OPEN job is assigned in one transaction (OPEN to PLANNED, then PLANNED to ASSIGNED), with history and audit for both. Pending approval returns "Approve this work order before assigning a technician." Plan and verify use `SUPERVISOR_ROLE_NAMES`. The list shows one primary button: Assign technician, Start job, Mark complete, Verify & close, or Send back. Other row actions sit under More. Legacy statuses stay on old records and leave the filters. Assign notifies the technician. Technician completion notifies managers and admins. Close notifies the creator and the request reporter.

Roles: any of the six can raise a request. Manager or admin approves and assigns. Technician starts and completes with photos. Manager verifies and closes. Technician cannot verify their own job. Security and inventory get no work-order management button.

Files: `work-order-governance.ts`, `work-orders.service.ts`, `work-orders.controller.ts`, `seed.ts`, `v103-grants.ts`, `scripts/ops/grant-v103-permissions.ts`, `visible-login-roles.ts`, `work-order-next-action.ts`, `work-order-action-messages.ts`, people and user dialogs, work-order table, queue and list filters, supervisor panel.

Fixes: Send back is the secondary action on a technician-completed job. Security and inventory rows have no management buttons. Legacy COMPLETED and OVERDUE stay out of both status filters. Approve uses PATCH. Assign from an approved OPEN job writes both history rows in one transaction.

E2E: send the CSRF cookie as `x-csrf-token`. The request uses a real asset and urgency URGENT, then start-review, approve, and convert. Each role signs in once (login limit 5 per minute). Start, hold, and complete send `expectedVersion`. A photo stays pending until the JPEG bytes are stored and confirmed. The technician scans the work-order asset before complete. An open labour session is held first. A technician read of an unassigned work order is 403.

Dry-run on `maintainpro_e2e_wo_verify`: KEEP `maintenance_requests.create` on ADMIN, MANAGER, and SUPER_ADMIN. GRANT it to INVENTORY_KEEPER, SECURITY_OFFICER, and TECHNICIAN. No approval-rule change. The script was applied only on that e2e database.
