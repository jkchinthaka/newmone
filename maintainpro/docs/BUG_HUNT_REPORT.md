# Bug hunt report

**Branch:** `qa/full-project-bug-hunt`  
**Base:** `integration/maintainpro-final-consolidation` at `8b38f37a`  
**Date:** 2026-09-30

Pull request #63 was still running, so these fixes were not pushed onto that pull request.

This pass classified the previously failing CI suites. It did not browser-walk every product screen, and it did not reset the database.

## Summary

| Severity | Found | Fixed | Left open |
| --- | ---: | ---: | ---: |
| P0 | 0 | 0 | 0 |
| P1 | 0 | 0 | 0 |
| P2 | 6 | 6 | 0 |
| P3 | 0 | 0 | 0 |
| Stale tests (not product bugs) | 8 | 8 | 0 |

Infrastructure items that are not application bugs: MinIO image pull `401`, email delivery unset, no PM background clock, Vercel and Cloudflare preview builds. Live Map, live GPS UI, Flutter, and push notifications stay retired. Live Bileeta stays deferred.

## Findings

| ID | Area | Class | Status |
| --- | --- | --- | --- |
| BH-01 | Work orders | Stale test | Fixed |
| BH-02 | Requests | Stale test | Fixed |
| BH-03 | Auth invitations | Stale test | Fixed |
| BH-04 | Part return | Stale test | Fixed |
| BH-05 | Gate out / gate in | Stale test | Fixed |

### BH-01 Work order executor count

Assigned technicians are checked with `workOrder.count`. Several mocks had no `count`, so the service threw `TypeError` or treated the caller as unassigned.

Expected: an assigned technician can move an approved job, and a pending approval still rejects the start.  
Actual before the test fix: `workOrder.count is not a function`.  
Root cause: tests written before the assignment check. Product code was already correct.  
Files: `work-orders-status-transition.spec.ts`, `work-orders-governance.spec.ts`, `work-orders-approval.spec.ts`, `work-order-d2-core.spec.ts`.

### BH-02 Inactive asset on a new request

New requests reject an asset that is missing, inactive, retired, or disposed. The fixtures omitted `isActive` and `status`, so `!asset.isActive` was true.

Expected: an active asset can be requested.  
Actual before the test fix: "Retired or inactive assets cannot be selected".  
Root cause: fixtures older than the accepted inactive-asset rule.  
File: `maintenance-requests.spec.ts`.

### BH-03 Invitation role is tenant-scoped

Accepting an invitation looks up the role by name and invitation tenant. The assertion still expected a global name-only lookup.

Expected: `{ name: ADMIN, tenantId: tenant-a }`.  
Actual: the service already passed `tenantId`.  
Root cause: stale assertion.  
File: `auth-register.spec.ts`.

### BH-04 Tool return must not move Bileeta quantity

A tool return writes a pending `WORK_ORDER_PART_RETURN` outbox row and does not call the stock engine. The test still expected `returnStock`.

Expected: outbox event `part-return:issue-9:1`, and `returnStock` is not called.  
Actual before the test fix: `domainEventOutbox.create` was missing on the mock, so the call threw.  
Root cause: the test still described the retired local-stock return.  
File: `maintenance-supply-phase09.spec.ts`.

### BH-05 Gate claim uses updateMany

Gate-out claims the vehicle with `updateMany` where status is `AVAILABLE` and the count must be 1. The HTTP fixture only mocked `update`, so the handler returned 500.

Expected: gate-out and gate-in return 201.  
Actual before the test fix: 500 because `updateMany` was undefined.  
Root cause: stale transaction mock after the overlap claim. Product code was already correct.  
File: `vehicles-phase2.http-e2e.spec.ts`.

## Tests

Re-ran the eight suites that CI had failed.

| Suite | Result |
| --- | --- |
| work-orders-status-transition | passed |
| work-orders-governance | passed |
| work-orders-approval | passed |
| work-order-d2-core | passed |
| auth-register | passed |
| maintenance-requests | passed |
| maintenance-supply-phase09 | passed |
| vehicles-phase2.http-e2e | passed |

