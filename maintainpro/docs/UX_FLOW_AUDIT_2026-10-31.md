# MaintainPro — UX / Flow Audit and Revamp Proposal

Date: 2026-10-31 · Branch: `release/develop-20261022b` · Scope: `apps/web` (static code review only)

**Not done:** no browser walkthrough, no analytics, no user interviews. Everything below comes from reading
the source. Click counts are estimates from the code, not measured. Validate with 3–5 real users per role
before building.

## 1. Where the product already is good (keep)

- Role-based landing (`lib/role-redirect.ts`): technicians land on **My Jobs**, managers on **Maintenance**.
- Menu is already trimmed by role (`menuHiddenFor`), with a command palette and mobile bottom nav.
- Report-a-problem is a guided 5-step wizard with QR/tag scan and a review step (`requests/new`).
- Completing a job shows a checklist of what is still missing (photos, QR, parts) with "Go to…" shortcuts.
- Touch targets are `min-h-11/12`; My Jobs has big Start/Continue buttons.

## 2. Findings (busiest-user view)

### A. Too much product surface for the job (High)
193 `page.tsx` routes. About 70 belong to modules the code itself calls *retired* or off the primary scope:
farm (13), cleaning (7), go-live (9), post-go-live (6), qa (6), delivery-readiness (4), `(fms)` legacy (12),
billing, predictive-ai, releases, support, plus `erp` (9) and `master-data` (4). They are hidden from the menu
but still reachable by URL, bookmark, search and the command palette, and they cost build time, tests and
review effort.
**Revamp:** delete or move behind a feature flag; keep only the CMMS + fleet core.

### B. Requesting a repair takes 5 steps (High)
Target → Where/what → Describe → Priority/options (3 selects) → Review → Send. A busy user, or a security
officer on a phone, must tap Next 4 times before sending.
**Revamp:** one screen: scan/choose asset, one text box, photo, Send. Priority defaults to Normal; the extra
selects go under "More details". Keep the 5-step wizard only for facility/"not sure" cases. Target: 2–3 taps
after scanning a QR.

### C. Work-order detail is a tab maze (High)
8 tabs: Overview, Assignment, Parts, Machine stopped time, Photos, Vendor repair, History, Audit. A technician
only needs: what is wrong, Start, add photo/parts, Complete. Admin tabs (History, Audit, Vendor repair) sit at
the same level as the daily ones.
Correction: the job drawer footer already stays pinned and shows the next step button
(`work-order-editor-modal.tsx`), so a sticky action bar is not needed.
**Revamp:** still reduce tabs: move History/Audit/Vendor repair into a "More" menu for supervisors.

### D. Raw database ids typed by users (High, already noted in handover) — DONE
Done 2026-10-31: asset id is now a searchable machine picker; Owner id is now "All owners / Only mine"
(no user lookup, because `/users` needs `users.view`, which reliability viewers may not have). A full owner
picker needs a reliability-scoped user lookup endpoint (API change). Original finding:
`reliability-workbench.tsx` asks for "Owner id" and "Asset id". People do not know ids. Needs asset and
user pickers (the work-order form already has asset/vehicle search to reuse).

### E. Duplicate concepts and names (Medium)
- Work Orders / Jobs / Maintenance Dashboard / My Jobs / Requests / My Requests / Approvals are seven entries
  for one pipeline (request → approve → job → verify).
- Three job lanes (Machinery / Service / Vehicle) plus a "Jobs" page plus `/work-orders` plus the legacy board.
- Machines & Equipment, Vehicles, Sites & Locations, Add Assets, Add Vehicle, Assign QR Tags: asset
  data is split across several places.
**Revamp:** one "Work" hub (Requests → Approvals → Jobs as one pipeline with stage chips) and one "Assets"
hub (machines, vehicles, sites as filters, one "Add" button).

