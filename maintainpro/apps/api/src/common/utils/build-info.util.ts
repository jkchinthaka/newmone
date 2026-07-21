export type SafeBuildInfo = {
  service: string;
  commitSha: string;
  buildTimestamp: string | null;
  environment: string;
  version: string;
};

/**
 * Resolve non-secret build metadata from deployment env vars.
 * Prefer APP_* names; fall back to legacy GIT_COMMIT / BUILD_TIME / Render vars.
 */
export function resolveSafeBuildInfo(service: string, getEnv: (key: string, fallback?: string) => string): SafeBuildInfo {
  const commitSha =
    getEnv("APP_COMMIT_SHA", "").trim() ||
    getEnv("GIT_COMMIT", "").trim() ||
    getEnv("RENDER_GIT_COMMIT", "").trim() ||
    getEnv("CF_PAGES_COMMIT_SHA", "").trim() ||
    "unknown";

  const buildTimestamp =
    getEnv("APP_BUILD_TIMESTAMP", "").trim() ||
    getEnv("BUILD_TIME", "").trim() ||
    null;

  const environment =
    getEnv("APP_ENVIRONMENT", "").trim() ||
    getEnv("NODE_ENV", "development").trim() ||
    "development";

  const version = getEnv("APP_VERSION", "1.2.0").trim() || "1.2.0";

  return {
    service,
    commitSha,
    buildTimestamp: buildTimestamp || null,
    environment,
    version
  };
}