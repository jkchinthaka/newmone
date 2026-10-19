/** Public liveness is only "the process is up". No build, host, or database detail. */
export function minimalLiveness() {
  return { status: "ok" as const };
}

/** Detailed health (database latency and messages) is a development aid. Production stays minimal. */
export function healthBodyForEnvironment(isProd: boolean, detailed: unknown) {
  if (isProd) return minimalLiveness();
  return detailed;
}

/**
 * OpenAPI JSON is off in production unless the caller already authenticated
 * (Swagger basic auth or a session). Otherwise the route stays disabled.
 */
export function docsJsonAllowed(isProd: boolean, authenticated: boolean) {
  if (!isProd) return true;
  return authenticated;
}
