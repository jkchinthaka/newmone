# Performance baseline and optimization

Measured 2026-10-12. Branch `perf/navigation-data-loading-20261012` at `4d394657`. This branch does not contain the uncommitted UX files on `fix/ux-confirmed-defects`. Browser timings below were taken against the already running dev server at `http://127.0.0.1:3011`, which is serving that UX checkout. They are the observed environment, not a clean baseline-only run.

Independent qa-reviewer remains blocked by billing. This is not a QA PASS. Nothing was committed, pushed, or deployed. Port 3000 and port 3011 were not restarted.

## Environment

- Web dev server: `http://127.0.0.1:3011` (left running).
- API: `http://127.0.0.1:3000` (left running). Not profiled through `/health/ready`.
- Desktop viewport used for the signed-in sample: 1440×900.
- Mobile 390×844 was not measured. The second sign-in stayed on `/login`, so no further authenticated browser passes were run.
- One administrator sign-in as `admin@maintainpro.local` succeeded in 32540 ms and landed on `/action-center`. That duration includes development compilation after login.
- A later sign-in attempt did not leave `/login` within 30 seconds. It was not retried.

## What the timings separate

| Check | Result |
| --- | --- |
| Dev `/login` document, already compiled | HTTP 200 in 0.104 s, then 0.077 s |
| Dev unauthenticated `/action-center` | HTTP 307 to login in 0.008 s |
| Production `/login` on temporary port 3015 | HTTP 200 in 0.021 s, 0.004 s, 0.004 s |
| Production unauthenticated `/action-center` | HTTP 307 in 0.004 s, 0.004 s, 0.003 s |
| Signed-in full document load | Shell 0.67–7.55 s. The large values match first compilation of that route |
| Time after the document until usable text | About 1.0–1.9 s on every signed-in route |

Middleware is not the delay. An unauthenticated app route redirects in under 10 ms. Production HTML for `/login` is a few milliseconds. The slow signed-in document times are development compilation. The extra second after the document is session and page data, and it happens on routes that were already compiled.

Client navigation uses `next/link`. One warm click from Administration to Home changed the URL in 852 ms and showed usable text in 863 ms. The other warm clicks were not collected because the first locator hit a hidden mobile link, and the rerun could not sign in.

## Signed-in full document loads

Playwright `page.goto` on port 3011, one pass, after the successful login. Usable means body text is longer than 80 characters and the session gate text is gone.

| Route | Shell | Usable |
| --- | --- | --- |
| `/action-center` | 671 ms | 1769 ms |
| `/maintenance/jobs` | 760 ms | 1863 ms |
| `/work-orders/my` | 7554 ms | 8599 ms |
| `/requests` | 3528 ms | 4528 ms |
| `/maintenance/plans` | 6188 ms | 7214 ms |
| `/assets` | 6042 ms | 7937 ms |
| `/fleet/gate` | 1755 ms | 2876 ms |
| `/inventory` | 1711 ms | 2829 ms |
| `/notifications` | 742 ms | 1905 ms |
| `/reports` | 4738 ms | 5885 ms |
| `/admin` | 2493 ms | 3743 ms |

SQL Server timings were not taken. No schema or index change was made.

## Root cause fixed in this branch

`TenantSessionProvider` waited for `GET /auth/me` and only then called `GET /tenants/me`. The dashboard shell does not mount the page until that sequence finishes, so every full document load paid both round trips before any page query started. Both calls use the session cookie and do not depend on each other.

`loadTenantSession` now starts both reads together. If `/auth/me` is unauthorized, the tenant payload is not applied. A forbidden membership stays an access denial.

## Files

