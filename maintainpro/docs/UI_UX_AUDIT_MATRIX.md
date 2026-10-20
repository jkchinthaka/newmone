# MaintainPro UI/UX audit matrix

Baseline inspected: `main` `4d394657` (merge of PR #75). Implementation branch: `fix/ux-confirmed-defects`.

Route classes below are for the web App Router. Retired and legacy routes are not redesign targets.

## Confirmed defects

| ID | Route | Status | Before | After | Evidence |
| --- | --- | --- | --- | --- | --- |
| UX-01 | `/maintenance/jobs` drawer | Checked in the browser | Escape did not close the drawer | Escape closes the drawer and returns focus to the row. A nested dialog or a consumed picker key does not close it. | Browser: Escape hid the dialog and focus was `Open WO-2026-0073`. Unit tests in `overlay-dismiss.test.ts`. |
| UX-02 | `/assets` | Checked at 390×844 | Previous and Next were icon-only | Buttons are named Previous page and Next page. Page numbers expose `Page N`. | Browser found both names. |
| UX-03 | `/maintenance/jobs` | Checked in the browser | Heading said All Jobs while navigation and breadcrumbs say Work Orders | Page heading is Work Orders. Route is unchanged. | Browser `h1` was Work Orders. |
| UX-04 | `/notifications` | Checked in the browser | Open context linked back to the inbox | Inbox targets render the text No linked record. Real work-order, gate, and plan links stay links. | Browser: 0 self-links. Unit tests cover real destinations. |
| UX-05 | `/action-center` | Checked in the browser | Breadcrumb Home plus heading Home | The page keeps one Home heading. | Browser: 1 Home heading, 0 breadcrumbs. |
| UX-06 | `/system-health` | Blocked | Page is SUPER_ADMIN. Detailed readiness API still allows ADMIN. | Not changed. Needs an owner decision before any access change. | Recorded only |
| UX-07 | Administration nav | Open | Many admin destinations are visible at once. | Not changed in this stage. | |
| UX-08 | Empty states | Open | More than one empty-state pattern exists. | Shared `EmptyState` stays the default. No broad rewrite. | |
| UX-09 | All single-crumb pages | Checked in the browser | A one-item breadcrumb repeated the page name beside the h1 | `Breadcrumbs` renders only when there are two or more items. `/requests/new` still shows Requests → Report Issue. | Browser: Assets had 0 breadcrumbs; Report Issue had 1. |
| UX-10 | `/fleet/gate` | Checked in the browser | An unavailable vehicle stayed on Readiness Checking… | Readiness says Unavailable unless the movement is a gate-out that is still loading block reasons. Gate out is still not offered. | Browser panel for MH-01-AB-101: Readiness Unavailable, and the status cannot gate in or out. |
| UX-11 | Mobile shell and work-order tabs | Checked at 390×844 | Bottom nav active item had no current marker. Later drawer tabs sat outside the viewport. | The active quick-nav link sets `aria-current="page"`. The selected work-order tab scrolls into view. | Browser: Work Orders `aria-current=page`. Audit tab had a box. |
| UX-12 | `/maintenance/jobs` queues | Checked at 1440, 768, and 390 | Unassigned and High Priority sat in More. The selected queue had no explanation. | Those two queues are on the primary row. The selected queue shows a sentence that matches the API rule. URL `queue=` is unchanged. | Browser kept `queue=overdue` and showed “Jobs past their due date.” Unassigned and High Priority tabs were present. |
| UX-13 | `/maintenance/plans` | Checked at 1440, 768, and 390 | Active, Due soon, Overdue, and Needs attention were counts without a definition. | The selected summary states what the API filters. Overdue means an active plan whose next due date has passed. | Browser: `due=overdue` kept the Overdue button pressed and showed that sentence. |
| UX-14 | `/requests?view=triage` | Checked at 1440, 768, and 390 | The triage status rule was only a tooltip on a disabled filter. | The page states New, Under Review, and Needs Information, and that accepted requests stay on All requests. | Browser kept `view=triage` and showed that sentence. |
| UX-15 | `/assets` | Checked at 1440 and 390 | The phone view only had a wide table. | Below the `md` breakpoint each asset is a card with tag, status, and next action. The card opens the same detail drawer. The desktop table remains. | 390 opened the drawer from a card. 1440 showed the Asset registry table. |
| UX-16 | `/inventory` | Checked at 1440, 768, and 390 | Quantity totals were one line. Reserved and Advisory were hidden on a phone. | Six labeled totals, plus the caption that advisory available is the ERP snapshot minus reservations and that Bileeta remains the stock authority. A phone card shows snapshot, reserved, and advisory and selects the same part. The table stays from the `md` breakpoint, with Advisory visible there. | Browser: six labels and the Bileeta caption at all three widths. `?part=` opened the existing detail at 1440 and 390. The phone table had no box and page overflow was 0. The 768 Advisory column was visible. Export was not used. |
| UX-17 | `/maintenance/costs` | Checked at 1440, 768, and 390 | The phone card showed only the period total. | The phone card also shows parts, labour, and services from the same job payload. The table remains from `md`. | Browser: phone line “Parts … Labour … Services …”, table visible at 1440 and 768, page overflow 0. Lifetime comparison opened from a work-order button. Export was not used. |
| UX-18 | `/reports` | Checked at 1440 | The operations completion-rate sentence was shown on every report category. | That sentence renders only for the Work orders category. | Browser: the sentence was present on `module=operations` and absent after switching to Financial. No export and no template save. |
| UX-19 | `/notifications` | Checked at 1440, 768, and 390 | Row actions were 32px tall and the phone search field stayed narrow. | Search fills the phone width. Open, Mark read, and Acknowledge are at least 44px. A linked row uses the existing next-action label. | Browser: action height 44 at all three widths. Phone search width 348. Overflow 0. The loaded rows said “No linked record”. Mark read was not clicked. |
| UX-20 | `/fleet/gate` | Checked at 390 and 1440 | The phone view was a wide table, and the gate action sat below the list. | Phone cards select the vehicle. The action panel is first on small screens and stays on the right from `lg`. The table remains from `md`. | Browser: 390 card selected an unavailable vehicle, the action panel was above the card, the table had no box, Gate out was not shown and was not clicked, overflow 0. 1440 table was visible. |
| UX-21 | `/settings` | Checked at 390 and 1440 | Section tabs were short, and the title did not use the page title style. | Tabs are at least 44px and keep `?tab=`. The title uses the shared page title. | Browser: Security tab height 44. Keyboard Enter opened `?tab=security`. Notifications stayed `aria-selected=true` before that. No save. |
| UX-22 | `/admin` | Checked at 1440, 768, and 390 as admin | Administration totals were one pipe-separated line. Quick actions were 36px. | Totals are five labeled figures. Quick actions and module links are at least 44px. | Browser: Users, Tenants, Open critical, Overdue jobs, and Data issues at all three widths. Invite User height 44. Overflow 0. No invite was submitted. |
| UX-23 | `/maintenance/jobs` create | Checked at 1440 and 390 | The create button was 40px. | The button is 44px. Escape still closes the drawer. | Browser: Create Work Order height 44. The drawer showed “Create an open job”, filled the viewport, overflow 0, and closed on Escape. Nothing was saved. |
| UX-24 | `/work-orders/my` | Checked at 1440, 768, and 390 as admin, and at 390 as technician | My Jobs tabs showed counts without saying which assigned jobs they include. | The selected tab states the existing assigned-job rule. `filter=` is unchanged. | Browser: Active sentence, then Overdue stayed selected with `filter=overdue` and the past-due sentence. Focus stayed on the tab. Overflow 0. Start work was not used. Technician waiting-parts kept `filter=waiting-parts`. |
| UX-25 | `/inventory` freshness | Checked at 1440, 768, 390, and 320 | Cards showed quantities without when the row was last touched. | A row shows the latest movement time, or the part record time when no movement is loaded. It does not claim an ERP sync time. | Browser: “Record updated …” was visible at all four widths. Overflow 0. No stock write. |
| UX-26 | `/notifications` quick filters | Checked at 390 | Unread and Critical were only in the filter form. Mark read had no in-progress label. | Unread and Critical are pressed toggles. The buttons say Marking read… or Acknowledging… while a request is in flight. | Browser: Unread `aria-pressed=true` and `status=UNREAD`. Mark read was not clicked. Overflow 0. |
| UX-27 | `/fleet/gate` meter | Checked at 390 | A bad meter reading was text only, without an invalid field state. | The meter field sets `aria-invalid` and points at the existing error. Gate out stays disabled for that error. | Browser: “Meter reading cannot be negative.” and `aria-invalid=true`. Gate out was visible for an eligible vehicle and was not clicked. |
| UX-28 | `/reports` freshness | Checked at 1440 | The page did not say when the numbers were loaded. | After load, the page states the time and that this is the current server result, not an accounting close. Export buttons are 44px and say Preparing export… while a download is in flight. | Browser: the loaded sentence was visible. CSV height 44. Export was not clicked. |
| UX-29 | Shared tables and `/vehicles/costs` | Checked at 1440, 768, and 390 | Enterprise queue pages used a second-level heading. Phone table cards could be clicked but not focused. | Those pages use one page title. A row with no separate actions is a keyboard button on the phone card and on the desktop row. | Browser: Vehicle costs h1 at all three widths. Table visible at 1440 and 768. At 390 the table had no box, Enter selected a card, overflow 0. No cost or purchase action was submitted. |
| UX-30 | Shared controls and `/vehicles` | Checked at 1440, 768, 390, and 320 | Shared buttons were 40px and had no focus outline. Motion had no reduced-motion path. Vehicle status chips were smaller than 44px. | Shared buttons and fields are at least 44px and show a 2px outline on focus. Reduced motion shortens CSS motion and sets the work-order drawer duration to 0. Vehicle status chips are 44px. | Browser: Unread height 44, outline solid, offset 2px. Create drawer opened and Escape closed it under reduced motion. Vehicle chips 44px and overflow 0 at four widths. No vehicle status was saved. |

## Active core

`/login`, `/action-center`, `/maintenance/jobs`, `/work-orders`, `/work-orders/my`, `/requests`, `/requests/new`, `/maintenance/plans`, `/assets`, `/fleet`, `/fleet/gate`, `/inventory`, `/notifications`, `/reports`, `/settings`.

## Active support

Administration users, roles, organization, maintenance costs, vendor eligibility, and the report subsections linked from the manager home. These stay on their current APIs.

## Legacy compatibility

Legacy FMS routes guarded by `legacy-fms-route-guard.tsx`. Keep the deep links. Do not redesign them as primary navigation.

## Placeholder and retired

Dynamic templates that have no create flow in this stage stay as they are. The removed Flutter app is retired and must not return.

## Not claimed

WCAG conformance, Core Web Vitals, and pilot task-success rates are not marked passed.