### F. Raw browser dialogs (Low) — DONE
Correction: the first count of ~22 was a loose grep. Only 2 real `window.confirm/prompt` calls existed
(reliability tab leave, maintenance template revise). Both now use the app's confirm/prompt dialogs.

### G. Filters and lists (Medium)
Good progress (More filters on Inventory, Reports, Breakdowns). Remaining: save a user's last filter per list
(`list-query-state.ts` exists, use it everywhere), add bulk actions on Requests/Approvals (approve 10 in one
click), and add inline row actions (Start/Assign/Approve) so the user need not open a detail page.

### H. Dashboards say "what", not "do" (Medium)
Maintenance dashboard shows KPIs that link to lists. A busy manager wants a short **to-do inbox**: "3 requests
to approve, 2 jobs waiting for parts, 1 overdue" with the action button on each row.

### I. Very large page files (Maintainability)
`vehicles/page.tsx` 1681 lines, `vehicles/[id]` 1343, `work-orders-page.tsx` 1233, `requests/new` 950,
`requests` 898. These slow UX iteration and are risky to change. Split into smaller components as each
screen is revamped.

### J. Naming consistency (Low)
Mixed vocabulary: "Machine stopped time", "Breakdowns & Causes", "Scheduled Service" vs
"Preventive Maintenance" in code and docs, "Outside Repairs" vs "Vendor repair". Pick one glossary and apply
it in menu, titles, buttons.

## 3. Proposed information architecture

| Role | Home | Primary nav (max 5) |
| --- | --- | --- |
| Technician / Mechanic | My Jobs | My Jobs · Report Problem · Parts · Notifications |
| Supervisor / Manager | Inbox (to-do) | Inbox · Work (requests+jobs) · Assets · Reports |
| Requester / Security | Report Problem | Report Problem · My Requests |
| Store / Procurement | Parts | Parts · Orders · Suppliers |
| Admin | Inbox | Work · Assets · Reports · Admin |

## 4. Click targets (estimate → goal)

| Task | Now (est.) | Goal |
| --- | --- | --- |
| Report a breakdown after QR scan | 6–8 taps | 3 |
| Technician starts a job | 2–3 | 1 (button on My Jobs row) |
| Complete a job with photo | 5–7 | 3 |
| Manager approves a request | open, review, approve ≈ 4 | 1 (inline) |
| Find a machine's history | menu → assets → search → open → tab ≈ 5 | 2 (palette or QR) |

## 5. Phased plan

1. **Quick wins (days):** replace raw-id inputs with pickers; replace `confirm/prompt`; default
   priority; sticky Start/Complete bar on job detail; remember filters.
2. **Core flow (1–2 sprints):** one-screen quick report; job card redesign; inline row actions and bulk
   approve; manager Inbox home.
3. **Consolidation (2–3 sprints):** merge Work and Assets hubs; one glossary.
4. **Cleanup (parallel):** remove retired modules (farm, cleaning, go-live, qa, delivery-readiness, legacy
   `(fms)`), after confirming nothing in production uses them.

## 6. Risks and checks before building

- Removing retired routes: confirm with the owner and check tests that read `go-live/*` and `sop/*` docs
  (handover says some tests depend on them).
- Navigation changes need updates to `navigation.spec` and `role-redirect` tests.
- RBAC is enforced by the API; any new inline action must call the existing guarded endpoints.
- Needs UAT with real technicians on phones before release.

## 7. Quick wins status (2026-10-31)

| Item | Status |
| --- | --- |
| Raw ids to pickers (Breakdowns & Causes) | Done (owner = All/Only mine) |
| Raw browser dialogs | Done (2 found, both replaced) |
| Sticky job action bar | Not needed, already pinned |
| Default priority / remember filters | Not started |
| Checks | `tsc --noEmit` clean; web unit tests: 3 fail in files not touched (vehicles, jobs queue, add-location source-string tests), caused by CRLF checkout (`core.autocrlf=true`), not by this change |
