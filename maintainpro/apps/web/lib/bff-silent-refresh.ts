/**
 * Policy helpers for BFF silent session refresh.
 *
 * Kept separate from proxyBffRequest so the security rules can be unit-tested without
 * spinning up NextRequest. Behavior must stay strict: GET-only, never on credential
 * endpoints, only when a refresh cookie is present, and concurrent callers share one
 * in-flight refresh so a burst of 401s cannot rotate tokens in parallel.
 */

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

type RefreshRunner = () => Promise<unknown>;

let refreshInFlight: Promise<unknown> | null = null;

/**
 * Coalesce concurrent silent-refresh attempts onto a single upstream POST /auth/refresh.
 * Callers still retry their own original GET with the resulting tokens.
 */
export async function runExclusiveSilentRefresh<T>(runner: () => Promise<T>): Promise<T> {
  if (refreshInFlight) {
    return refreshInFlight as Promise<T>;
  }

  const pending = runner().finally(() => {
    if (refreshInFlight === pending) {
      refreshInFlight = null;
    }
  });

  refreshInFlight = pending;
  return pending;
}

/** Test-only: reset the in-flight latch between cases. */
export function resetSilentRefreshLatchForTests(): void {
  refreshInFlight = null;
}
