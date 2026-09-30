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
| P2 | 0 | 0 | 0 |
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
| --- | --- | --- | --- |
| BH-06 | Navigation guard | P2 | Fixed |
| BH-07 | Work order list | P2 | Fixed |

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

## Walk coverage

Super admin, manager, mechanic, and cleaner were signed in. Widths 1440, 1024, 820, and 390 were checked for the main lists. No horizontal overflow was recorded. Live Map stayed 404 for every role. Manager and mechanic were sent away from Administration. Mechanic and cleaner were sent away from Reports. Cleaner was also sent away from inventory and assets. Exceptions, work orders, and parts returned 200 for the super admin and the expected 403 for the cleaner.

Forms, double-submit, concurrent edits, finance, supervisor, and inventory-keeper sessions were not exercised.

## Status

The hunt is **not complete**. BH-06 and BH-07 are fixed. A full form, concurrency, and remaining-role pass is still open. Do not merge this branch to main yet.