- `maintainpro/apps/web/lib/tenant-session-load.ts`
- `maintainpro/apps/web/lib/tenant-session.tsx`
- `maintainpro/apps/web/lib/__tests__/tenant-session-load.test.ts`
- `maintainpro/apps/web/lib/work-order-queue-nav.ts`
- `maintainpro/apps/web/components/work-orders/work-order-queue-panel.tsx`
- `maintainpro/apps/web/lib/__tests__/work-order-queue-nav.test.ts`
- `maintainpro/scripts/perf/measure-nav.mjs`, `measure-client.mjs` (local measurement scripts)

## Authenticated development navigation (2026-10-12, port 3011)

One `POST /api/backend/auth/login` returned HTTP 200 in 970 ms. Browser form sign-in was not used. These are signed-in development timings. They are not production timings. Unauthenticated `/login` timings from the earlier port 3015 run are not evidence that these screens are fast.

Playwright at 1440×900. Pass 0 is the first visit. The median uses passes 1–3. Content means the main text is longer than 80 characters and the session and loading copy are gone. Request duration fields from Playwright were 0, so API milliseconds are not reported.

| Route | Samples (content ms) | Median | Worst | Notes |
| --- | --- | --- | --- | --- |
| Home → Work Orders | 1137, 1135, 2038 | 1137 | 2038 | Full document load. Duplicate `GET /work-orders/queues` on the first visit |
| Work Orders → Assets | 20675, 1220, 3810 | 3810 | 20675 | One sample hit the 20 s heading wait |
| Assets → Inventory | 1236, 1065, 1224 | 1224 | 1236 | Full document load |
| Inventory → Fleet Gate | 1884, 1070, 1865 | 1865 | 1884 | Full document load |
| Home → Reports | 416, 416, 449 | 416 | 449 | Client click. Later pass made 0 API calls |
| Home → Requests | 1702, 1685, 2717 | 1702 | 2717 | Full document load |
| Work Orders → Job detail | Not measured |  |  | No job-detail timing was captured |

The console recorded four times: `Failed to fetch RSC payload` for `/maintenance/jobs?queue=action-required`, then `Falling back to browser navigation`. That is a full document reload caused by the jobs page writing the default queue into the URL.

## Fix in this branch

The jobs board starts the paged list with the role default queue and does not call `router.replace` only to add that default queue. Queue counts still load, and they no longer replace the page with the summary spinner. A non-default queue still updates the URL. Role defaults stay aligned with the API: technician and mechanic use my-tasks, supervisor and security officer use supervisor-verification, inventory keeper uses waiting-parts, manager and admin roles use action-required, and other roles use my-tasks.

## Document loads on the temporary server (not client clicks)

Temporary dev server on port 3016, from this branch, with `API_INTERNAL_URL=http://127.0.0.1:3000/api`. It was stopped afterward. Port 3011 stayed up. These rows are `page.goto` document loads. The 414 ms figure is a second document load, not a signed-in client-navigation median.

| Check | Result |
| --- | --- |
| Login on 3016 | HTTP 200 in 6622 ms, including first compilation of the login route |
| `/maintenance/jobs` first document load | Content 7846 ms, URL stayed `/maintenance/jobs`, 0 RSC fallbacks |
| `/maintenance/jobs` second document load | Shell 104 ms, content 414 ms, 0 RSC fallbacks |

That server also logged a hydration warning and the global error boundary. The content wait still completed.

A later temporary server on port 3017 crashed the signed-in shell with `Invariant: Missing ActionQueueContext` before any sidebar click. The worktree `node_modules` junction used mixed drive-letter case, so Next loaded two client-router copies. The junction was recreated to `C:\Users\chint\OneDrive\Pictures\newmone\maintainpro\node_modules`, the worktree `apps/web/.next` cache was deleted, and the server was started again. That is an environment fix for measurement. It is not an application change.

## Signed-in client clicks on the patched server (port 3017)

One `POST /api/backend/auth/login` returned HTTP 200 in 3970 ms. The home document was 3164 ms and rendered the sidebar (one `aside`, Work Orders link present). No console errors on that probe. Viewport 1440×900. Each hop clicked a visible sidebar link after the navigation group was expanded. A flag set on `window` before the click was still present afterward, so `documentReload` is a real reload check, not a harness `page.goto`.

