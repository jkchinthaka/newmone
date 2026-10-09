const WORK_ORDER_TABS = [
  "overview",
  "assignment",
  "parts",
  "safety",
  "evidence",
  "vendor-repair",
  "history",
  "audit"
] as const;

export type WorkOrderDeepLinkTab = (typeof WORK_ORDER_TABS)[number];

export function workOrderRecordHref(id: string, tab?: string): string {
  const params = new URLSearchParams({ wo: id });
  if (tab && isWorkOrderDeepLinkTab(tab) && tab !== "overview") params.set("tab", tab);
  return `/work-orders?${params.toString()}`;
}

export function isWorkOrderDeepLinkTab(value: string | null | undefined): value is WorkOrderDeepLinkTab {
  return Boolean(value && (WORK_ORDER_TABS as readonly string[]).includes(value));
}

/** `wo` is canonical. `open` is the older exceptions-report alias. */
export function parseWorkOrderRecordLink(params: {
  wo?: string | null;
  open?: string | null;
  tab?: string | null;
}): { id?: string; tab?: WorkOrderDeepLinkTab } {
  const id = params.wo?.trim() || params.open?.trim() || "";
  return {
    id: id || undefined,
    tab: isWorkOrderDeepLinkTab(params.tab) ? params.tab : undefined
  };
}

export const PM_DUE_SOON_HREF = "/maintenance/plans?due=soon";

/**
 * Activity and evidence files render on Evidence.
 * Overview only needs the requirements summary for supervisor verification.
 * History fetches its own endpoint.
 */
export function workOrderTabLoads(tab: string | null | undefined): {
  activity: boolean;
  evidence: boolean;
  requirements: boolean;
} {
  const evidenceTab = tab === "evidence";
  return {
    activity: evidenceTab,
    evidence: evidenceTab,
    requirements: tab === "overview" || evidenceTab
  };
}

export function visibleWorkOrderTab(
  tab: WorkOrderDeepLinkTab | undefined,
  canViewAudit: boolean
): WorkOrderDeepLinkTab {
  if (!tab || tab === "overview") return "overview";
  if (tab === "audit" && !canViewAudit) return "overview";
  return tab;
}

/** `wo` wins. A leftover `open` alias is removed so the URL stays canonical. */
export function canonicalizeWorkOrderSearch(query: URLSearchParams): URLSearchParams {
  const open = query.get("open");
  if (open && !query.get("wo")) query.set("wo", open);
  query.delete("open");
  return query;
}
