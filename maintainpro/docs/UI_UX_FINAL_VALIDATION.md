# MaintainPro UX final validation

Date: 2026-10-12.

This branch is not release ready. The pilot URLs below were checked locally. That is not independent QA, human UAT, or production approval.

Closed locally and checked in the browser: UX-01 through UX-05 and UX-10 through UX-30. See `UI_UX_COMPLETION_MATRIX.md`.

## What each route is, and is not

| State | Result |
| --- | --- |
| Implemented on this uncommitted branch | The matrix modules except System Health and Release |
| Locally verified in a signed-in browser | 30 signed-in routes at 1440, 768, 390, and 320, including the earlier sample of 28 |
| Accessibility checked with axe | Those 30 routes are axe-clean at all four widths after the confirmed fixes, including the four scans that were previously outstanding. Not a WCAG conformance claim |
| Notification context link | Browser flow NOT TESTED. The first two inbox pages had no linked record. Unsafe external targets are rejected by unit test (3 passed). No notification row was created |
| Playwright | 6 passed, 0 failed, against port 3011 with no extra server: four login-page checks and two unauthenticated redirects. Signed-in and mutating suites not run |
| Production build | Locally verified. The isolated worktree matches the current web UX sources (0 hash mismatches). `npx next build` exit 0 into `.next-isolated`. The live `.next` timestamp did not change and port 3011 stayed up. Webpack case-path warnings are a Windows junction artifact. Not deployed and not production approved |
| Screen reader | NOT TESTED |
| Technically ready for independent review | Yes. The changeset is frozen. qa-reviewer [Review](1f748608-a49f-4c6c-94bc-ec0be0b122de) stopped on an unpaid invoice on 2026-10-12. Do not merge |
| Independently QA approved | No |
| Merged | No |
| Human UAT completed | No. Blank pack: `UI_UX_HUMAN_UAT.md` |
| Production approved | No |
| System Health | Unresolved. UX-06 unchanged |

## Lab timing, local Next dev server

These numbers are from Playwright on `http://127.0.0.1:3011`. There is no field RUM, so they are not Core Web Vitals compliance.

Second document load after a warm compile, 1440×900:

| URL | LCP | Load event | CLS |
| --- | --- | --- | --- |
| `/action-center` | 1556 ms | 812 ms | 0 |
| `/maintenance/jobs` | 1696 ms | 903 ms | 0 |
| `/inventory` | 1692 ms | 925 ms | 0 |
| `/fleet/gate` | 1204 ms | 422 ms | 0 |

The Financial report tab click changed the URL to `module=financials` in 81 ms. That is one lab click, not field INP.

Earlier first loads on the dev server included compile time and were much slower (Work Orders My Jobs 7.4 s, Assets 6.0 s, Notifications 5.6 s, Reports 6.8 s, Administration 15.0 s). Those are not production LCP.

390×844 LCP readings in the same session were between 128 ms and 640 ms. Treat the second-load 1440 numbers as the lab sample.

Web `npx tsx --test lib/__tests__/*.test.ts`: 213 passed, 0 failed, after the notification path guard. Web `npx tsc --noEmit` exit 0 again after the vendor tab-list and queue-count contrast fixes. No assertion was weakened. Full API Jest and full Playwright were not rerun. No shared database write was made for these checks.

## Blocker

qa-reviewer stopped on an unpaid invoice on 2026-10-11. QA REVIEWER = EXTERNALLY BLOCKED — BILLING / UNAVAILABLE. That is not a PASS and not a product defect. GitHub Actions has not run. Do not merge. UX-06 System Health authorization was not changed.
