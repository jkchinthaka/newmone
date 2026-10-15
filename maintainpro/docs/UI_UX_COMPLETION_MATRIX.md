# MaintainPro UX completion matrix

Date: 2026-10-12. Branch `fix/ux-confirmed-defects` at `4d394657`. Uncommitted. This is not QA approval, human UAT, or production approval.

Statuses used here: LOCALLY VERIFIED means a signed-in browser check happened for the stated behavior. PARTIALLY VERIFIED means only part of the module was checked. BLOCKED means an owner or reviewer decision is required. No row is QA APPROVED.

| Module | What was checked | Desktop | Tablet | Mobile | Keyboard | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Work order queues | Purpose text and `queue=` | 1440 | 768 | 390 | Not a full pass | LOCALLY VERIFIED |
| My Jobs | Filter purpose and `filter=` | 1440 | 768 | 390 | Tab focus | LOCALLY VERIFIED |
| Work order create | 44px control, Escape closes drawer, Tab stays inside | 1440 | — | 390 | Tab trap and Escape | LOCALLY VERIFIED |
| PM plans | Due-state sentences | 1440 | 768 | 390 | Pressed state | LOCALLY VERIFIED |
| Requests | Triage sentence and `view=triage` | 1440 | 768 | 390 | — | LOCALLY VERIFIED |
| Assets | Phone cards, desktop table, named page-size select | 1440 | 768 | 390 | Select name | PARTIALLY VERIFIED |
| Inventory | Snapshot labels, cards, record/movement time | 1440 | 768 | 390 and 320 | — | LOCALLY VERIFIED |
| Notifications | Search, Unread toggle, no self-link | 1440 | 768 | 390 | Focus outline | LOCALLY VERIFIED |
| Fleet gate | Cards, unavailable readiness, negative meter | 1440 | — | 390 | `aria-invalid` | LOCALLY VERIFIED |
| Reports and costs | Load-time sentence, phone cost split | 1440 | 768 | 390 | — | LOCALLY VERIFIED |
| Administration | Labeled totals, 44px Invite User | 1440 | 768 | 390 | — | LOCALLY VERIFIED |
| Settings | 44px tabs, `?tab=` | 1440 | — | 390 | Enter | LOCALLY VERIFIED |
| Shared tables | Vehicle costs title and phone Enter | 1440 | 768 | 390 | Enter | LOCALLY VERIFIED |
| Vehicles | Status filters 44px, no status write | 1440 | 768 | 390 and 320 | — | PARTIALLY VERIFIED |
| Fleet workspace | Title, axe, phone overflow contained | 1440 | 768 | 390 and 320 | — | LOCALLY VERIFIED |
| Maintenance home, approvals, history, planning, inspections, ERP | Title loaded, axe and overflow | 1440 | 768 | 390 and 320 | — | LOCALLY VERIFIED |
| Service jobs, vehicle jobs, new request, reliability | Title loaded, axe and overflow 0 | 1440 | 768 | 390 and 320 | — | LOCALLY VERIFIED |
| Machinery jobs and vendors | Overflow 0 and axe-clean at all four widths after the count and name fixes | 1440 | 768 | 390 and 320 | Skip-link focus | LOCALLY VERIFIED |
| Organization and maintenance supply | Title, axe, and overflow | 1440 | 768 | 390 and 320 | Skip-link focus | LOCALLY VERIFIED |
| System Health | Authorization mismatch | — | — | — | — | BLOCKED |
| Release | qa-reviewer unpaid invoice | — | — | — | — | BLOCKED |

Retired routes are not in this table.

## Evidence counts for 2026-10-11

These counts are checks, not a completion percentage.

| Check | Count |
| --- | --- |
| Active routes in this table | 15 modules, plus 7 additional signed-in URLs |
| URLs with an axe scan at 1440, 768, 390, and 320 | 15, 0 violations after the five contrast and name fixes |
| Additional URLs with an axe scan at 1440, 768, 390, and 320 | 7, 0 violations, overflow 0 except Fleet before the second containment fix. Fleet rechecked at overflow 0 on 390, 320, and 200% text |
| Keyboard checks passed in the browser | Create drawer: 40 Tabs stayed inside, Shift+Tab wrapped to Cancel, Escape restored the opener. Existing job: Assignment by keyboard, 12 Tabs stayed inside, Escape closed it |
| Web unit tests | Earlier full run: 213 passed, 0 failed. After the notification path guard, `notification-inbox` re-run: 3 passed, 0 failed |
| Fleet content under containment | Last section tab and the row actions control stayed reachable at 1440, 768, 390, 320, and 200% text. Focus outline was solid 2px. The actions menu link had a non-zero box. Page overflow stayed 0 |
| Notification link guard | Absolute, protocol-relative, and `javascript:` targets resolve to the inbox and are not linked. Browser navigation to a real linked record remains NOT TESTED |
| Safe Playwright | 6 passed, 0 failed, on port 3011, no extra dev server: password visibility, no public sign-up, empty login, invalid email, and two unauthenticated redirects. Signed-in and mutating specs were not run |
| Four outstanding scans, 2026-10-12 | Machinery Jobs at 390 and 320, and Vendor Eligibility at 1440 and 390: 0 axe violations, overflow 0, expected headings. The sampled 28 routes now have four-viewport axe coverage |
| Organization and ERP mapping | `/admin/organization` and `/maintenance-supply`: axe-clean at 1440, 768, 390, and 320, overflow 0. `/system-health` was not scanned and its authorization was not changed |
| Production build | Isolated `npx next build` exit 0 on 2026-10-12. Output `.next-isolated` in a temp worktree. First attempt exit 1 until `NEXT_PUBLIC_API_URL` was set to the local API. Live `apps/web/.next` timestamp unchanged. Port 3011 `/login` stayed 200. Not deployed |
| Web typecheck | `npx tsc --noEmit` exit 0 after the notification path guard and again after the vendor and queue-count fixes |
| Screen reader | NOT TESTED. No screen reader was operated |
| Independent QA approved | 0 |
| Merged | 0 |
| Human UAT completed | 0. Pack: `UI_UX_HUMAN_UAT.md` |
| Production approved | 0 |
| System Health policy | Unresolved. UX-06 unchanged |

Axe rule set: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`. A clean scan is not WCAG 2.2 AA conformance. Lab timing is in `UI_UX_FINAL_VALIDATION.md`. It is not field Core Web Vitals data.
