export type SafeBuildInfo = {
  service: string;
  commitSha: string;
  buildTimestamp: string | null;
  environment: string;
  version: string;
};

const FORBIDDEN_PRODUCTION_COMMIT_SENTINELS = new Set([
  "unknown",
  "latest",
  "local-production",
  "ci-placeholder",
  "struct-validation-sha",
  "dev-unspecified"
]);

const DEV_FALLBACK_COMMIT = "dev-unspecified";

function readEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

export function isProductionLikeEnvironment(environment: string, nodeEnv?: string): boolean {
  const env = environment.trim().toLowerCase();
  const node = (nodeEnv ?? "").trim().toLowerCase();
  return env === "production" || node === "production";
}

export function resolveWebSafeBuildInfo(): SafeBuildInfo {
  const serviceName = readEnv("APP_SERVICE_NAME") || "maintainpro-web";
  const environment =
    readEnv("APP_ENVIRONMENT") ||
    readEnv("NEXT_PUBLIC_APP_ENVIRONMENT") ||
    readEnv("NODE_ENV") ||
    "development";
  const nodeEnv = readEnv("NODE_ENV") || "development";
  const productionLike = isProductionLikeEnvironment(environment, nodeEnv);

  const rawCommit =
    readEnv("APP_COMMIT_SHA") ||
    readEnv("NEXT_PUBLIC_APP_COMMIT_SHA") ||
    readEnv("CF_PAGES_COMMIT_SHA") ||
    readEnv("GITHUB_SHA") ||
    readEnv("VERCEL_GIT_COMMIT_SHA");

  let commitSha = rawCommit;
  if (!commitSha) {
    commitSha = productionLike ? "unknown" : DEV_FALLBACK_COMMIT;
  }

  const buildTimestamp =
    readEnv("APP_BUILD_TIMESTAMP") ||
    readEnv("NEXT_PUBLIC_APP_BUILD_TIMESTAMP") ||
    null;

  const version =
    readEnv("APP_VERSION") ||
    readEnv("NEXT_PUBLIC_APP_VERSION") ||
    "1.2.0";

  return {
    service: serviceName,
    commitSha,
    buildTimestamp,
    environment,
    version
  };
}

export function isForbiddenProductionCommitSha(sha: string): boolean {
  const normalized = sha.trim().toLowerCase();
  return !normalized || FORBIDDEN_PRODUCTION_COMMIT_SENTINELS.has(normalized);
}
