# Integration rehearsal — 2026-10-12

Local rehearsal only. Not an independent reviewer PASS. Not committed, pushed, merged, or deployed.

## Sources

All three source worktrees were still at `4d3946574bf2b450773c3549692880a98f89b1cc` and were not modified.

| Workstream | Branch | Worktree |
| --- | --- | --- |
| Pilot | `chore/pilot-readiness-20261012` | `C:\Users\chint\AppData\Local\MaintainPro\worktrees\pilot-readiness` |
| Performance | `perf/navigation-data-loading-20261012` | `C:\Users\chint\AppData\Local\MaintainPro\worktrees\perf-navigation` |
| UX | `fix/ux-confirmed-defects` | `C:\Users\chint\OneDrive\Pictures\newmone` |

Recoverable copies of the tracked diffs and the untracked source and test files are in `C:\Users\chint\AppData\Local\MaintainPro\integration-rehearsal-20261012\inventory`. The UX backup directories and `maintainpro/.github/renovate.json` were left out. The frozen UX backup was not overwritten.

## Rehearsal tree

`C:\Users\chint\AppData\Local\MaintainPro\worktrees\integration-rehearsal` on `rehearsal/three-workstream-20261012`, no upstream. Applied in order: pilot tracked diff, performance tracked diff, UX tracked diff. Untracked pilot, performance, and UX source and docs were copied after that.

## Conflicts

`git apply --reject` rejected one hunk in each of these files because the performance edit had already changed the import block:

- `maintainpro/apps/web/components/work-orders/work-order-queue-panel.tsx`
- `maintainpro/apps/web/lib/__tests__/work-order-queue-nav.test.ts`

`work-order-queue-nav.ts` applied cleanly and already contained both the UX purpose text and primary tabs and the performance default-queue helpers. The rejected imports were added by hand: `queuePurpose` in the panel and the test. The panel still uses `queueSearchReplaceTarget`, `router.replace`, and `enabled: true`, and it does not wait on the queue-summary spinner.

No file was left unresolved.

## Extra rehearsal fix

The first signed-in check showed Escape closed the drawer but left `document.body.style.overflow` as `hidden`. The drawer and the focus trap were both locking scroll, and the trap restored the value the drawer had already set. The duplicate lock was removed from `mobile-nav.tsx` in this rehearsal only. The focus trap still locks scroll while the menu is open and restores it on close. The original performance worktree was not edited, so a later real integration needs this same removal.

## Tests

| Command | Result |
| --- | --- |
| `npx tsx --test` on the 11 web queue, mobile, session, and UX test files | 52 passed, exit 0 |
| Re-run of queue and mobile tests after the overflow fix | 12 passed, exit 0 |
| `npx jest --config ./jest.config.cjs test/health-integration-modes.spec.ts --forceExit` | 7 passed, exit 0 |
| `node scripts/test/pilot-stack-guard.selftest.mjs` | `pilot-stack-guard: ok`, exit 0 |
| `npx tsx scripts/test/replication-config.selftest.ts` | `replication-config: ok`, exit 0 |
| Web `npx tsc --noEmit --pretty false` | exit 0 |
| API `npx tsc --noEmit --pretty false` | exit 0 |

No production build was required. Ports 3000 and 3011 were not restarted. No API process was started. No stock, gate, or approval write was sent.

## Browser

Isolated `next dev` on `http://127.0.0.1:3021`, then stopped. Signed in as the seeded administrator. Read-only navigation.

- Default Work Orders URL: `/maintenance/jobs` with no `queue` parameter, purpose text present, 25 rows.
- Overdue tab: `/maintenance/jobs?queue=overdue`.
- Back: `/action-center`. Forward: `/maintenance/jobs?queue=overdue`.
- An in-page marker set before each click survived. Route-payload console errors: 0.
- Mobile drawer computed `z-index` 50, bottom bar 40, drawer covers the bar, a link is present.
- After Escape the drawer was unmounted and body overflow was empty.

## Still required

Independent qa-reviewer review, human UAT, and screen-reader checks. Hosted production was not verified. This rehearsal PASS is not a reviewer PASS.

## Claude findings remediation — 2026-10-12

Claude's PASS WITH CONDITIONS is not formal QA approval. These corrections are uncommitted in the rehearsal worktree only.

### F-01

Verified. Application code defaults replication to false. These templates set `DATABASE_REPLICATION_ENABLED=true`:

| File | What a change would do | Decision |
| --- | --- | --- |
| `render.yaml` | The next Render blueprint sync would set the live service variable to false and stop outbox processing on that deploy. | **APPROVAL REQUIRED.** Not edited. |
| `maintainpro/.env.production.example` | Changes the copied example only. No running service reads this file. | Set to false. |
| `maintainpro/.env.docker.example` | Same. A future copied Docker env starts with replication off. | Set to false. |
| `maintainpro/apps/api/.env.example` | Same class of example, also set to true. | Set to false. |

`DATABASE_REPLICATION_MODE=async_outbox` was left in the examples so an approved opt-in still has its mode. No replication process was started.

