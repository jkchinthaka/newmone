export type HealthCheckStatus =
  | "operational"
  | "degraded"
  | "failed"
  | "mock"
  | "misconfigured"
  | "unconfigured"
  | "disabled"
  | "unavailable";

export type HealthCheckInput = {
  key: string;
  label: string;
  status: HealthCheckStatus;
  message?: string;
  action?: string;
};

export type CompactHealthRow = {
  id: string;
  label: string;
  status: HealthCheckStatus;
  detail: string;
};

const ROW_DEFS: Array<{ id: string; label: string; keys: string[] }> = [
  { id: "api", label: "API", keys: [] },
  { id: "database", label: "Database", keys: ["primaryDatabase"] },
  { id: "redis", label: "Redis", keys: ["redis"] },
  { id: "storage", label: "Object storage", keys: ["objectStorage", "storage"] },
  { id: "messaging", label: "Email / SMS", keys: ["email", "sms"] },
  { id: "erp", label: "ERP integration", keys: ["erp"] }
];

const RANK: Record<HealthCheckStatus, number> = {
  failed: 6,
  misconfigured: 5,
  degraded: 4,
  mock: 3,
  unconfigured: 2,
  unavailable: 2,
  disabled: 1,
  operational: 0
};

export const HEALTH_STATUS_LABELS: Record<HealthCheckStatus, string> = {
  operational: "Operational",
  degraded: "Needs attention",
  failed: "Failed",
  mock: "Mock",
  misconfigured: "Misconfigured",
  unconfigured: "Not configured",
  disabled: "Disabled",
  unavailable: "Not reported"
};

function combinedStatus(statuses: HealthCheckStatus[]): HealthCheckStatus {
  const active = statuses.filter((status) => status !== "disabled");
  return worstStatus(active.length > 0 ? active : statuses);
}

function worstStatus(statuses: HealthCheckStatus[]): HealthCheckStatus {
  return statuses.reduce<HealthCheckStatus>(
    (current, status) => (RANK[status] > RANK[current] ? status : current),
    "operational"
  );
}

export function compactSystemHealthRows(
  checks: HealthCheckInput[],
  overall: "operational" | "degraded" | undefined
): CompactHealthRow[] {
  return ROW_DEFS.map((row) => {
    if (row.id === "api") {
      const degraded = overall === "degraded";
      return {
        id: row.id,
        label: row.label,
        status: degraded ? "degraded" : "operational",
        detail: degraded ? "One or more required checks need attention." : "Responding."
      };
    }

    const matched = checks.filter((check) => row.keys.includes(check.key));
    if (matched.length === 0) {
      return {
        id: row.id,
        label: row.label,
        status: "unavailable",
        detail: "Not reported by the latest health check."
      };
    }

    const status = combinedStatus(matched.map((check) => check.status));
    const detail = matched
      .map((check) => check.action || check.message)
      .filter((value): value is string => Boolean(value))
      .join(" ");
    return { id: row.id, label: row.label, status, detail: detail || HEALTH_STATUS_LABELS[status] };
  });
}

export function configurationWarnings(checks: HealthCheckInput[]): Array<{ key: string; label: string; detail: string }> {
  return checks
    .filter((check) => check.status !== "operational" && check.status !== "disabled")
    .filter((check) => Boolean(check.action))
    .map((check) => ({
      key: check.key,
      label: check.label,
      detail: check.action as string
    }));
}
