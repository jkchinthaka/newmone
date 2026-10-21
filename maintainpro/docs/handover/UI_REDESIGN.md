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
