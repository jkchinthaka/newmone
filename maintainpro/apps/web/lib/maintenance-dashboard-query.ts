import { isDatabaseUnavailableError } from "@/lib/api-client";
import { isUpstreamUnavailableError, shouldRetryQuery } from "@/lib/upstream-status";

const TERMINAL_STATUSES = new Set([401, 403, 503]);

export function maintenanceQueryStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const status = (error as { response?: { status?: number } }).response?.status;
  return typeof status === "number" ? status : null;
}

/** Auth, permission, and unavailable responses must not keep retrying. */
export function shouldRetryMaintenanceQuery(failureCount: number, error: unknown): boolean {
  // A restarting API is transient; a database outage or auth failure is not.
  if (isUpstreamUnavailableError(error)) {
    return shouldRetryQuery(failureCount, error);
  }
  const status = maintenanceQueryStatus(error);
  if ((status != null && TERMINAL_STATUSES.has(status)) || isDatabaseUnavailableError(error)) {
    return false;
  }
  return failureCount < 1;
}

/**
 * Keep polling after a transient failure (the next poll may succeed; the page keeps its last data).
 * Stop only for terminal errors (401/403/503, database unavailable) that polling cannot fix.
 */
export function maintenanceRefetchInterval(query: { state: { error: unknown } }): number | false {
  const error = query.state.error;
  if (error && !shouldRetryMaintenanceQuery(0, error)) return false;
  return 60_000;
}
