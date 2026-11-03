/**
 * Policy helpers for BFF silent session refresh.
 *
 * Kept separate from proxyBffRequest so the security rules can be unit-tested without
 * spinning up NextRequest. Behavior must stay strict: GET-only, never on credential
 * endpoints, only when a refresh cookie is present, and concurrent callers with the same
 * refresh token share one in-flight refresh so a burst of 401s cannot rotate tokens in parallel.
 */

import { createHash } from "node:crypto";

export type SilentRefreshSession = {
  refreshToken?: string | null;
};

const AUTH_TOKEN_PATHS = new Set([
  "auth/login",
  "auth/register",
  "auth/refresh",
  "auth/logout",
  "auth/logout-all",
  "auth/invite/accept"
]);

export function isAuthCredentialPath(pathSegments: string[]): boolean {
  return AUTH_TOKEN_PATHS.has(pathSegments.join("/"));
}

/**
 * Access cookies live ~15 min while refresh cookies live a week, so the first request of
 * a returning session is answered 401 by the API. Refreshing once here — server side, for
 * safe reads only — keeps the session seamless without logging a routine failure.
 *
 * Restricted on purpose: GET only (no body to replay, no side effects), never for the
 * credential/token endpoints, and only when a refresh cookie is actually present, so an
 * unauthenticated request still gets a plain 401.
 */
export function canSilentlyRefreshSession(
  method: string,
  pathSegments: string[],
  session: SilentRefreshSession
): boolean {
  if (method.toUpperCase() !== "GET") {
    return false;
  }

  if (isAuthCredentialPath(pathSegments)) {
    return false;
  }

  return typeof session.refreshToken === "string" && session.refreshToken.trim().length > 0;
}

const refreshInFlight = new Map<string, Promise<unknown>>();

function refreshKey(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/**
 * Coalesce concurrent silent-refresh attempts for the SAME refresh token onto a single
 * upstream POST /auth/refresh. Different sessions never share a result: the latch is keyed
 * by a hash of the caller's own refresh token, so one user's rotated tokens can never be
 * written into another user's cookies.
 */
export async function runExclusiveSilentRefresh<T>(
  refreshToken: string,
  runner: () => Promise<T>
): Promise<T> {
  const key = refreshKey(refreshToken);
  const existing = refreshInFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const pending = runner().finally(() => {
    if (refreshInFlight.get(key) === pending) {
      refreshInFlight.delete(key);
    }
  });

  refreshInFlight.set(key, pending);
  return pending;
}

/** Test-only: reset the in-flight latches between cases. */
export function resetSilentRefreshLatchForTests(): void {
  refreshInFlight.clear();
}

/** Test-only: number of in-flight refresh latches. */
export function silentRefreshLatchCountForTests(): number {
  return refreshInFlight.size;
}
