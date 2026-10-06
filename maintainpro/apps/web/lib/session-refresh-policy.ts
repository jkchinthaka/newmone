/**
 * Client-side session refresh policy (QA-MANUAL-001).
 *
 * The browser must only send the user to /login when the session is *proven* invalid.
 * A refresh that fails for any other reason (409 conflict, 429 throttle, 403 stale CSRF,
 * 5xx, network) is transient: the session cookies may still be perfectly valid, so a
 * redirect would throw away unsaved form input for nothing.
 *
 * Pure functions + a tiny coordinator so the rules are unit-testable without axios/DOM.
 */

export type RefreshOutcome = "refreshed" | "invalid" | "transient";

/** API error codes that prove the refresh token can no longer be used. */
const INVALID_REFRESH_CODES = new Set([
  "AUTHENTICATION_REQUIRED",
  "REFRESH_TOKEN_REUSED",
  "SESSION_EXPIRED",
  "MEMBERSHIP_DISABLED",
  "TENANT_INACTIVE"
]);

/**
 * Map a failed POST /auth/refresh to an outcome.
 * - REFRESH_TOKEN_ROTATED: a sibling request rotated the token a moment ago and its
 *   response already stored new cookies -> treat as refreshed and retry.
 * - 401 with an invalid-token code, or 400 (no refresh cookie at all) -> invalid.
 * - Everything else (409, 429, 403 CSRF race, 5xx, network/no status) -> transient.
 */
export function classifyRefreshFailure(status: number | undefined, code: string | undefined): RefreshOutcome {
  const normalized = String(code ?? "").toUpperCase();
  if (normalized === "REFRESH_TOKEN_ROTATED") {
    return "refreshed";
  }
  if (status === 401) {
    return INVALID_REFRESH_CODES.has(normalized) || normalized === "" ? "invalid" : "transient";
  }
  if (status === 400) {
    return "invalid";
  }
  return "transient";
}

/**
 * Decide whether a 401 should end the session after the refresh attempt.
 * Redirect only when refresh said "invalid" AND an independent /auth/me probe also
 * returned 401. If the probe succeeds the session is still valid (QA-MANUAL-001).
 */
export function shouldRedirectToLogin(outcome: RefreshOutcome, probeStatus: number | undefined): boolean {
  return outcome === "invalid" && probeStatus === 401;
}

type Clock = () => number;

/**
 * Single-flight refresh coordinator:
 * - concurrent callers share one in-flight rotation (only one request owns rotation);
 * - callers whose 401 arrives just after a successful rotation (requests that were sent
 *   with the old cookie) reuse that result instead of rotating again.
 */
export function createRefreshCoordinator(
  runner: () => Promise<RefreshOutcome>,
  options: { reuseWindowMs?: number; now?: Clock } = {}
) {
  const reuseWindowMs = options.reuseWindowMs ?? 5_000;
  const now = options.now ?? (() => Date.now());
  let inFlight: Promise<RefreshOutcome> | null = null;
  let lastSuccessAt = Number.NEGATIVE_INFINITY;

  return {
    /** @param requestStartedAt when the failed request was sent (ms epoch). */
    refresh(requestStartedAt?: number): Promise<RefreshOutcome> {
      if (inFlight) {
        return inFlight;
      }
      const startedAt = requestStartedAt ?? now();
      if (startedAt <= lastSuccessAt && now() - lastSuccessAt <= reuseWindowMs) {
        // This request carried the pre-rotation cookie; the session was already rotated.
        return Promise.resolve("refreshed");
      }
      const pending = runner()
        .catch((): RefreshOutcome => "transient")
        .then((outcome) => {
          if (outcome === "refreshed") {
            lastSuccessAt = now();
          }
          return outcome;
        })
        .finally(() => {
          if (inFlight === pending) {
            inFlight = null;
          }
        });
      inFlight = pending;
      return pending;
    },
    /** Test-only reset. */
    reset() {
      inFlight = null;
      lastSuccessAt = Number.NEGATIVE_INFINITY;
    }
  };
}

/** Marker placed on axios errors whose 401 was NOT a confirmed session expiry. */
export const TRANSIENT_SESSION_ERROR_FLAG = "__maintainproTransientSession";

export function isTransientSessionError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as Record<string, unknown>)[TRANSIENT_SESSION_ERROR_FLAG] === true
  );
}