Content means the main text is longer than 80 characters and the session and loading copy are gone. On a warm return, that can complete from the client cache before a new API call. Playwright request durations were 0, so API milliseconds are not reported. The temporary server was stopped after this run. Port 3011 still returned HTTP 200 for `/login`.

First client visit of each route includes development compilation of that route. Warm rows are the later clicks in the same session.

| Transition | First client visit | Warm samples (content ms) | Warm median | Warm worst | Reloads | Failed route payloads |
| --- | --- | --- | --- | --- | --- | --- |
| Home → Work Orders | 5218 ms, URL `/maintenance/jobs`, 8 API calls | 71, 75, 92 | 75 | 92 | 0 | 0 |
| Work Orders → Assets | 1788 ms | 81, 81 | 81 | 81 | 0 | 0 |
| Assets → Inventory | 1123 ms | 70, 69 | 69 | 70 | 0 | 0 |
| Inventory → Fleet Gate | 1103 ms | 70, 68 | 68 | 70 | 0 | 0 |
| Home → Requests | 999 ms | 70, 70 | 70 | 70 | 0 | 0 |

Return to Home from those routes was also a client click: content samples 73, 74, 80, 77, 76 ms, median 76, worst 80, 0 reloads, 0 failed route payloads.

The earlier port 3011 medians of 1137–3810 ms are not the before side of this table. That harness called `page.goto` when the operations group was collapsed and the sidebar link was not in the DOM. Only Home → Reports on port 3011 was a visible client click (median 416 ms). Do not treat 75 ms versus 1137 ms as a measured percentage improvement.

## Queue URL and history

The default Work Orders URL stayed `/maintenance/jobs` with no `?queue=` on every client visit. That matches the intended skip of a default-queue replace, and no RSC fallback was logged.

A later probe on the same server listed the queue tabs, then clicked the visible Overdue tab (`aria-selected` moved to Overdue). The URL became `/maintenance/jobs?queue=overdue` in 770 ms. No RSC fallback was logged. The earlier sample that stayed on `/maintenance/jobs` had waited only 500 ms, which was shorter than this replace.

Back from that queue URL returned to `/action-center`. Forward restored `/maintenance/jobs?queue=overdue`. The default board does not add its own history entry, because the role-default queue is not written with `router.replace`. The Overdue selection uses `replace` on the current Work Orders entry, so Back leaves Work Orders for the previous route rather than a bare `/maintenance/jobs` entry.

## Comparison

| Route | Earlier sample | This client-click sample | What it shows |
| --- | --- | --- | --- |
| Home → Work Orders | Port 3011 document loads, median 1137 ms, RSC fallback to `?queue=action-required` | Warm client median 75 ms, worst 92 ms, first visit 5218 ms, 0 reloads, 0 RSC failures | Default-queue replace did not fire. Warm time is cached client navigation. First visit is development compilation |
| Work Orders → Assets | Port 3011 document loads, median 3810 ms | Warm client median 81 ms, first visit 1788 ms, 0 reloads | No full-document fallback on a real sidebar click |
| Assets → Inventory | Port 3011 document loads, median 1224 ms | Warm client median 69 ms, first visit 1123 ms, 0 reloads | Same |
| Inventory → Fleet Gate | Port 3011 document loads, median 1865 ms | Warm client median 68 ms, first visit 1103 ms, 0 reloads | Same |
| Home → Requests | Port 3011 document loads, median 1702 ms | Warm client median 70 ms, first visit 999 ms, 0 reloads | Same |
| Home → Reports | Port 3011 client click, median 416 ms | Not remeasured | Already a client click under 1 s |
| Port 3016 second `/maintenance/jobs` document | 414 ms content | Not a client-click result | Left as a document-load observation only |

