web-permission-aliases (Claude, 2026-10-22), branch fix/web-permission-aliases from origin/develop 658ae0c2.
Bug: MANAGER is an approver, but the web nav/route guard required the literal key approvals.view. The API accepts work_orders.manage as an alias, so MANAGER was redirected from /approvals to /maintenance.
Fix: apps/web/lib/permission-aliases.ts holds the same alias map and rule as the API guard (including the SUPERVISOR work_orders.verify exception). isNavigationItemVisible uses it, which covers the sidebar, route guard, command palette and landing.
No API change. The API guard and its alias map are untouched (keeps feat/access-studio merge clean).
Nav items whose visibility can change: /approvals (approvals.view <- approvals.decide, approvals.rule.manage, work_orders.manage), /requests and /requests/mine (facility_issues / cleaning aliases). Each matches what the API already allows.
apps/api/test/permission-aliases-parity.spec.ts compares the web copy with the API guard for every catalog key x single granted key x role (MANAGER, SUPERVISOR, none): 0 mismatches. Drift fails CI.
apps/web/lib/__tests__/permission-aliases.test.ts: MANAGER sees and opens /approvals; roles without the key or an alias still cannot.
Gates (cloud checkout): API tsc 0, web tsc 0, web unit 370/370, API Jest parity + permissions.guard 19/19 (fast) and parity 1/1 (full ts-jest), audit:rbac 0, audit:tenant 0.
Not run here: browser check as manager on 3041; DB tests.

Follow-up (Claude, 2026-10-22) — role-by-role check of every menu item and admin page against the API decorators of the request that opens it (15 seeded roles):
- Found "menu shows, API returns 403": TECHNICIAN Assets / Inspections / Preventive Maintenance; SECURITY_OFFICER Fleet; SECURITY_OFFICER and INVENTORY_KEEPER My requests; ADMIN Bulk imports; plus legacy roles (OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR, MECHANIC, DRIVER, FACILITY_MANAGER, FLEET_MANAGER) on assets, inventory, reliability, organization, work orders, inspections.
- apps/web/lib/nav-api-gates.ts (generated from the decorator route inventory) holds @Roles/@Permissions for the request behind 27 menu items and 31 admin pages; isNavigationItemVisible and canAccessNavigationPath apply it. After the change: 0 "shown but 403" for all 15 roles.
- apps/api/test/nav-api-gates.spec.ts reads the real controller decorators and fails if a gate drifts (passes with fast and full ts-jest).
- API alias added (guard + web copy): maintenance_requests.view_own <- maintenance_requests.create, so anyone who may raise a request can list and open their own. The service already limits non-view_all users to reportedById = self.
- Owner decision still open: technicians are in @Roles for inspection start/complete/evidence, but the seeded TECHNICIAN role has no planning.view / planning.manage, so technicians cannot run inspections. The menu now hides Inspections/PM for them instead of showing a 403 page.
- Gates: web tsc 0, web unit 373/373, API Jest parity + guard + maintenance-requests 63 passed, nav-api-gates 1 passed.
