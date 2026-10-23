import { formatEnumLabel } from "./display-labels";

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

/** Gate-out is the only movement that waits on block reasons. Other statuses must not stay on "Checking…". */
export function gateReadinessLabel(input: {
  action: "out" | "in" | null;
  reasons: { blocked: boolean } | null;
  reasonsError: string | null;
}): string {
  if (input.reasonsError) return input.reasonsError;
  if (input.action !== "out") return input.action === "in" ? "Gate in does not use the block check" : "Unavailable";
  if (!input.reasons) return "Checking…";
  return input.reasons.blocked ? "Blocked" : "Ready";
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

/**
 * Link for a block reason, or null. Pass `canOpen` (the viewer's route access) so a security
 * officer never gets a link to a page that would refuse them; the reason then shows as text.
 */
export function gateReasonHref(
  reason: string,
  vehicleId: string,
  registration: string,
  canOpen?: (path: string) => boolean
): string | null {
  const href = rawGateReasonHref(reason, vehicleId, registration);
  if (!href || !canOpen) return href;
  return canOpen(href.split("?")[0] ?? href) ? href : null;
}

function rawGateReasonHref(reason: string, vehicleId: string, registration: string): string | null {
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

/** Block reason in plain words: no raw codes such as UNDER MAINTENANCE or ACCIDENT_REPAIR. */
export function gateReasonText(reason: string): string {
  const trimmed = reason.trim();
  const status = trimmed.match(/^Vehicle status is (.+)$/i);
  if (status) {
    const code = status[1].trim().toUpperCase().replace(/\s+/g, "_");
    if (code === "UNDER_MAINTENANCE") return "Vehicle is in the workshop";
    if (code === "IN_USE") return "Vehicle is already outside";
    return `Vehicle is ${formatEnumLabel(code).toLowerCase()}`;
  }
  if (/gate block flag|manual gate hold/i.test(trimmed)) return "Vehicle is on gate hold";
  return trimmed.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[A-Z]{4,}\b/g, (code) =>
    /^WO$/.test(code) ? code : formatEnumLabel(code)
  );
}

/** "What to do next" for one block reason: who can clear or release it. */
export function gateReasonNextStep(reason: string): string {
  const text = reason.toLowerCase();
  if (text.includes("service")) return "Vehicle service is overdue. Ask the fleet manager to book the service or release the vehicle.";
  if (/wo-\d|work order|job/.test(text)) return "An open repair job is on this vehicle. Ask the maintenance manager to finish the job or release the vehicle.";
  if (text.includes("accident")) return "An accident case is open. Ask the fleet manager to close it.";
  if (/document|insurance|licen[cs]e|compliance|expired|expiring|permit/.test(text)) {
    return "A vehicle document is missing or out of date. Ask the fleet manager to update it.";
  }
  if (/gate hold|gate block/.test(text)) return "The vehicle is on gate hold. Ask the fleet manager to remove the hold.";
  if (text.includes("under maintenance") || text.includes("workshop")) return GATE_IN_WORKSHOP_TEXT;
  return "Ask the fleet manager or the maintenance manager to check this vehicle.";
}

/** Unique next steps for a list of block reasons, in the order they appear. */
export function gateNextSteps(reasons: readonly string[]): string[] {
  return [...new Set(reasons.map(gateReasonNextStep))];
}

export const GATE_IN_WORKSHOP_TEXT = "In workshop — gate in/out is handled when the job is closed.";

/** Why a vehicle has no gate button, in plain words. */
export function gateNoActionText(status?: string | null): string {
  if (status === "UNDER_MAINTENANCE") return GATE_IN_WORKSHOP_TEXT;
  if (status === "OUT_OF_SERVICE") return "Out of service — ask the fleet manager before this vehicle moves.";
  if (status === "DISPOSED") return "Disposed — this vehicle no longer uses the gate.";
  return "This vehicle cannot use the gate now. Ask the fleet manager.";
}

/** The "Next" column: Gate out, Gate in, or a short reason there is no action. */
export function gateNextLabel(status?: string | null): string {
  const action = gateActionForStatus(status);
  if (action === "out") return "Gate out";
  if (action === "in") return "Gate in";
  if (status === "UNDER_MAINTENANCE") return "Wait for job to close";
  return "No gate action";
}

/** Roles the API accepts as the releasing approver (VehiclesService.assertGateOverrideApprover). */
const GATE_OVERRIDE_APPROVER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "FLEET_MANAGER",
  "FARM_OWNER",
  "FARM_MANAGER"
]);

/**
 * Who sees the override action. POST /vehicles/:id/gate-out needs gate.out.create. Approvers
 * release at once; everyone else sends the override for approval (GATE_OVERRIDE rule).
 */
export function gateOverrideMode(
  role: string | null | undefined,
  permissions: readonly string[]
): "release" | "request" | null {
  const normalized = (role ?? "").trim().toUpperCase();
  if (!normalized) return null;
  const granted = new Set(permissions.map((key) => key.trim()));
  const isAdmin = normalized === "SUPER_ADMIN" || normalized === "ADMIN";
  if (!isAdmin && !granted.has("gate.out.create")) return null;
  if (GATE_OVERRIDE_APPROVER_ROLES.has(normalized) || granted.has("gate.override.approve")) return "release";
  return "request";
}

export type GateOverrideOutcome =
  | { kind: "released"; message: string }
  | { kind: "pending"; message: string }
  | { kind: "error"; message: string };

/** Turn the gate-out override response or error into one plain message. */
export function gateOverrideOutcome(input: {
  allowed?: boolean;
  errorCode?: string | null;
  errorStatus?: number | null;
  errorMessage?: string | null;
}): GateOverrideOutcome {
  if (input.allowed) return { kind: "released", message: "Override approved. Gate out recorded." };
  if (input.errorCode === "APPROVAL_REQUIRED") {
    return {
      kind: "pending",
      message: "Override request sent. A manager must approve it. After approval, press Request override again to gate out."
    };
  }
  if (input.errorStatus === 403) {
    return {
      kind: "error",
      message: "You cannot release this vehicle yourself. Ask the fleet manager or maintenance manager to release it."
    };
  }
  return { kind: "error", message: input.errorMessage?.trim() || "Override could not be sent." };
}