### F-05

The queue panel returned early when the URL had no `queue`, so search and Back/Forward could not replace the in-memory queue. `resolvedQueueFilters` now applies the URL on every change, uses the role default when `queue` is missing, invalid, or forbidden, and keeps `q`. `queueSearchReplaceTarget` still refuses to write that default back. The list still loads without waiting for the summary.

### F-02

`useFocusTrap` stored `onEscape` in the effect dependency list, so the inline layout callback restarted the trap and moved focus. The effect now reads the latest callback from a ref. Escape still closes the drawer, cleanup restores focus and scroll, and the drawer does not set a second overflow lock.

### Related

- F-03a: confirmed. A missing root set overflow to hidden and returned before registering cleanup. The lock now happens only after a root exists.
- F-03b: Escape with both the command palette and the drawer open closes the palette first. Added `stackedOverlayEscape` and wired it to the drawer Escape path.
- F-04: queue counts are omitted until the summary response arrives, so the tabs do not show a false zero. The list is not blocked. A real zero still shows after the summary loads.

### Tests

| Command | Result |
| --- | --- |
| `npx tsx --test` queue, focus-trap, mobile-nav, overlay, tenant-session | 24 passed, exit 0 |
| `node scripts/test/pilot-stack-guard.selftest.mjs` | ok, exit 0 |
| `npx tsx scripts/test/replication-config.selftest.ts` | ok, exit 0 |
| Web `npx tsc --noEmit --pretty false` | exit 0 |

Health integration tests were not re-run. Health source did not change.

### Browser

Temporary `next dev` on port 3021, then stopped. Ports 3000 and 3011 were not restarted. Signed-in read only.

- `/maintenance/jobs?q=WO-123` stayed without a `queue` parameter. The search box showed `WO-123`. The selected tab was Action Required. Route-payload errors: 0.
- After opening `?queue=overdue` and returning to `?q=WO-123`, the URL, search box, and Action Required tab matched again.

### Second-round remediation — 2026-10-12

Not self-approved. Not a formal QA PASS.

### R-01

Reproduction: each trap registered its own document listener. The outer role-permission trap was registered first, so its Escape handler ran first and called `requestClose`, which opens the discard confirmation. The inner dialog then saw a consumed event or opened and closed in the same gesture.

Fix: traps share a per-document stack. Only the newest trap handles Escape and Tab. Scroll locking is counted once for the stack and restored when the last trap closes. Tests cover one trap, nested editor/confirm, a later Escape on the outer trap, drawer/palette close order, and a missing root.

### R-02

Reproduction: URL sync assigned `setSearchInput(next.query)` after `trim()`. Typing `pump ` published `q=pump`, and the echo deleted the space, so the next letters produced `pumpmotor`.

Fix: `shouldKeepLocalSearch` keeps the field when the URL is only the trimmed echo, including while a newer edit is in flight. A different query still replaces the field for Back/Forward and command-palette navigation. Signed-in browser: the field stayed `pump motor`, and the Overdue URL was `/maintenance/jobs?queue=overdue&q=pump+motor`.

### F-04

Fallback tabs are filtered with `queuesVisibleToRole`. Counts are omitted until `summaryQuery.data` exists, so a real zero can appear after success and a loading state does not show zero. The error banner no longer says counts may show as zero.

### H-1

Not reproduced as a signed-in shell unmount. The shared lock stays held until the last trap releases, including when the outer trap is released first. Classified as addressed by that lifecycle, not as a confirmed browser defect.

### F-01

PARTIAL — `render.yaml` owner decision pending. The three example files remain `DATABASE_REPLICATION_ENABLED=false`. `render.yaml` was not edited.

### Tests

`npx tsx --test` on queue, focus-trap, overlay, mobile-nav, and tenant-session: 27 passed, exit 0. Pilot stack guard exit 0. Web `tsc --noEmit` exit 0. Role-editor and drawer Escape were not repeated in the browser.

The same five test files were run again after the inventory-keeper fallback assertion: 27 passed, exit 0. Web `tsc --noEmit` exit 0 immediately afterward.

## Files for independent Claude re-review

Review these rehearsal files only. Do not treat this list as approval.

| File | Why |
| --- | --- |
| `maintainpro/apps/web/lib/use-focus-trap.ts` | R-01 topmost trap and refcounted scroll lock |
| `maintainpro/apps/web/lib/__tests__/focus-trap.test.ts` | Nested Escape, close order, missing root |
| `maintainpro/apps/web/lib/work-order-queue-nav.ts` | `shouldKeepLocalSearch`, `queuesVisibleToRole` |
| `maintainpro/apps/web/lib/__tests__/work-order-queue-nav.test.ts` | Spaces, queues, technician and inventory-keeper fallback |
| `maintainpro/apps/web/components/work-orders/work-order-queue-panel.tsx` | Search echo, role-filtered tabs, hidden counts, banner |

