# MaintainPro + FG unified frontend deep audit

**Date:** 2026-08-18  
**Scope:** Current `maintainpro/` worktree after preceding inventory and FG Next.js work. MaintainPro Maintenance / Fleet / Inventory / Facility and FG Digital Records are one product.  
**Method:** Source inspection of App Router pages, layout shells, FG UI, navigation, Action Center, tables/forms, React Query, tenant session, and E2E files. Prior audit notes were not reused as truth.  
**Production:** Not deployed. `PRODUCTION_CHANGED=NO`. FG Next.js remains behind `FG_NEXTJS_UI_ENABLED` / `NEXT_PUBLIC_FG_NEXTJS_UI_ENABLED` until E2E, CSRF/SSO, and business UAT pass. Django JSON API on this branch now consumes CL18/CL30 `occurrenceToken`.

## Inventory

| Area | Count / result |
| --- | --- |
| Next.js `page.tsx` routes | 149 |
| FG dashboard pages | `/fg`, dashboard, records, review, QA, history, reports, SSO denied |
| Legacy FMS routes | `/home`, `/vehicle`, `/machinery`, `/service` behind `LegacyFmsRouteGuard` |
| Route `loading.tsx` (after this pass) | work-orders, inventory, FG, vehicles, assets, dashboard, reports |
| Route `error.tsx` besides root | Matching module `error.tsx` files for those operational routes |
| Bundle analyzer | Not present (`@next/bundle-analyzer` not in package.json) |

## Findings

Each finding has a priority and a class. Status reflects this remediation pass.

### P0

| ID | Class | Finding | Status |
| --- | --- | --- | --- |
| F-01 | CONFIRMED_DEFECT | Tenant switch in `topbar.tsx` only called `queryClient.invalidateQueries()`. Work-order list uses `placeholderData: previous`. Query keys omitted tenant id. Tenant A rows could remain visible after switching to tenant B. `selectTenant` in `tenant-session.tsx` did not touch the QueryClient. | Fixed: `queryClient.clear()` on switch; tenant-scoped query keys for work orders and inventory. |
| F-02 | CONFIRMED_DEFECT | `DashboardShell` called `router.replace("/login?reason=session_expired")` during render. | Fixed: navigate in `useEffect`. |
| F-03 | CONFIRMED_DEFECT | FG BFF client prefix is `/fg/api/v1` while the catch-all is `app/fg/api/[...path]`. Requests became `/api/v1/v1/...`. Session boot (`path[0] === "session"`) never matched. | Fixed: strip a leading `v1` segment before proxy/session detect. |
| F-04 | CONFIRMED_DEFECT | FG layout rendered `{children}` while also mounting `FgLegacyRedirect` when the Next.js flag is off, so native FG pages still fetched. | Fixed: redirect only; do not mount children when the flag is off. |

### P1

| ID | Class | Finding | Status |
| --- | --- | --- | --- |
| F-05 | CONFIRMED_DEFECT | FG `fieldErrorsFor` was hardcoded to an empty object in `fg-record-form.tsx`. Envelope already parses `fieldErrors`. | Fixed. |
| F-06 | ACCESSIBILITY_GAP | FG yes/no radios used `aria-labelledby={field.fieldName}` with no matching id; missing `aria-invalid` / `aria-required` / described-by on the radiogroup. | Fixed: `fieldset` + `legend` + radio inputs; first invalid control is focused after save/submit field errors. |
| F-07 | UX_GAP | No unsaved-draft protection on FG record editor (`beforeunload` and in-app link intercept absent). | Fixed on FG record form. |
| F-08 | ACCESSIBILITY_GAP | DataTable put `aria-sort` on the sort button instead of `<th>`. Row `tabIndex` plus action buttons created nested interactivity. | Fixed: `aria-sort` on `<th>`; row keyboard activation removed when actions exist; mobile cards are not `role="button"` when actions exist. |
| F-09 | ACCESSIBILITY_GAP | Confirm/prompt dialogs, command palette, and mobile nav had Escape + initial focus but no focus trap or restore. | Fixed with `useFocusTrap`. |
| F-10 | UX_GAP | Tenant switcher was `hidden sm:flex`. Mobile users could not switch organization. | Fixed: tenant switcher in mobile drawer. |
| F-11 | UX_GAP | No route-level `loading.tsx`. Only root error boundaries. | Fixed for work-orders, inventory, FG, vehicles, assets, dashboard, reports. |
| F-12 | UX_GAP | Command palette called `getVisibleNavigationItems(role)` without permissions, so FG stayed hidden for ADMIN even when the sidebar could show it. Palette was module-only. | Fixed: pass permissions; add permission-aware work-order / FG jump commands. There is still no backend global entity search API. |
| F-13 | UX_GAP | Action Center had zero FG links. | Fixed: real `/fg`, `/fg/review`, `/fg/qa` links gated on `fg.access`. No invented KPIs. |
| F-14 | UX_GAP | Nav / Action Center `?queue=` shortcuts were ignored. Queue panel always initialized from `defaultQueue`. | Fixed: hydrate queue and `q` from the URL. |
| F-15 | CONFIRMED_DEFECT | CL39 (`one_per_day_per_room`) never passed `room` to `openFgRecord` despite `coldRooms` on the dashboard payload. | Fixed: room select from `coldRooms` only; no invented rooms. |
| F-16 | ACCESSIBILITY_GAP | FG vehicle selector was not a combobox; typing did not commit (correct for match-required) but unavailable vehicles remained clickable. | Fixed: combobox semantics; unavailable options disabled; blur restores committed value. |
| F-17 | TECH_DEBT | Root error boundaries logged full `Error` objects via `console.error`. No Sentry. OperationalAlert is backend-only. | Fixed: sanitized `{ name, digest }` reporter. No new reporting API invented. |

