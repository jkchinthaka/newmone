# MaintainPro role workflow report

Date: 2026-10-11. No new role was added. No permission was widened.

| Role | Existing emphasis | This change |
| --- | --- | --- |
| Technician | My Jobs | Signed in as `tech@maintainpro.local`. Login 200. `/admin` returned Home. No System Health link. Waiting-parts filter stayed on My Jobs. Start was not used. |
| Manager | Work orders and reports | Signed in as `manager@maintainpro.local`. Login 200. `/admin` returned Home. No System Health link. |
| Storekeeper | Inventory snapshot | Signed in as `inventory@maintainpro.local`. Login succeeded. `/inventory` showed Inventory Control Center. `/admin` returned Home with `reason=access_denied`. No System Health link. Stock issue and export were not used. |
| Security officer / gate | Fleet gate | Signed in as `security@maintainpro.local`. Login succeeded. `/fleet/gate` showed Fleet Gate Operations. `/admin` returned Home with `reason=access_denied`. No System Health link. Gate in and gate out were not submitted. |
| Supervisor | Unassigned and approvals | Signed in as `supervisor@maintainpro.local`. Login succeeded. `/requests` showed Maintenance Requests. `/admin` returned Home with `reason=access_denied`. No System Health link. Approval actions were not submitted. |
| Super admin | System Health page | UX-06 left unchanged pending an owner decision |

Pilot targets, not results: at least 95% success on a later scripted task set, zero critical user errors, recorded time and hesitation, and role-specific satisfaction notes.

## Read-only task opens on 2026-10-11

No gate movement, stock issue, approval, PM pause, or work-order start was submitted.

| Account | URL kept | Heading |
| --- | --- | --- |
| `tech@maintainpro.local` | `/work-orders/my?filter=overdue` | My Jobs |
| `supervisor@maintainpro.local` | `/requests?view=triage` | Maintenance Requests |
| `manager@maintainpro.local` | `/maintenance/plans?due=overdue` | Preventive Maintenance |
| `inventory@maintainpro.local` | `/inventory` | Inventory Control Center |
| `security@maintainpro.local` | `/fleet/gate` | Fleet Gate Operations |

## UX-06 System Health decision, not implemented

The page and primary navigation allow `SUPER_ADMIN` only (`navigation.ts` and `settingsAdminShortcuts`). `GET /health/readiness` and `GET /health/deployment-readiness` allow `ADMIN` and `SUPER_ADMIN` (`health.controller.ts`). Public probes `GET /health`, `/health/live`, and `/health/ready` stay separate and were not changed.

| Option | Meaning | Security implication | Tests required before any change |
| --- | --- | --- | --- |
| SUPER_ADMIN only | Narrow the readiness API to match the page | Administrators lose the detailed dependency payload. Public liveness and minimal readiness stay available to probes | API role test that ADMIN receives 403 on `/health/readiness` and `/health/deployment-readiness`, and that `/health/ready` still answers without a session |
| ADMIN and SUPER_ADMIN | Show the page to the roles the API already allows | Administrators see provider and dependency detail that the UI currently hides | Web navigation test that ADMIN sees the link, plus a browser check that other roles still do not |
| Monitoring service | Keep the detailed payload off the user page and give it only to an authenticated probe | Avoids widening the page. Needs a dedicated credential or network control, which this UI change does not add | Probe authentication test, and a test that the user page stays SUPER_ADMIN-only |

No option is approved. Do not change either side until the product owner picks one.

A later administrator login for Settings returned HTTP 429 from the login endpoint. On 2026-10-12 an administrator session did sign in. Notification pages 1 and 2 each showed 20 “No linked record” labels and no context link, so the linked-record navigation was NOT TESTED. No notification was marked read. The same administrator session opened Machinery Jobs, Service Jobs, Vehicle Jobs, Report Issue, Reliability, and Vendor Eligibility. A later administrator session opened Organization & Locations and Maintenance Supply. No request was submitted, no vendor was blocked, and no organization or supply record was saved. System Health authorization was not changed. `/system-health` remains the only primary-nav href outside this axe sample.
