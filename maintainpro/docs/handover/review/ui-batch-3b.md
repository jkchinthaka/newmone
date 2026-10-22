# ui/pages-batch-3b

UI-only restyle of Work Orders, Approvals, Fleet, and Spare Parts on `origin/develop`. No API, DTO, RBAC, schema, or workflow changes.
Hidden because the payload does not support them: Closed this week; oldest-unassigned age unless that queue page is complete; vendor name and quotation lines; engine hours and revenue licence; service, document, and gate badges when those fields are absent.
Part requests to issue stays hidden: there is no tenant-wide request list, and issue remains on the work order.
Most used parts (30 days) renders only when `GET /inventory/analytics/top-used` returns rows for a role allowed to call it. This database returned none, so the panel stayed hidden.
Manager `/approvals` still redirects to `/maintenance`. Navigation requires `approvals.view`, and that gate was not changed.
Web `tsc --noEmit` exit 0. Web unit 375 passed. Playwright `signed-in-responsive.spec.ts` 3 passed and `batch-3b-visual.spec.ts` 2 passed on 3053 against `maintainpro_e2e_wo_verify`. Overflow 0. No page console errors after sign-in.
Screenshots: `docs/handover/ui-redesign/batch-3b/` (admin and manager, 390 and 1440). Before shots remain in `docs/handover/ui-redesign/batch-3/`.
Temporary API 3052 and web 3053 were stopped. Ports 3040 and 3041 were left running.
Diff: `docs/handover/review/ui-batch-3b.diff`.

Follow-up (Claude, 2026-10-22): the Open card hides "N need assignment" when that summary count is above the Open value (26 vs 27 seen in review). KPI cards fill the grid row height, so cards with and without a sub-line align. Fleet hides Next service / Documents / Gate columns when no row on the page has data, and shows "—" per row otherwise. Web tsc 0, web unit 377/377. Screenshots were not re-taken in this follow-up.