No further route rewrite was made for Assets, Inventory, Fleet Gate, or Requests. Their default filters already serialize to an empty query, and the client clicks did not reload the document or fail a route payload. Fleet Gate eligibility and inventory stock requests were not cached as stale, and no gate, stock, approval, or maintenance write was sent.

## Root causes

- Work Orders wrote `?queue=action-required` on load. Next then failed the route payload and fell back to a document navigation. That write is skipped when the only change is the role default. Confirmed in the browser by the URL staying `/maintenance/jobs` and by zero RSC fallback lines.
- The jobs list waited on the queue-summary request and showed a full-panel spinner. The list query now starts immediately. The browser sample does not isolate how many milliseconds that spinner used to add.
- The 1137–3810 ms “full document” rows on port 3011 were mostly the measurement harness loading the URL directly because the sidebar group was collapsed. Real sidebar clicks on the patched server stayed in the client router.
- First client visits of 999–5218 ms are development compilation of the route, measured on a freshly cleared `.next` cache.
- Warm clicks under 100 ms are client cache hits. They meet the route-feedback goal in this dev session. They are not production measurements.
- The ActionQueueContext crash was two copies of Next from a mixed-case `node_modules` junction. It blocked measurement until the junction and the worktree `.next` cache were rebuilt.

## Before / after

| Route | Before | After | Improvement | Verified |
| --- | --- | --- | --- | --- |
| `/action-center` full document | 1769 ms usable | Not remeasured in the browser | Not claimed | Dev sample only |
| `/maintenance/jobs` full document | 1863 ms usable | Not remeasured | Not claimed | Dev sample only |
| `/work-orders/my` full document | 8599 ms usable | Not remeasured | Not claimed | Dev compile dominated the shell |
| `/requests` | 4528 ms | Not remeasured | Not claimed | Dev sample only |
| `/maintenance/plans` | 7214 ms | Not remeasured | Not claimed | Dev sample only |
| `/assets` | 7937 ms | Not remeasured | Not claimed | Dev sample only |
| `/fleet/gate` | 2876 ms | Not remeasured | Not claimed | Dev sample only |
| `/inventory` | 2829 ms | Not remeasured | Not claimed | Dev sample only |
| `/notifications` | 1905 ms | Not remeasured | Not claimed | Dev sample only |
| `/reports` | 5885 ms | Not remeasured | Not claimed | Dev sample only |
| `/admin` | 3743 ms | Not remeasured | Not claimed | Dev sample only |
| Home via sidebar click | 863 ms usable | Not remeasured | Not claimed | One warm sample |

The running dev server still has the old sequential session code. Port 3011 was not restarted, so the overlap is verified by the unit test, not by a second browser pass.

## Tests

`npx tsx --test lib/__tests__/tenant-session-load.test.ts lib/__tests__/work-order-queue-nav.test.ts` from `apps/web`: 11 passed, 0 failed, exit 0.

The session test checks that the membership request starts before the session request resolves, that HTTP 401 does not select a tenant, and that HTTP 403 stays an access denial. The queue test checks role defaults and that an empty URL plus the admin default queue does not replace, while `overdue` does.

Web `npx tsc --noEmit` from `apps/web` exited 0 on the second run, after the dev server had generated `.next/types`. The first run exited 2 with only `TS6053` missing generated type files, because it started while that cache was still being created. No mobile viewport pass was run. Role coverage in the browser was the administrator session only. Tenant isolation was not re-probed with a second tenant.

## Responsive and role verification

Desktop 1440×900, administrator `admin@maintainpro.local`, one tenant in the shell. Sidebar groups were expanded before the click. Mobile navigation was not measured. No other role was signed in.

## Production comparison

