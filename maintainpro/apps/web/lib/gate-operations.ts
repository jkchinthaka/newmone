export const GATE_EMPTY = "No fleet records match these filters.";

export type GatePresence = "" | "inside" | "outside";

export type GateDeskState = {
  q: string;
  presence: GatePresence;
  status: string;
  service: "" | "overdue";
  location: string;
  vehicleId: string;
  page: number;
  pageSize: number;
};

const STATUSES = new Set(["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DISPOSED"]);
const PAGE_SIZES = new Set([25, 50, 100]);

export function gateDeskFromSearch(params: URLSearchParams): GateDeskState {
  const presence = params.get("presence") ?? "";
  const status = params.get("status") ?? "";
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  return {
    q: params.get("q") ?? "",
    presence: presence === "inside" || presence === "outside" ? presence : "",
    status: STATUSES.has(status) ? status : "",
    service: params.get("service") === "overdue" ? "overdue" : "",
    location: params.get("location") ?? "",
    vehicleId: params.get("vehicle") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZES.has(pageSize) ? pageSize : 25
  };
}

export function gateDeskSearch(state: GateDeskState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.presence) params.set("presence", state.presence);
  if (state.status) params.set("status", state.status);
  if (state.service) params.set("service", state.service);
  if (state.location) params.set("location", state.location);
  if (state.vehicleId) params.set("vehicle", state.vehicleId);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 25) params.set("pageSize", String(state.pageSize));
  return params.toString();
}

/** Inside means Available. Outside means In Use. Other statuses are not a gate movement. */
export function gateActionForStatus(status?: string | null): "out" | "in" | null {
  if (status === "AVAILABLE") return "out";
  if (status === "IN_USE") return "in";
  return null;
}

export function gatePresenceLabel(status?: string | null): string {
  if (status === "AVAILABLE") return "Inside";
  if (status === "IN_USE") return "Outside";
  return "Unavailable";
}

export function gateListStatus(state: GateDeskState): string | undefined {
  if (state.status) return state.status;
  if (state.presence === "inside") return "AVAILABLE";
  if (state.presence === "outside") return "IN_USE";
  return undefined;
}

export function gateMeterError(raw: string, previous: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Enter a meter reading.";
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return "Meter reading must be a number.";
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return "Meter reading cannot be negative.";
  if (value < previous) return "Meter reading cannot be lower than the current odometer.";
  return null;
}

export function splitGateReasons(blockedReason?: string | null): string[] {
  if (!blockedReason?.trim()) return [];
  return blockedReason.split(";").map((part) => part.trim()).filter(Boolean);
}

export function gateReasonHref(reason: string, vehicleId: string, registration: string): string | null {
  const text = reason.toLowerCase();
  if (text.includes("service")) return `/vehicles/${vehicleId}`;
  if (text.includes("document") || text.includes("insurance") || text.includes("compliance") || text.includes("expired")) {
    return `/fleet?view=compliance&q=${encodeURIComponent(registration)}`;
  }
  const workOrder = reason.match(/WO-\d{4}-\d+/i);
  if (workOrder) return `/work-orders?q=${encodeURIComponent(workOrder[0])}`;
  if (text.includes("accident")) return `/fleet?view=accidents&repair=open`;
  if (text.includes("status") || text.includes("gate hold")) return `/vehicles/${vehicleId}`;
  return null;
}
