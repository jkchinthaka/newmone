# MaintainPro UX regression test report

Date: 2026-10-11. Branch `fix/ux-confirmed-defects`.

## Planned commands

- `npx tsx --test lib/__tests__/notification-inbox.test.ts lib/__tests__/overlay-dismiss.test.ts lib/__tests__/breadcrumbs.test.ts` from `apps/web`
- Web `npx tsc --noEmit`

## Results on 2026-10-11

- Targeted tests on 2026-10-11, second run including gate readiness: 10 passed, 0 failed.
- Web `tsc --noEmit`: exit 0.
- Browser: Assets has no single-item breadcrumb; Report Issue keeps its two-item trail; MH-01-AB-101 readiness is Unavailable and cannot gate; at 390 the Work Orders quick-nav item is `aria-current=page` and the Audit tab is in view.
- Inventory on 2026-10-11: `npx tsx --test lib/__tests__/inventory-control.test.ts` from `apps/web` — 2 passed, 0 failed. Web `tsc --noEmit` exit 0. Browser at 1440, 768, and 390 showed the six summary labels and the Bileeta caption. Part selection kept `?part=` at 1440 and 390 and showed the existing “not a second stock ledger” sentence. At 390 the table had no box, the card line was 314px wide, and page overflow was 0. At 768 the Advisory column was visible. Export was not clicked. One login returned HTTP 502 while the API restarted; the retry login returned 200.
- Costs and reports on 2026-10-11: `npx tsx --test lib/__tests__/report-workspace.test.ts` — 3 passed, 0 failed. Web `tsc --noEmit` exit 0. Maintenance costs at 390 showed parts, labour, and services; the table was visible at 1440 and 768; page overflow was 0. Reports showed the completion-rate sentence on Work orders and hid it on Financial. Export and template save were not used.
- Notifications, gate, and settings on 2026-10-11: `notification-inbox` and `gate-operations` — 7 passed, 0 failed. Web `tsc --noEmit` exit 0. Notification actions were 44px at 1440, 768, and 390; phone search width was 348; overflow 0; Mark read was not clicked. Gate at 390 selected an unavailable vehicle from a card, the action panel was above the list, the table had no box, and Gate out was not shown. Settings Security tab was 44px; Enter opened `?tab=security`; no save. Overflow was 0 on 11 routes at 1440, 768, and 390: notifications, gate, settings, inventory, costs, reports, admin, work orders, PM, requests, and assets.
- Administration and roles on 2026-10-11: Web `tsc --noEmit` exit 0. Admin login 200. Summary labels and a 44px Invite User link at 1440, 768, and 390; overflow 0. `manager@maintainpro.local` and `tech@maintainpro.local` login 200, no System Health link, and `/admin` returned them to Home. Create Work Order was 44px at 1440 and 390; Escape closed “Create an open job” with overflow 0. No work order was saved.
- My Jobs on 2026-10-11: `npx tsx --test lib/__tests__/my-job-filters.test.ts` — 3 passed, 0 failed. Web `tsc --noEmit` exit 0. Admin at 1440, 768, and 390: Active purpose, then Overdue `aria-selected=true`, `filter=overdue`, focus on the tab, overflow 0, Start work count 0. Technician at 390 kept `filter=waiting-parts` and the parts sentence.
- Freshness and filters on 2026-10-11: inventory-control and gate-operations — 7 passed, 0 failed. Web `tsc --noEmit` exit 0. Inventory “Record updated …” visible at 1440, 768, 390, and 320; overflow 0. Notifications Unread pressed with `status=UNREAD`; Mark read not clicked. Gate meter `aria-invalid=true` with “Meter reading cannot be negative.”; Gate out not clicked. Reports showed the loaded-time sentence; CSV height 44; export not clicked. Screenshots: `maintainpro/.tmp-e2e-artifacts/ux-continue/`.
- Shared tables on 2026-10-11: `npx tsx --test lib/__tests__/data-table-mobile.test.ts` — 2 passed, 0 failed. Web `tsc --noEmit` exit 0. Vehicle costs h1 at 1440, 768, and 390. Table visible at 1440 and 768. At 390 Enter selected a phone card and overflow was 0. No purchase or cost write.

- 2026-10-12: `npx tsx --test lib/__tests__/*.test.ts` from `apps/web` — 213 passed, 0 failed. `npx tsc --noEmit` exit 0 after the vendor tab-list and queue-count fixes, and again after the four-width closure with no further source change. Isolated `npx next build` in a temp worktree exited 0 into `.next-isolated`. A later hash comparison showed that worktree already contained the current web UX files, so it was not rebuilt. The live dev `.next` timestamp did not change. Port 3011 `/login` stayed 200. Playwright on 3011: 6 passed (four login-page checks and two unauthenticated redirects). Mutating Playwright specs and API Jest were not run. No shared database write.

qa-reviewer stopped on an unpaid invoice. QA REVIEWER = EXTERNALLY BLOCKED — BILLING / UNAVAILABLE. That is not a PASS.

## Protected behavior

- Notification deep links to work orders, gate, and PM plans stay links.
- Asset page size and page index behavior is unchanged.
- Work order create and save handlers are unchanged.
- System Health authorization is unchanged.
- Bileeta remains the stock authority. Inventory quantities are display-only in this change.