Temporary `npx next start -H 127.0.0.1 -p 3015` from `C:\Users\chint\AppData\Local\Temp\mp-ux-build\maintainpro\apps\web`, using the existing `.next-isolated` build. That build includes the UX checkout, not this performance branch. Ready in 555 ms. Unsigned `/login` and `/action-center` timings are in the table above. The process tree for that server was stopped. Port 3015 then refused connections. Port 3011 still returned HTTP 200 for `/login`.

A signed-in production navigation comparison was not run.

## Table-ready client clicks (development, port 3018)

Same patched branch, temporary dev server, `API_INTERNAL_URL=http://127.0.0.1:3000/api`. One administrator login, HTTP 200 in 2162 ms. Desktop 1440×900. Each hop clicked a visible sidebar link. Data-ready means the destination heading is visible, the page’s loading copy is gone, and the table has rows or the page’s empty or error state is showing. `window.__spa` survived every click. No route-payload failure was logged. The server was stopped afterward. Port 3011 was not used for this sample.

| Transition | First visit, URL change / table ready | Later table-ready samples | Reloads | Failed route payloads |
| --- | --- | --- | --- | --- |
| Work Orders → Assets | 1658 ms / 1671 ms | 56 ms, 59 ms | 0 | 0 |
| Assets → Inventory | 687 ms / 697 ms | 45 ms, 52 ms | 0 | 0 |
| Inventory → Fleet Gate | 890 ms / 903 ms | 110 ms, 82 ms | 0 | 0 |
| Home → Requests | 992 ms / 1008 ms | 99 ms, 95 ms | 0 | 0 |

The table was ready within about 15 ms of the URL change. The first-visit time is development compilation of that route. The later samples are a warm client cache. These are not the port 3011 document-load medians (3810, 1224, 1865, and 1702 ms). No additional route rewrite was made, because these clicks did not fall back to a document navigation.

## Direct API timings (port 3000, read-only)

Three sequential GETs per path through the API, with the administrator bearer token and tenant header. No writes. Status 200 on every sample.

| Endpoint | Samples | Bytes |
| --- | --- | --- |
| `GET /assets?page=1&limit=25` | 77, 16, 15 ms | 53439 |
| `GET /assets/summary` | 69, 22, 16 ms | 374 |
| `GET /inventory/parts?page=1&pageSize=25` | 28, 26, 27 ms | 7066 |
| `GET /inventory/dashboard` | 33, 29, 33 ms | 270 |
| `GET /vehicles?page=1&pageSize=25` | 47, 34, 32 ms | 7949 |
| `GET /maintenance-requests?page=1&limit=25` | 82, 46, 41 ms | 36389 |
| `GET /maintenance-requests/summary` | 23, 31, 31 ms | 303 |

Assets, inventory, and Fleet Gate already start the list without waiting for the summary. Requests loads the list and the summary together and keeps the result line on “Loading…” until both return. Both of those calls are under 100 ms here, so splitting them would not move the measured navigation time. Fleet Gate still loads block reasons only after a vehicle is selected for gate out. Inventory stock was not cached.

Calls through the Next dev proxy were slower and uneven (some samples near 600 ms). Those samples are not the API times above.

## Work order queues

Direct reads on port 3000, three samples, HTTP 200. No writes.

| Role | Endpoint | Samples | Bytes |
| --- | --- | --- | --- |
| Administrator | `GET /work-orders/queues` | 520, 50, 42 ms | 1628 |
| Administrator | `GET /work-orders/queues/action-required?page=1&pageSize=25` | 649, 280, 263 ms | 295366 |
| Technician | `GET /work-orders/queues` | 271, 41, 31 ms | 1344 |
| Technician | `GET /work-orders/queues/my-tasks?page=1&pageSize=25` | 293, 101, 101 ms | 320063 |

The summary is not what holds the board. After the first call it returns in 31–50 ms. The paged list is slower and much larger: 25 rows carry about 150 fields, and the largest nested values on an administrator row were `asset` and `parts`. The board already starts that list without waiting for the summary, and the default administrator queue still does not write `?queue=`. The list payload was not trimmed, because the job drawer reads fields from the same row and a warm production click still showed the table in under 100 ms from cache.

