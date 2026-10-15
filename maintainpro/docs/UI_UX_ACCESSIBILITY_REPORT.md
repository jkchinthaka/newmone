# MaintainPro accessibility report

Date: 2026-10-12. This is not a WCAG 2.2 AA conformance claim. Axe checks a tagged rule set. It does not replace a screen-reader pass.

## Automated axe, 2026-10-11

Tool: axe-core 4.10.3, loaded from a temporary folder outside the repository. It was not added as a project dependency. Signed in as `admin@maintainpro.local`. Rule tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

Before the fixes, the same scan reported:

- `color-contrast` on the notification count: white `#ffffff` on rose-500 `#f43f5e`, ratio 3.67.
- `color-contrast` on muted copy: slate-500 `#64748b` on brand-50 `#eaf5ed`, ratio 4.26.
- `color-contrast` on the Action Center N/A figure: amber-600 `#d97706` on white, ratio 3.19.
- `select-name` on the Assets rows-per-page control.
- `aria-required-children` on the Reports tab list, which also contained the saved-report select and the module link.

After the fixes, the same 15 URLs were clean at 1440×900, 768×1024, 390×844, and 320×844. That is 60 scans and 0 violations.

Fixes: the count uses rose-700; muted text inside `main` uses `#475569` (6.78:1 on brand-50); the N/A figure uses amber-800; the Assets select is named “Rows per page”; the saved-report select and module link sit outside the tab list.

## Checked in the browser on 2026-10-11

- Shared `.btn-primary`, `.btn-quiet`, and `.field` controls use a 44px minimum and a 2px focus outline. The Notifications Unread control measured 44px with `outline-style: solid` and a 2px offset.
- With `prefers-reduced-motion: reduce`, the work-order create drawer still opened and Escape closed it. Framer Motion duration is 0 in that mode. CSS animations and transitions are shortened by the same media query.
- Vehicle status filters are 44px at 1440, 768, 390, and 320. Page overflow was 0. The status select that writes a vehicle status was not used.
- Vehicle cost phone cards accept Enter. Data-table tests: 2 passed.

## Earlier local checks

- Work-order drawer: Escape dismisses the top layer and focus returns to the opener. Nested `alertdialog` / `dialog` and an open entity picker consume Escape first.
- Asset pagination: Previous page, Next page, and Page N names.
- Home: one visible Home heading instead of a repeated breadcrumb.
- Notifications: a non-link is used when there is no record to open.
- Gate meter: `aria-invalid` and a described error for a negative reading. Gate out was not submitted.

## Manual checks, 2026-10-11

- Create Work Order: 40 Tab presses stayed inside the dialog. Escape closed it and returned focus to Create Work Order.
- An existing work order: keyboard selected the Assignment tab, 12 further Tabs stayed inside, and Escape closed the dialog.
- Shift+Tab from the first control inside Create Work Order wrapped to Cancel and stayed in the dialog.
- Work Orders at root font size 32px (200% text): page overflow 0 after the filter row was allowed to wrap. CSS zoom 200% on that page also had overflow 0. CSS zoom 400% on a 1440 viewport overflowed; that is not the same as a 320px layout viewport, which was already overflow 0.
- Screen reader: NOT TESTED. No screen reader was driven in this session.
- The work-order form error already uses `role="alert"`. The gate meter error is associated with `aria-describedby` inside an `aria-live="polite"` region. Those were inspected, not heard.

## Additional signed-in routes, 2026-10-12

Same axe-core 4.10.3 tags. One administrator sign-in. Overflow was 0 at 1440×900, 768×1024, 390×844, and 320×844.

Clean at all four widths: `/maintenance/jobs/service` (Service Jobs), `/maintenance/jobs/vehicle` (Vehicle Jobs), `/requests/new` (Report Issue), `/maintenance/reliability` (Reliability).

Defects found and fixed:

- Selected queue count: white on blended green `#458961`, ratio 4.19. The selected chip is now white with `text-brand-900`.
- Vendor Eligibility: the Expiring-soon control was inside the tab list, and a vendor button could have an empty accessible name. The control sits outside the tab list, and the button name falls back to the vendor code or “Open vendor”.

Post-fix recheck that was actually run: Machinery Jobs at 768, 390, and 320, Vendor Eligibility at 1440, 768, 390, and 320, and Work Orders at 1440 were clean. Overflow was 0. The first keyboard stop was Skip to content, with a solid outline. The sampled 28 routes now have four-viewport axe coverage. This is not WCAG 2.2 AA conformance.

Organization (`/admin/organization`, heading Organization & Locations) and Maintenance Supply (`/maintenance-supply`) were also clean at 1440, 768, 390, and 320, with overflow 0. System Health was not included.

The new-request form was not submitted. No vendor was blocked. No organization or supply record was saved.

## Still required

Screen-reader pass. A 400% browser-zoom pass that changes the layout viewport, separate from the 320px reflow check already recorded. A clean axe scan does not close WCAG 2.2 AA.

## Blocker

UX-06 System Health UI and readiness API roles differ. No permission change was made.
