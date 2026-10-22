web-permission-aliases (Claude, 2026-10-22), branch fix/web-permission-aliases from origin/develop 658ae0c2.
Bug: MANAGER is an approver, but the web nav/route guard required the literal key approvals.view. The API accepts work_orders.manage as an alias, so MANAGER was redirected from /approvals to /maintenance.
Fix: apps/web/lib/permission-aliases.ts holds the same alias map and rule as the API guard (including the SUPERVISOR work_orders.verify exception). isNavigationItemVisible uses it, which covers the sidebar, route guard, command palette and landing.
No API change. The API guard and its alias map are untouched (keeps feat/access-studio merge clean).
Nav items whose visibility can change: /approvals (approvals.view <- approvals.decide, approvals.rule.manage, work_orders.manage), /requests and /requests/mine (facility_issues / cleaning aliases). Each matches what the API already allows.
apps/api/test/permission-aliases-parity.spec.ts compares the web copy with the API guard for every catalog key x single granted key x role (MANAGER, SUPERVISOR, none): 0 mismatches. Drift fails CI.
apps/web/lib/__tests__/permission-aliases.test.ts: MANAGER sees and opens /approvals; roles without the key or an alias still cannot.
Gates (cloud checkout): API tsc 0, web tsc 0, web unit 370/370, API Jest parity + permissions.guard 19/19 (fast) and parity 1/1 (full ts-jest), audit:rbac 0, audit:tenant 0.
Not run here: browser check as manager on 3041; DB tests.