Technician coverage here is the API session only. The browser passes below are the administrator.

## Signed-in production navigation (local laboratory)

`npx next build` wrote `apps/web/.next-perf` (exit 0, about 105 s). `npx next start` served it on port 3019. That directory is not the `.next` folder used by port 3011. The process used `ALLOW_INSECURE_HTTP=true` and `COOKIE_SECURE=false` so the local HTTP lab could keep session cookies. That flag was not written into the application. The server was stopped after the measurements. These timings are a local production build, not a hosted production compliance result.

One administrator login. Desktop 1440×900, sidebar clicks after the groups were opened one at a time. Click time starts when the link is clicked. Data-ready means the destination heading is visible, loading copy is gone, and the list or empty state is showing. `window.__spa` survived every click. No route-payload errors.

Home document on this server: 287 ms.

| Transition | First click, URL / heading / data | Warm data samples | Warm data median | Reloads |
| --- | --- | --- | --- | --- |
| Home → Work Orders | 56 / 74 / 418 ms | 80, 78, 92 ms | 80 ms | 0 |
| Work Orders → Assets | 57 / 69 / 120 ms | 74, 61, 73 ms | 73 ms | 0 |
| Assets → Inventory | 46 / 51 / 106 ms | 94, 92, 98 ms | 94 ms | 0 |
| Inventory → Fleet Gate | 53 / 58 / 116 ms | 97, 98, 96 ms | 97 ms | 0 |
| Home → Requests | 57 / 65 / 141 ms | 109, 93, 111 ms | 109 ms | 0 |
| Home → Reports | 55 / 62 / 64 ms | 61, 62, 73 ms | 62 ms | 0 |

The first Work Orders click waited on `GET /work-orders/queues/action-required` (395 ms). Later clicks reused the client cache. Inventory and Fleet Gate still refetch their lists on later clicks (parts about 68–86 ms, vehicles about 85–88 ms). Reports adds `module`, `from`, and `to` to the URL without a document reload.

## Mobile, 390×844

The first mobile attempt could not open lower drawer groups. The bottom navigation and the drawer were both `z-40`, and the bottom bar sat later in the document, so it intercepted the group buttons. The drawer overlay is now `z-50`. After a rebuild, the same administrator completed the journeys from the bottom bar (Home, Work Orders) and the menu (Assets, Inventory, Fleet Gate, Requests, Reports). No document reloads and no route-payload errors.

| Transition | First click data | Warm data samples | Warm median |
| --- | --- | --- | --- |
| Home → Work Orders | 438 ms | 64, 62, 62 ms | 62 ms |
| Work Orders → Assets | 110 ms | 59, 58, 59 ms | 59 ms |
| Assets → Inventory | 110 ms | 76, 76, 76 ms | 76 ms |
| Inventory → Fleet Gate | 92 ms | 75, 75, 77 ms | 75 ms |
| Home → Requests | 115 ms | 96, 94, 96 ms | 96 ms |
| Home → Reports | 56 ms | 54, 53, 53 ms | 53 ms |

There is no before/after millisecond comparison for the drawer, because the blocked clicks never reached those routes. The after state is that the menu groups can be opened and the routes load as in the table.

## API and frontend bottlenecks still open

- The work-order queue list returns about 300 KB for 25 rows. Warm SQL-side time was 263 ms for the administrator action-required page and 101 ms for the technician my-tasks page. Production warm navigation hides that behind the client cache.
- Inventory parts and the vehicle list refetch on later visits. Those calls stayed under 100 ms in this sample.
- Reports writes a default date range into the URL. It did not reload the document.
- This is a local production build. It is not a statement about hosted production capacity.

## Source changes in this pass

