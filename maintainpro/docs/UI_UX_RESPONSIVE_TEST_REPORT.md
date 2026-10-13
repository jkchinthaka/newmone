# MaintainPro responsive test report

Date: 2026-10-12.

## Existing evidence

Pass 2 screenshots, taken before this branch, show settled desktop, tablet, and mobile states for Home, Work Orders, My Jobs, Requests, PM Plans, Assets, Fleet, Fleet Gate, Inventory, Notifications, Reports, and Settings, plus several drawers. Those images are the pre-change baseline. They are not stored in git.

Viewports used then: 1440×900, 768×1024, 390×844.

## This branch

Overflow was 0 on the routes measured at 1440×900, 768×1024, and 390×844: notifications, gate, settings, inventory, costs, reports, admin, work orders, PM, requests, assets, My Jobs, and vehicle costs. Inventory and vehicle status filters were also 0 at 320×700. Vehicle costs hid the table at 390 and kept the card list. Screenshots for the later checks are in `maintainpro/.tmp-e2e-artifacts/ux-continue/` and are not committed.

This is not a measurement of field Core Web Vitals. Local lab timing is in `UI_UX_FINAL_VALIDATION.md`.

## 2026-10-11 text size and Fleet

Work Orders at a 32px root font (200% text) overflowed until the filter row could wrap. Recheck overflow was 0. Fleet at 390 overflowed by 51px, and at 320 by 121px, because the section tabs and table expanded the page. Those regions use paint containment. The last Fleet section tab stayed visible after scrolling at 320. The actions control stayed inside the results area, its focus outline was a solid 2px, and the menu link had a measurable box. Page overflow stayed 0 at 1440, 768, 390, 320, and 200% text. Maintenance home, Approvals, History, Planning, Inspections, and ERP were overflow 0 at 768, 390, and 320.

Signed in as admin. Overflow was 0 at 768×1024 and 390×844 on all 15 pilot URLs, and at 320×844 on Home, Assets, Notifications, Reports, Fleet Gate, and Work Orders. Axe on all 15 URLs was clean at 1440, 768, 390, and 320 after the contrast and name fixes.

On 2026-10-12, Machinery Jobs, Service Jobs, Vehicle Jobs, Report Issue, Reliability, and Vendor Eligibility were overflow 0 at 1440, 768, 390, and 320. The four widths that still needed a post-fix axe scan were re-run and were clean. Organization and Maintenance Supply were also overflow 0 and axe-clean at those four widths. Screenshots are in `maintainpro/.tmp-e2e-artifacts/ux-continue/` and are not committed.
