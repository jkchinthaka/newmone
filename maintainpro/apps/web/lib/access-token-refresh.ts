let refreshInFlight: Promise<boolean> | null = null;

export function resetAccessTokenRefreshForTests() {
  refreshInFlight = null;
}

/**
 * Concurrent 401s share one refresh. Callers all see the same success or failure,
 * so a second refresh cannot rotate the token out from under the first and force a logout.
 */
export function shareAccessTokenRefresh(run: () => Promise<boolean>): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const pending = run().finally(() => {
    if (refreshInFlight === pending) refreshInFlight = null;
  });
  refreshInFlight = pending;
  return pending;
}
