# UI redesign

Presentational only. APIs, RBAC, tenant isolation, stock transactions, and maintenance workflows stay as they are.

## Tokens

- Brand green stays `#176B3A` (`brand-500` through `brand-700`). Deep green `#104D2B` is `brand-800`.
- Neutrals are Tailwind slate. Ink text is slate-900 on white.
- Status: slate neutral, sky planned/assigned, brand in progress, amber hold/pending, red rework/overdue/rejected, emerald verified/closed/approved.
- Type: page title `text-xl font-semibold`, section title `text-sm font-semibold`, KPI value `text-2xl`.
- Space: page stack `space-y-4`, card padding `p-4`, radius `rounded-card` (0.75rem), shadow `shadow-card`.
- Light theme only. `dark:` styles apply only when a `dark` class is present, and the app does not add that class. Focus uses `focus-visible:outline-brand-600`.

## Components (`components/ui/dashboard`)

KpiCard, StatusBadge, QueueChip, SectionCard, PageShell, DataTable (same props as `components/ui/data-table`), EmptyState, ErrorState, SkeletonCard, Tracker, BarList, Spark.

Existing pages are unchanged in this step. Later areas swap JSX only and keep labels, hooks, and click targets.

## Source

Layout patterns follow Tremor Blocks (MIT, https://blocks.tremor.so), rewritten for Tailwind 3. No Tremor package is installed.

## Next

Maintenance dashboard (`/maintenance`): KPI cards, priority table, workload chips, domain BarList, pipeline cards. Same queries.

15/06 My Jobs (`/work-orders/my`) | `work-orders/my/page.tsx`, `components/ui/dashboard/*`, `lib/dashboard-status.ts` | hidden: Scan asset QR, Waiting for parts, Completed this week (loaded rows have no parts flag or completed-at).
16 Requests (`/requests`) | `requests/page.tsx` | hidden: none (stage cards and status chips use loaded summary and existing status filters).
17 Preventive Maintenance (`/maintenance/plans`) | `maintenance/plans/page.tsx` | hidden: compliance KPI (no compliance figure on the loaded summary).
18 Inspection (`/maintenance/inspections`, `/maintenance/inspections/[id]`) | both inspection pages | hidden: Pass/Fail/N/A buttons and Create work order from failure (checklist answers stay free-text inputs; no create-from-failure action).
19 Gate (`/fleet/gate`) | `fleet-gate-panel.tsx` | hidden: Scan QR; site-wide Today at the gate (history stays the per-vehicle list already loaded on demand).
20 Register vehicle (`/admin/vehicles/new`) | `admin/vehicles/new/page.tsx` | hidden: ownership, mileage, asset-tag link (not on this form). Payload sends selected type and fuelType.
21 Reports (`/reports`) | `reports-dashboard-page.tsx` | hidden: site filter and the named downtime library (not in this page's filters or module list). KPI cards and bars use summaryCards and charts already returned.
22 Admin Console (`/admin`) | `admin-console-page.tsx` | hidden: Assets, Vehicles, Pending invitations counts (overview has users, tenants, jobs, approvals, imports, data issues).
23 Users (`/admin/users`) | `admin-users-page.tsx`, `user-access-table.tsx` | hidden: department column (not on the loaded user row). Group chips use loaded role counts.
24 Roles (`/admin/roles`) | `admin-roles-page.tsx`, `permission-group-card.tsx` | hidden: none. Matrix stays read-only checkmarks; editing stays the existing role editor.
25 Maintenance settings | `maintenance-config/page.tsx`, `maintenance-settings-nav.tsx`, job categories, priority SLA, approval rules, reason codes, fault codes, work permits | hidden: currency, time zone, work week (no fields). Tax rate and Save stay.
e2e: run in CI later
NEXT: screenshots if the app is up; otherwise stop after checks.
