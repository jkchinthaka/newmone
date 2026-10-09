/** Filters for /work-orders/my. Home cards and the My Jobs tabs share this list. */

export const MY_JOB_FILTERS = [
  "active",
  "due-today",
  "overdue",
  "waiting-parts",
  "evidence-needed",
  "rework-required",
  "in-progress",
  "completed"
] as const;

export type MyJobFilter = (typeof MY_JOB_FILTERS)[number];

const FILTER_SET = new Set<string>(MY_JOB_FILTERS);

export function isMyJobFilter(value: string | null | undefined): value is MyJobFilter {
  return FILTER_SET.has(value ?? "");
}

/**
 * Home cards use `filter`. Older links use `view`. `filter` wins when both are set.
 * Unknown values fall back to the full assigned list.
 */
export function resolveMyJobFilter(search: {
  filter?: string | null;
  view?: string | null;
}): MyJobFilter {
  const filter = search.filter?.trim();
  if (isMyJobFilter(filter)) return filter;
  const view = search.view?.trim();
  if (isMyJobFilter(view)) return view;
  return "active";
}

export function myJobFilterHref(filter: MyJobFilter = "active"): string {
  if (filter === "active") return "/work-orders/my";
  return `/work-orders/my?filter=${filter}`;
}
