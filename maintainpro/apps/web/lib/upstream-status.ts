/**
 * Client-side handling of a restarting or unreachable API (BFF 502/503/504).
 * Queries retry briefly; mutations never retry on their own — the user decides.
 */

export const UPSTREAM_RECONNECTING_MESSAGE = "Reconnecting to the server…";
export const UPSTREAM_UNAVAILABLE_USER_MESSAGE =
  "Server is restarting or unreachable. Your change was not saved — please try again.";

const RETRYABLE_QUERY_STATUSES = new Set([502, 503, 504]);
const UPSTREAM_CODES = new Set(["UPSTREAM_UNAVAILABLE", "UPSTREAM_TIMEOUT"]);
/** Retries after the first failure; three requests in total. */
export const QUERY_MAX_RETRIES = 2;

type ErrorShape = {
  code?: string;
  response?: { status?: number; data?: { error?: { code?: string } } };
};

function shape(error: unknown): ErrorShape {
  return error && typeof error === "object" ? (error as ErrorShape) : {};
}

export function errorStatus(error: unknown): number | null {
  const status = shape(error).response?.status;
  return typeof status === "number" ? status : null;
}

export function errorCode(error: unknown): string {
  return String(shape(error).response?.data?.error?.code ?? "").toUpperCase();
}

/** The BFF could not reach the API: restart, crash, or network. The change was not applied. */
export function isUpstreamUnavailableError(error: unknown): boolean {
  const candidate = shape(error);
  if (!candidate.response) {
    return candidate.code === "ERR_NETWORK";
  }
  const status = errorStatus(error);
  if (UPSTREAM_CODES.has(errorCode(error))) {
    return true;
  }
  return status === 502 || status === 504;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= QUERY_MAX_RETRIES) {
    return false;
  }
  const candidate = shape(error);
  if (!candidate.response) {
    return candidate.code === "ERR_NETWORK" || candidate.code === "ECONNABORTED";
  }
  const status = errorStatus(error);
  return status != null && RETRYABLE_QUERY_STATUSES.has(status);
}

export function queryRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}

let degraded = false;
const listeners = new Set<(degraded: boolean) => void>();

function setDegraded(next: boolean): void {
  if (degraded === next) return;
  degraded = next;
  for (const listener of listeners) listener(next);
}

export function markUpstreamDegraded(): void {
  setDegraded(true);
}

export function markUpstreamHealthy(): void {
  setDegraded(false);
}

export function getUpstreamDegraded(): boolean {
  return degraded;
}

export function subscribeUpstreamStatus(listener: (degraded: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
