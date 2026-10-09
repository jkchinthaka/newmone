export const FLEET_EMPTY = "No fleet records match these filters.";

export const FLEET_VIEWS = ["vehicles", "gate", "accidents", "claims", "fines", "compliance"] as const;

export type FleetView = (typeof FLEET_VIEWS)[number];

export const FLEET_PAGE_SIZES = [25, 50, 100] as const;

export type FleetServiceFilter = "" | "overdue" | "due-soon" | "current";

export type FleetState = {
  view: FleetView;
  q: string;
  status: string;
  service: FleetServiceFilter;
  gate: "" | "blocked" | "ready";
  location: string;
  expiry: "" | "30d";
  repair: "" | "open";
  claimStatus: string;
  fineStatus: string;
  page: number;
  pageSize: number;
};

const SERVICES = new Set(["overdue", "due-soon", "current"]);
const STATUSES = new Set(["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DISPOSED"]);

export function fleetStateFromSearch(params: URLSearchParams): FleetState {
  const viewRaw = params.get("view") ?? "vehicles";
  const service = params.get("service") ?? "";
  const gate = params.get("state") ?? "";
  const status = params.get("status") ?? "";
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  return {
    view: (FLEET_VIEWS as readonly string[]).includes(viewRaw) ? (viewRaw as FleetView) : "vehicles",
    q: params.get("q") ?? "",
    status: STATUSES.has(status) ? status : "",
    service: SERVICES.has(service) ? (service as FleetServiceFilter) : "",
    gate: gate === "blocked" || gate === "ready" ? gate : "",
    location: params.get("location") ?? "",
    expiry: params.get("expiry") === "30d" ? "30d" : "",
    repair: params.get("repair") === "open" ? "open" : "",
    claimStatus: params.get("claimStatus") ?? "",
    fineStatus: params.get("fineStatus") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: (FLEET_PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : 25
  };
}

export function fleetSearch(state: FleetState): string {
  const params = new URLSearchParams();
  if (state.view !== "vehicles") params.set("view", state.view);
  if (state.q) params.set("q", state.q);
  if (state.status) params.set("status", state.status);
  if (state.service) params.set("service", state.service);
  if (state.gate) params.set("state", state.gate);
  if (state.location) params.set("location", state.location);
  if (state.expiry) params.set("expiry", state.expiry);
  if (state.repair) params.set("repair", state.repair);
  if (state.claimStatus) params.set("claimStatus", state.claimStatus);
  if (state.fineStatus) params.set("fineStatus", state.fineStatus);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 25) params.set("pageSize", String(state.pageSize));
  return params.toString();
}

export function fleetKpiTarget(
  metric: "overdue" | "due" | "docs" | "gate" | "repairs" | "out",
  pageSize = 25
): FleetState {
  const base = fleetStateFromSearch(new URLSearchParams());
  const size = (FLEET_PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : 25;
  if (metric === "overdue") return { ...base, view: "vehicles", service: "overdue", pageSize: size };
  if (metric === "due") return { ...base, view: "vehicles", service: "due-soon", pageSize: size };
  if (metric === "docs") return { ...base, view: "compliance", expiry: "30d", pageSize: size };
  if (metric === "gate") return { ...base, view: "gate", gate: "blocked", pageSize: size };
  if (metric === "repairs") return { ...base, view: "accidents", repair: "open", pageSize: size };
  return { ...base, view: "vehicles", status: "OUT_OF_SERVICE", pageSize: size };
}

export function fleetVehicleHref(id: string): string {
  return `/vehicles/${id}`;
}

export function fleetNextAction(input: {
  status?: string | null;
  nextServiceDate?: string | null;
  insuranceExpiry?: string | null;
  roadTaxExpiry?: string | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const end = now.getTime() + 30 * 24 * 60 * 60 * 1000;
  const service = input.nextServiceDate ? new Date(input.nextServiceDate).getTime() : null;
  if (service != null && service < now.getTime()) return "Service overdue";
  if (service != null && service <= end) return "Due soon";
  const docTimes = [input.insuranceExpiry, input.roadTaxExpiry]
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime());
  if (docTimes.some((time) => time >= now.getTime() && time <= end)) return "Document expiry";
  if (input.status === "OUT_OF_SERVICE") return "Out of service";
  return "Ready";
}

export function fleetServiceLabel(_service?: string | null, nextServiceDate?: string | null, now = new Date()): string {
  const fromDate = fleetNextAction({ nextServiceDate, now });
  if (fromDate === "Service overdue") return "Overdue";
  if (fromDate === "Due soon") return "Due soon";
  return "Current";
}