- `apps/web/components/layout/mobile-nav.tsx`: drawer overlay `z-50`, so the bottom navigation no longer covers menu groups.
- `apps/web/next.config.mjs`: `distDir` follows `NEXT_DIST_DIR`, otherwise `.next`.
- `maintainpro/.gitignore`: ignores `apps/web/.next-perf/`.

Web `npx tsc --noEmit` exited 0 after the drawer change and again after the regression tests. `npx next build` for `.next-perf` exited 0. Targeted tests `npx tsx --test lib/__tests__/work-order-queue-nav.test.ts lib/__tests__/mobile-nav-stack.test.ts lib/__tests__/tenant-session-load.test.ts`: 14 passed, 0 failed.

The queue tests check that the role-default queue does not replace the URL, that an explicit queue such as `overdue` is written once with `router.replace` and is not written again, and that a bare URL with the role default still does not navigate. That is the history behavior measured in the browser: Back leaves Work Orders for the previous route, and Forward restores `?queue=`. The mobile tests check that the drawer overlay is `z-50` and the bottom bar is `z-40`, that menu links use `next/link` and close through `onNavigate`, and that the focus trap restores focus and page scrolling when the menu closes.

## Integration with the other uncommitted worktrees

Read-only comparison on 2026-10-12. Nothing was merged.

| Worktree | Branch | Product overlap with this branch |
| --- | --- | --- |
| UX checkout | `fix/ux-confirmed-defects` | `work-order-queue-panel.tsx`, `work-order-queue-nav.ts`, `work-order-queue-nav.test.ts` |
| Pilot | `chore/pilot-readiness-20261012` | `AI_SESSION_HANDOVER.md` only |
| This branch | `perf/navigation-data-loading-20261012` | — |

The UX queue changes add `queuePurpose` sentences and move Unassigned and High Priority onto the primary tab row. This branch adds the default-queue replace skip and starts the list without waiting for the summary. Both edits are in the same three files and will conflict, but they do not contradict each other. Keep both behaviors.

The UX bottom navigation adds `aria-current`. This branch does not edit that file. This branch raises the drawer overlay to `z-50`. The UX checkout does not edit `mobile-nav.tsx`. Take both.

This branch changes tenant session loading. Neither other worktree edits `tenant-session.tsx`. The pilot branch changes API health, replication defaults, and env validation. This branch does not edit those API files.

All three worktrees edit `AI_SESSION_HANDOVER.md`. Do not copy one handover over another. Write a new current block after the code is combined.

Suggested order: land the pilot health change first, because it does not touch the web files. Then land this performance branch. Then replay the UX queue-purpose and `aria-current` edits on top, and resolve the three queue files by keeping the replace skip, the immediate list, the purpose sentence, and the extra primary tabs. Re-run the queue tests, the mobile stack test, the session test, and a signed-in check that the default Work Orders URL stays bare, Overdue writes `?queue=overdue`, and the mobile menu opens above the bottom bar.

## Hosted production

These results are from a local `next build` and `next start` on this machine. Hosted production performance and an end-user deployment have not been verified. The action-required list can be about 295 KB for 25 rows. That payload was not changed.

## Git and QA

Worktree `C:\Users\chint\AppData\Local\MaintainPro\worktrees\perf-navigation`, branch `perf/navigation-data-loading-20261012`, HEAD `4d394657`. Changes are uncommitted. The UX checkout and the pilot worktree were not edited. Port 3000 and port 3011 were not restarted. The port 3019 server was stopped.

Independent qa-reviewer remains blocked by an unpaid invoice. This document is not a QA PASS. Nothing was committed, pushed, or deployed.

## Unresolved

- Hosted production capacity was not measured. The local production build met the laboratory click-to-content goals on these routes.
- Technician browser navigation was not repeated. The technician queue API samples are above.
- The 300 KB work-order list payload is unchanged.

## Approval still required

- Independent qa-reviewer after billing is cleared.
- No production deployment. Port 3011 still serves the older checkout.
