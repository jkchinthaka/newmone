# MaintainPro UI/UX redesign roadmap

Branch `fix/ux-confirmed-defects` from `4d394657`.

| Stage | Scope | State |
| --- | --- | --- |
| 01 Baseline | Git, handover, screenshot evidence | Done for this session. `main` matches `origin/main` at `4d394657`. |
| 02 Standards | `UI_UX_STANDARDS_2026.md` and this roadmap | Done |
| 03 Confirmed defects | UX-01 through UX-05 | Implemented locally. UX-06 blocked on an access-policy decision. |
| 04 Navigation consistency | Single-item breadcrumbs hidden. Mobile quick nav marks the current page. | Locally verified. Not committed. |
| 08 Fleet gate status | Unavailable vehicles no longer stay on Checking. | Locally verified. Gate rules unchanged. |
| 05 Work order queues | Unassigned and High Priority are primary tabs. The selected queue explains its count. | Locally verified at 1440, 768, and 390. Not committed. |
| 05 My Jobs | The selected assigned-job tab states which jobs it includes. | Locally verified at 1440, 768, and 390. Start was not used. |
| 06 PM summaries | Due soon, Overdue, Active, and Needs attention describe the API filter. | Locally verified at 1440, 768, and 390. Scheduler behavior unchanged. |
| 06 Requests | The triage queue explains which statuses it includes. | Locally verified at 1440, 768, and 390. |
| 07 Assets | Phone asset cards open the existing detail drawer. | Locally verified at 390. Desktop table verified at 1440. |
| 07 Inventory | Snapshot totals name ERP, reserved, and advisory quantities. Phone cards show the same three figures. Rows show movement or record time, not an invented ERP sync time. | Locally verified, including 320px. No stock write. |
| 10 Notifications | Phone search is full width. Unread and Critical are quick toggles. Row actions are 44px. | Locally verified. Mark read was not used. |
| 08 Fleet gate mobile | Phone cards select a vehicle. A negative meter is marked invalid. The action panel is above the list on small screens. | Locally verified. Gate out was not submitted. |
| 09 Reports and costs | Phone cost cards show parts, labour, and services. Reports state when they were loaded and that they are not an accounting close. | Locally verified. No export. |
| 11 Settings | Settings tabs meet 44px and the title uses the shared page title. | Locally verified. No save. System Health access unchanged. |
| 11 Administration | Admin totals are labeled. Quick actions are 44px. | Locally verified at 1440, 768, and 390. No invite. |
| 12 Shared tables | Enterprise queues use a page title. Phone cards without separate actions accept Enter. | Locally verified on Vehicle costs at 1440, 768, and 390. |
| 13–15 Responsive, accessibility, role testing | Overflow on the checked routes was 0. Manager and technician logins returned 200 and were sent from `/admin` back to Home. Neither had a System Health link. Create drawer closed with Escape. Vehicle cost phone cards accept Enter. | Not a full WCAG pass. Human UAT is still open. |
| 16 Release readiness | qa-reviewer and GitHub gates | Not a release |

Next independent work stays blocked for release by the unpaid qa-reviewer invoice. UX-06 stays blocked. Do not commit this branch until an independent review can return PASS.