### P2

| ID | Class | Finding | Status |
| --- | --- | --- | --- |
| F-18 | UX_GAP | `EXISTING_NAV_ROUTES` hid shipped pages (`/qa`, `/go-live`, `/erp`, operations, procurement matching, health/forecast, report subpages). | Fixed: set expanded to match live App Router pages. |
| F-19 | PERFORMANCE_RISK | Global React Query `refetchOnWindowFocus: false` and 30s `staleTime` for all domains. | Partial: work-order, inventory, and asset list queries refetch on window focus; fleet gate uses 5s stale / 15s poll; FG review/QA queues silent-refresh on focus/visibility and 30s poll. Master/report defaults remain 30s. |
| F-20 | UX_GAP | Vehicle and asset pages had no FG context. Backend has no vehicle-keyed FG list API. | Partial: permission-gated “Open FG Digital Records” links only. Per-entity FG tabs remain BLOCKED_BACKEND. |
| F-21 | TECH_DEBT | Missing Lucide icons (`Bug`, `Rocket`, `LifeBuoy`) fell back to dashboard icon. | Fixed. |
| F-22 | UX_GAP | Dashboard quick links omitted permissions, so FG could be missing there too. | Fixed. |

### P3 / deferred

| ID | Class | Finding | Status |
| --- | --- | --- | --- |
| F-23 | TECH_DEBT | Mega-components: `assets-management-page.tsx` (~2.6k), `fleet-map.tsx` (~2.4k), `vehicles/page.tsx` (~1.6k). | Not split. Bundle analysis not run (no analyzer). |
| F-24 | TECH_DEBT | CSP still includes tested `unsafe-inline` / `unsafe-eval`. | Unchanged by design. |
| F-25 | TECH_DEBT | Legacy FMS archive vs canonical `/vehicles` + `/work-orders`. Dead `legacy-maintenance-jobs-board.tsx`. | Not consolidated until parity is proven. |
| F-26 | BLOCKED_BACKEND | Unified cross-domain entity timeline. | No frontend invention. |
| F-27 | BLOCKED_BACKEND | Vehicle/asset-keyed FG record lists. | Link-only until Django/Nest contract exists. |
| F-28 | BLOCKED_BACKEND | Global entity search API (assets, vehicles, WO numbers, FG records). | Palette jumps to existing list search only. |
| F-29 | UX_GAP | PWA: `public/sw.js` + `/offline.html`; WO evidence localStorage queue only. No general offline mutation queue. | Unchanged. |
| F-30 | UX_GAP | FG E2E is skipped unless `FG_E2E=1`, then `test.fail`. Skip is not PASS. | Unchanged. Tenant-switch Playwright spec added and passed locally against the Next.js webServer (not a full 72-test suite). |
| F-31 | BLOCKED_BUSINESS_DECISION | FG Next.js flag stays off until E2E + UAT. Django JSON API now honours CL18/CL30 occurrence tokens; CL24 remains one/day. | Source parity landed; flag still off. |
| F-32 | ACCESSIBILITY_GAP | Field-user mobile is still largely desktop-shrunk except work-order queue cards. | Partial via loading/error/tenant/focus-trap; no visual redesign. |

## Domain notes

### Navigation and role dashboards

Canonical nav is `lib/navigation.ts` + sidebar + mobile drawer + bottom nav. Role dashboards in `role-dashboard.tsx` use live module summaries and do not invent KPIs. Action Center now includes FG workflow links when `fg.access` is present.

### Cache / tenant isolation

Isolation now relies on (1) `queryClient.clear()` after a successful tenant switch and (2) tenant id in work-order, inventory, and asset query keys. Fleet gate keys are also tenant-scoped. Other domains still omit tenant from keys; `clear()` is the backstop.

### Forms / tables / dialogs

FG structured field errors now render next to the field, including repeated/child fields. FG radios use fieldset/legend. FG vehicle combobox semantics were corrected. DataTable sort ARIA is on the column header. Modal surfaces trap and restore focus.

### Performance

No bundle analysis in this pass. No mega-component splits. Domain refetch-on-focus / short staleTime added only for live operational queues (work orders, inventory, assets, fleet gate, FG review/QA).

### Print / export / charts / maps

Not redesigned. Existing print paths (FG `printPath`) and asset/inventory export remain. Fleet map left intact.

## Remaining after this pass

- **P0 remaining:** none in frontend code that this audit could fix without Django/production changes. FG BFF still depends on `FG_API_INTERNAL_URL` being set when the Next.js UI is enabled.
- **P1 remaining:** no global entity search API; no vehicle/asset FG record lists; FG E2E not executable here unless `FG_E2E=1` plus a disposable FG stack; field-user mobile task-first layout not redesigned (bottom nav still 5 slots; FG Records appears only when work orders are hidden).
- **Do not enable FG Next.js in production until FG_E2E, AUTH/SSO/CSRF, and business UAT pass.** Django JSON occurrence-token parity is in source on this branch.
