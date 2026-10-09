export type PmPlanDraft = {
  name: string;
  assetId: string;
  vehicleId: string;
  trigger: string;
  intervalDays: string;
  intervalValue: string;
  activate: boolean;
};

/** Client checks before submit. The API remains the authority. */
export function pmPlanDraftError(draft: PmPlanDraft): string | null {
  if (draft.name.trim().length < 3) return "Enter a plan name.";
  if (draft.activate && !draft.assetId.trim() && !draft.vehicleId.trim()) {
    return "Select an asset or vehicle before activating the plan.";
  }
  if (draft.trigger !== "METER") {
    const days = Number(draft.intervalDays.trim());
    if (!draft.intervalDays.trim() || !Number.isFinite(days) || days <= 0) {
      return "Calendar interval must be greater than 0.";
    }
  }
  if (draft.trigger !== "CALENDAR") {
    const meter = Number(draft.intervalValue.trim());
    if (!draft.intervalValue.trim() || !Number.isFinite(meter) || meter <= 0) {
      return "Meter interval must be greater than 0.";
    }
  }
  return null;
}

export type PmPlanUrlState = {
  status?: string;
  due?: string;
  attention?: string;
  trigger?: string;
  q?: string;
  assetId?: string;
  autoWo?: string;
  page: number;
  pageSize: number;
};

/** Reads the PM list URL, including the older view= shortcuts. */
export function pmPlanStateFromSearch(params: URLSearchParams): PmPlanUrlState {
  const view = params.get("view");
  const status =
    params.get("status") ||
    (view === "active" ? "ACTIVE" : view === "paused" ? "INACTIVE" : view === "draft" ? "DRAFT" : "");
  const due =
    params.get("due") ||
    (view === "overdue" ? "overdue" : view === "due" ? "soon" : "");
  const attention = params.get("attention") || (view === "attention" ? "true" : "");
  const page = Math.max(Number(params.get("page") ?? "1") || 1, 1);
  const pageSizeRaw = Number(params.get("pageSize") ?? "25");
  const pageSize = pageSizeRaw === 50 || pageSizeRaw === 100 ? pageSizeRaw : 25;
  return {
    status: status || undefined,
    due: due || undefined,
    attention: attention === "true" ? "true" : undefined,
    trigger: params.get("trigger") || undefined,
    q: params.get("q") || undefined,
    assetId: params.get("assetId") || undefined,
    autoWo: params.get("autoWo") || undefined,
    page,
    pageSize
  };
}

export function pmPlanListParams(state: PmPlanUrlState): Record<string, string | number | undefined> {
  return {
    status: state.status,
    search: state.q,
    trigger: state.trigger,
    assetId: state.assetId,
    autoWo: state.autoWo,
    dueWindow: state.attention === "true" ? "attention" : state.due === "soon" ? "7" : state.due,
    page: state.page,
    pageSize: state.pageSize
  };
}