First batch: 4 suites passed, 4 failed, 9 tests failed. After the fixture updates: the remaining 4 suites passed, 75 tests.

## Not audited in the browser on this pass

Auth cookies in a live browser, every role's menu, Action Center count equality, dashboard cards, a full work-order journey, inspections, RCA, reports exports, search, and notification mark-read. Those need a later pass on a running session. No table was dropped.

## Browser and API walk — 2026-09-30 continuation

Signed in as `superadmin@maintainpro.local` and, before that, as `cleaner@maintainpro.local`. Desktop width 1440. Sidebar measured 264px. No Live Map label.

| Page | Result |
| --- | --- |
| Action Center | Loaded for both roles. No horizontal overflow. |
| Maintenance Dashboard | Heading present. No failed API calls on the page. |
| All Jobs | Heading present. No failed API calls. |
| Machinery Jobs | Heading present. No failed API calls. |
| Maintenance Requests | Heading present. No failed API calls. |
| Assets | Registry loaded. Total assets 7. No failed API calls. |
| Fleet | Overview loaded. No Live Map. `blockedVehicles` 5 matches the "Cannot gate out" card. |
| Reports | Dashboard loaded. No failed API calls. |
| Inventory | Loaded. Page states Bileeta owns quantity. No failed API calls. |

Cleaner API checks from the browser session:

| Request | Status |
| --- | --- |
| `/api/backend/fleet/live-map` | 404 |
| `/api/backend/reports/maintenance-exceptions` | 403 |
| `/api/backend/admin/users` | 403 |
| `/api/backend/inventory/parts` | 403 |
| `/api/backend/work-orders` | 403 |

Super Admin `/api/backend/fleet/live-map` is also 404. `/api/backend/inventory/parts`, notifications, admin users, PM plans, and the maintenance dashboard returned 200.

Not yet opened in the browser: Service Jobs, Vehicle Jobs, My Jobs, sites, inspections, reliability, gate, ERP import, costs, history, administration screens, search, notification page, settings, 390/820/1024 layouts, and the other roles.

## Confirmed product defects

| ID | Area | Severity | Status |
| --- | --- | ---: | --- |
| BH-06 | Navigation guard | P2 | Fixed |
| BH-07 | Work order list | P2 | Fixed |
| BH-08 | Spare Parts navigation | P2 | Fixed |
| BH-09 | Work order create validation | P2 | Fixed |
| BH-10 | Work order create idempotency | P2 | Fixed |
| BH-11 | User delete | P2 | Fixed |

### BH-06 A cleaner could open every maintenance URL

`canAccessNavigationPath` treated any `/maintenance` path as allowed when Action Center (`home`) was visible. A cleaner therefore stayed on All Jobs while the API returned 403.

Expected: a role without work-order access is sent away from `/maintenance` and `/maintenance/jobs`.  
Actual: the jobs page rendered.  
Fix: a maintenance URL is allowed only when a visible item's own href is that path or a parent of it. Technician access to `/maintenance/jobs` stays.  
Test: `navigation.spec.ts` now expects cleaner denial. Suite passed.

### BH-07 Technicians were offered the company-wide queue

The jobs list could request `queue=all`, which the API rejects for technicians and mechanics. The page also asked `/users` for an assignee list those roles cannot read.

Expected: a technician list uses `my-tasks`, and the user directory is loaded only for roles that can assign work.  
Fix: mechanics and technicians never send `queue=all`, and `useTechnicians` stays off for everyone else.

### BH-08 Spare Parts was visible to roles the catalog rejects

`PARTS_ROLES` included supervisor and technician. `GET /inventory/parts` does not. A supervisor stayed on Inventory while every parts call returned 403. `/work-orders/my` was also allowed for any role that could see All Jobs, so an inventory keeper opened My Jobs and the API returned 403.

Expected: Spare Parts follows the catalog roles, and My Jobs follows the My Jobs item.  
Fix: Spare Parts and ERP Mapping are limited to the catalog roles (mechanics stay). The exact My Jobs path requires the My Jobs item. Vendors still include the procurement officer because that API allows them.  
Checked: supervisor `/inventory` and `/admin` land on Action Center. Inventory keeper `/work-orders/my` and `/admin` do the same. Inventory keeper `/inventory` stays. Navigation suite passed.

