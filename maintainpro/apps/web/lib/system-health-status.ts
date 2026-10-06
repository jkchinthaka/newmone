/**
 * System Health display guard. A service that is switched off must never read
 * "Operational" — it is Disabled (configured but off), Not configured, or Degraded.
 */
export type HealthCheckStatus =
  | "operational"
  | "degraded"
  | "failed"
  | "mock"
  | "misconfigured"
  | "unconfigured"
  | "disabled";

export function resolveDisplayCheckStatus(check: {
  status: HealthCheckStatus;
  details?: Record<string, unknown> | null;
}): HealthCheckStatus {
  if (check.status !== "operational") return check.status;
  const details = check.details ?? {};
  const mode = typeof details.mode === "string" ? details.mode.toLowerCase() : "";
  if (details.enabled === false || mode === "disabled") {
    return details.configured === false ? "unconfigured" : "disabled";
  }
  return check.status;
}