`role-permission-editor.tsx` and `confirm-dialog.tsx` were not edited. They already call `useFocusTrap`. `render.yaml` was not edited. System Health authorization was not edited.

## R-02b — out-of-order search URL — 2026-10-12

Not self-approved. Not a formal QA PASS. R-01, F-04, and H-1 were not reopened.

### Root cause

The URL effect copied the visible draft into `filters.query` whenever the draft was kept. That started another `router.replace` for text the debounce had not finished. A later debounce then published a newer trim and cleared the editing flag. When an older replace completed, `shouldKeepLocalSearch` no longer matched that older query, and the effect wrote it back into the field. Typing `pump `, then `pump m`, then `pump mo` could leave the field at `pump m`.

### Fix

The draft and the committed query are separate. Only the 300ms debounce copies the draft into the committed query and the URL. Each trimmed commit is recorded. A URL whose query is an older commit is ignored, including after the editing flag has been cleared. A query this page did not publish, such as Back or a command-palette `router.push`, still replaces the field and the committed query. The list request still uses the committed query and does not wait for queue-summary counts.

### Tests

`npx tsx --test lib/__tests__/work-order-queue-nav.test.ts` from `apps/web`: 15 passed, exit 0. The new test drives `reduceWorkOrderSearchUrl`, the same function the panel effect calls. It covers the out-of-order `pump` / `pump m` / `pump mo` sequence, one fetch per commit, a second delivery that does not replace again, command-palette `WO-123`, Back to the previous search, explicit Overdue, an invalid queue, a forbidden technician queue, and a role change to technician. Web `tsc --noEmit` exit 0. Focus-trap source was not changed, so those tests were not repeated.

### Browser

Temporary `next dev` on port 3021, then stopped. Ports 3000 and 3011 were not restarted. Signed in once as the seeded administrator. Work-order API responses were delayed 250ms.

- Fast typing stayed `pump motor`.
- `pump ` then a pause then `motor` stayed `pump motor`.
- Overdue was `/maintenance/jobs?queue=overdue&q=pump+motor` and the field stayed `pump motor`.
- Back went to `/action-center`. Forward restored the Overdue URL and `pump motor`.
- Command palette search for `WO-123` opened `/maintenance/jobs?q=WO-123` and the field became `WO-123`.

The out-of-order router completion itself was verified by the state-machine test, not by forcing two replaces to finish backwards in the browser.

### Residual

A command-palette navigation whose query text is exactly an older in-flight publication from the same visit is still ignored until a different query arrives. `router.replace` does not keep those intermediate queries as Back targets. F-01: PARTIAL — `render.yaml` owner decision pending. Formal qa-reviewer PASS is still unavailable.

## R-02c — completed search can be opened again — 2026-10-12

Not self-approved. Not a formal QA PASS.

### Root cause

`applySearchUrl` kept every trimmed query published during the visit. After WO-123 and WO-124 had both been confirmed, a command-palette or other navigation back to WO-123 was still in that list, so it was ignored as a stale echo. The panel kept WO-124 and the replace effect wrote that query back onto the URL.

### Correction

Each debounce publication now has a numeric `qRev`. Only an older `qRev` is a late echo. A URL without `qRev`, such as the command palette, replaces the field. Browser Back and Forward are marked from the Navigation API and `popstate`, and that destination is applied even when its `qRev` is older. The replace effect skips that one history update so it does not immediately write the previous query back. Fast typing still keeps the draft until the 300ms debounce.

### Tests

`npx tsx --test lib/__tests__/work-order-queue-nav.test.ts`: 16 passed, exit 0. The reducer tests cover out-of-order `pump` / `pump m` / `pump mo`, WO-123 then WO-124 then an external return to WO-123, a late echo of WO-123 that does not rewind, Overdue keeping the query, Back through `fromHistory`, an invalid queue, and a forbidden technician queue. Web `tsc --noEmit` exit 0.

### Browser

Temporary `next dev` on port 3021, then stopped. Ports 3000 and 3011 were not restarted. Work-order API responses were delayed 250ms.

- WO-123 completed as `q=WO-123&qRev=1`.
- WO-124 completed as `q=WO-124&qRev=2`.
- Command palette WO-123 left the URL at `q=WO-123`, the field at `WO-123`, and the selected tab Action Required.
- Overdue kept `q=WO-123`.
- Fast typing stayed `pump motor`.
- Back restored `q=WO-124` and the field `WO-124`. Forward restored `pump motor`.

### Remaining ambiguity

A same-session client navigation that reuses an older `qRev` without a browser history traversal is still treated as a late echo. Command-palette links do not send `qRev`. A full page load starts the ids again. F-01: PARTIAL — `render.yaml` owner decision pending.

## Files for independent Claude re-review

- `maintainpro/apps/web/lib/work-order-queue-nav.ts`
- `maintainpro/apps/web/lib/__tests__/work-order-queue-nav.test.ts`
- `maintainpro/apps/web/components/work-orders/work-order-queue-panel.tsx`

`render.yaml` was not edited. System Health authorization was not edited.
