# Functional verification matrix

Date: 2026-10-13. Scope: integration rehearsal `rehearsal/three-workstream-20261012` at HEAD `4d394657`, uncommitted. Seeded admin session on port 3022. Read-only. No approvals, cancellations, assignments, inventory issues, fleet-gate moves, or permission changes. Independent qa-reviewer was not run.

Statuses are evidence-backed. A rendered page is not end-to-end. An API response alone is not end-to-end.

| Module | Function | Role | Frontend | API | Database | Actual test | Status | Evidence | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| System health | Readiness | public | `/health/readiness` | health controller | SQL Server | HTTP readiness | VERIFIED READ-ONLY | Database status `ready`. Overall status was `degraded` on the last earlier check. | Human UAT of the degraded checks |
| Authentication | Existing session | ADMIN | port 3022 | `/auth/me` | users | Opened `/maintenance` while already signed in | VERIFIED READ-ONLY | Page showed `admin@maintainpro.local · ADMIN`. No new login | Do not retry login if 429/503 |
| Navigation | Full sidebar | ADMIN | `nav-links.tsx` | none | none | Desktop sidebar text | VERIFIED READ-ONLY | Groups include Maintenance through Account. No Simplified navigation, Full navigation mode, or Maintenance Forecast. Preventive Maintenance present | Other roles not rechecked this pass |
| Navigation | Mobile shell | ADMIN | bottom bar | none | none | 390px layout | VERIFIED READ-ONLY | Open navigation menu and bottom bar Work Orders, Search, Profile. Drawer open blocked by the work-order panel | Close the panel and recheck the drawer |
| Maintenance Forecast | Retired page | ADMIN | `/maintenance/forecast` | forecast API kept | tables kept | Opened the route | INTENTIONALLY DISABLED | Browser left for `/maintenance/plans`. Nav item absent. Jest navigation 28 passed | Unauthorized role should see Page unavailable |
| Preventive Maintenance | Schedule page | ADMIN | `/maintenance/plans` | plans API | PM tables | Redirect landed on the page heading | VERIFIED READ-ONLY | Heading `Preventive Maintenance`. No schedule create | Human UAT of PM generation |
| Maintenance dashboard | Queue counts | ADMIN | `/maintenance` | dashboard | work orders | Read the page | VERIFIED READ-ONLY | Overdue 71, Unassigned 71, Verification 8, Waiting for Parts 4, and a priority table | Confirm counts against a filtered list |
| Requests | List | ADMIN | `/requests` | requests list | requests | Read the page | VERIFIED READ-ONLY | 34 requests, status cards, filters | Do not approve or cancel |
| Requests | Row actions menu | ADMIN | `ActionMenu` | none this check | none | Opened MR-2026-00034 | VERIFIED READ-ONLY | One `role=menu` at left 1156, top 309: Open request, Cancel request. Not at the top-left | Escape was pressed. Outside-click and mobile menu not rechecked |
| Work orders | Queue | ADMIN | `/maintenance/jobs` | work orders | work orders | Read action-required queue | VERIFIED READ-ONLY | 78 need action. Opened WO-2026-0073 drawer. No save | Lifecycle writes not tested |
| Workforce assignments | Designation filter | ADMIN | assignees panel | `GET /workforce/employees` | workforce employees | Assignment tab, no Add | VERIFIED READ-ONLY | Options ELECTRICIAN, HELPER, MECHANIC, SUPERVISOR, TECHNICIAN. ELECTRICIAN left only Sam Electrician. All designations restored the broader list. Add assignee stayed disabled | Empty tenant, API failure, and unauthorized roles are unit-level only |
| Reports | Retained tabs and pins | ADMIN | `/reports` | report APIs | report data | Prior session this day | VERIFIED READ-ONLY | Five retained tabs. Pin then unpin Operations. Financials hidden in UI | Export download not retested |
| Splash / Action Center | Retired entry | ADMIN | `/`, `/splash`, `/action-center` | `/auth/me` | session | Prior session this day | INTENTIONALLY DISABLED | Session left for `/admin`. Unauthenticated `/` and `/splash` were 307 `/login` | None |
| Machinery, service, vehicle jobs | Domain lists | various | sidebar links | job APIs | work orders | Not opened this pass | NOT TESTED | Sidebar links exist for admin | Read-only open per domain |
| My Jobs | Technician queue | TECHNICIAN | `/work-orders/my` | work orders | work orders | Not opened | NOT TESTED | Role map is unit-tested | Signed-in technician read |
| Assets, inventory, fleet gate, vendors | Module pages | role-specific | sidebar | domain APIs | domain tables | Not opened this pass | NOT TESTED | Admin sidebar groups exist | Read-only navigation |
| Notifications | Inbox | ADMIN | bell link | notifications | notifications | Bell visible, inbox not opened | NOT TESTED | Open notifications link rendered | Open the inbox |
| Administration / RBAC | User admin | ADMIN | `/admin` | admin APIs | users, roles | Prior landing only | NOT TESTED | Earlier session landed on `/admin` | Do not change permissions |
| ERP, email, SMS, replication | Live sync | n/a | hidden or gated | env-gated | n/a | Not executed | BLOCKED BY EXTERNAL INTEGRATION | Live sync was not approved | Do not enable |

## Fixes in this pass

1. Maintenance Forecast is removed from the sidebar. `/maintenance/forecast` and `/maintenance/planning` open Preventive Maintenance when the role can, otherwise they say the page is unavailable. Forecast APIs and PM data stay.
2. The simplified/full navigation button and its unused mode flag are gone. The sidebar is the permission-filtered full menu.
3. Request menus were duplicated because the mobile card and desktop row both stayed mounted and the hidden trigger had a zero rectangle, so one portal sat at the top-left. A zero-size trigger no longer places a menu. Desktop check showed one menu beside the row.
4. Designation options were a hardcoded list, and choosing one switched the employee request into a stricter assignment query. The panel now loads employees once and builds the filter from those records. Selecting ELECTRICIAN filtered staff. Clearing it restored the list. No assignment was saved. Server designation matching now includes the linked role when a designation query is still sent.

## Tests

- `npx tsx --test lib/__tests__/stabilization.test.ts`: 4 passed.
- Web `tsc --noEmit`: exit 0.
- `npx jest --config ./jest.config.cjs test/navigation.spec.ts --forceExit`: 28 passed.
- API `tsc` was not re-run for the workforce service change.

## Remaining

- qa-reviewer not invoked. This is not a QA PASS.
- Not committed, pushed, or merged.
- Write paths, exports, fleet gate, inventory issue, and non-admin roles remain NOT TESTED.
- Mobile request menu and mobile drawer while a work-order panel is open were not completed.
