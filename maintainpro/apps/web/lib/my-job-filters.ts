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

/** Display copy for the selected My Jobs tab. The API still decides membership. */
export function myJobPurpose(filter: MyJobFilter): string {
  switch (filter) {
    case "active":
      return "Jobs assigned to you that are not completed, closed, or cancelled.";
    case "due-today":
      return "Assigned jobs whose due date falls on today.";
    case "overdue":
      return "Assigned jobs that are past due, or marked overdue, and are not finished.";
    case "waiting-parts":
      return "Assigned jobs that are not finished and still have a parts request, issue, or return.";
    case "evidence-needed":
      return "Assigned jobs that are not finished and are missing required photos, or have rejected photos.";
    case "rework-required":
      return "Assigned jobs sent back to be fixed again.";
    case "in-progress":
      return "Assigned jobs that are in progress.";
    case "completed":
      return "Assigned jobs that are completed or closed.";
    default:
      return "";
  }
}