### BH-09 Work order create stored invalid priority, type, and odometer

Priority is a string column. The create body is not a validator class, so `NOT_A_PRIORITY`, `NOT_A_TYPE`, and a negative odometer were saved (HTTP 201).

Expected: those values are rejected before a record exists.  
Fix: `assertWorkOrderCreateShape` runs at the start of create. Recheck: all three now return 400 and create nothing.  
Test: `work-order-create-guards.spec.ts`.

### BH-10 Create stored an idempotency key but never reused it

`lastIdempotencyKey` was written on insert and never looked up. Two posts with the same key created two work orders.

Expected: the second post returns the first record.  
Fix: create returns the existing tenant row when the trimmed key already exists. The jobs page keeps one key for the open create attempt. Recheck: both responses were 201 and the ids matched. The disposable row was deleted.  
Stale `expectedVersion: 0` returned 409 and left the title unchanged. Two patches of the same version returned 200 and 409.

### BH-11 Deleting a user who had signed in returned 500

`user.delete` hit `RefreshToken_userId_fkey`, then `TenantMembership`. The API answered 500.

Expected: a user with only a session and membership can be removed. Related business records still block delete with 409 instead of 500.  
Fix: delete that user's refresh tokens and tenant memberships first, and map a remaining foreign-key failure to 409. Recheck: the disposable finance user deleted with 200.

## Role checks

| Role | Result |
| --- | --- |
| Finance | No seeded login. A disposable finance user was created, checked, and deleted. Users 403, live map 404, parts 403, purchase orders 200, exceptions 403, company work orders 403. |
| Supervisor | Live map 404, admin users 403, parts 403, exceptions 200, company work orders 200. Inventory and Administration redirect. All Jobs stays. |
| Inventory keeper | Live map 404, admin users 403, exceptions 403, parts 200, company work orders 200. My Jobs and Administration redirect. Inventory stays. |

A work-order list sent with another tenant header returned 403. An unknown work-order id returned 404. Return paths already reject protocol-relative and external targets. PM auto-create called twice returned `DUPLICATE_OPEN_WO` both times. Parallel creates with different titles created two records, which is expected.

## Still open

Forms for assets, PM plans, inspections, gate, spare parts, ERP import, and users were not fully exercised. Double-submit was not completed for request conversion, gate, part issue, ERP acknowledgement, Excel confirm, or invitations. Concurrent request conversion, PM generation, gate-out, and part acknowledgement were not raced. Service jobs, vehicle jobs, sites, inspections, reliability, gate writes, ERP import, costs, and settings were not mutation-walked. Filter, count, and search reconciliation was not rechecked. Console and network were not recorded on every remaining page. Locked-user and stale-role sessions were not run. Prisma generate, tenant audit, RBAC audit, lint, both typechecks, the full test suite, and build were not run on this pass.

## Status

The hunt is **not complete**. BH-06 through BH-11 are fixed. Do not push, do not merge to main, and do not start the performance branch.

The jobs list could request `queue=all`, which the API rejects for technicians and mechanics. The page also asked `/users` for an assignee list those roles cannot read.

Expected: a technician list uses `my-tasks`, and the user directory is loaded only for roles that can assign work.  
Fix: mechanics and technicians never send `queue=all`, and `useTechnicians` stays off for everyone else.

## Walk coverage

Super admin, manager, mechanic, and cleaner were signed in. Widths 1440, 1024, 820, and 390 were checked for the main lists. No horizontal overflow was recorded. Live Map stayed 404 for every role. Manager and mechanic were sent away from Administration. Mechanic and cleaner were sent away from Reports. Cleaner was also sent away from inventory and assets. Exceptions, work orders, and parts returned 200 for the super admin and the expected 403 for the cleaner.

Forms, double-submit, concurrent edits, finance, supervisor, and inventory-keeper sessions were started. Finance, supervisor, and inventory keeper API checks are recorded below. The remaining form and concurrency items are still open.

## Status

The hunt is **not complete**. BH-06 and BH-07 are fixed. A full form, concurrency, and remaining-role pass is still open. Do not merge this branch to main yet.


