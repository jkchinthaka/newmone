export type SafeBuildInfo = {
  service: string;
  commitSha: string;
  buildTimestamp: string | null;
  environment: string;
  version: string;
};

export type ReleaseMetadataAssessment = {
  info: SafeBuildInfo;
  issues: string[];
  warnings: string[];
  isProductionLike: boolean;
  acceptable: boolean;
};

/** Commit values that must never silently represent a production release. */
export const FORBIDDEN_PRODUCTION_COMMIT_SENTINELS = [
  "unknown",
  "latest",
  "local-production",
  "ci-placeholder",
  "struct-validation-sha",
  "dev-unspecified"
] as const;

const DEV_FALLBACK_COMMIT = "dev-unspecified";

export function isForbiddenProductionCommitSha(sha: string): boolean {
  const normalized = sha.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (FORBIDDEN_PRODUCTION_COMMIT_SENTINELS as readonly string[]).includes(normalized);
}

export function isProductionLikeEnvironment(environment: string, nodeEnv?: string): boolean {
  const env = environment.trim().toLowerCase();
  const node = (nodeEnv ?? "").trim().toLowerCase();
  return env === "production" || node === "production";
}

/**
 * Resolve non-secret build metadata from deployment env vars.
 * Prefer APP_* names; fall back to legacy GIT_COMMIT / BUILD_TIME / Render vars.
 * Development may use an explicitly labelled fallback commit (`dev-unspecified`).
 */
export function resolveSafeBuildInfo(
  service: string,
  getEnv: (key: string, fallback?: string) => string
): SafeBuildInfo {
  const serviceName = getEnv("APP_SERVICE_NAME", "").trim() || service;

  const rawCommit =
    getEnv("APP_COMMIT_SHA", "").trim() ||
    getEnv("GIT_COMMIT", "").trim() ||
    getEnv("RENDER_GIT_COMMIT", "").trim() ||
    getEnv("CF_PAGES_COMMIT_SHA", "").trim();

  const environment =
    getEnv("APP_ENVIRONMENT", "").trim() ||
    getEnv("NODE_ENV", "development").trim() ||
    "development";

  const nodeEnv = getEnv("NODE_ENV", "development").trim();
  const productionLike = isProductionLikeEnvironment(environment, nodeEnv);

  let commitSha = rawCommit;
  if (!commitSha) {
    commitSha = productionLike ? "unknown" : DEV_FALLBACK_COMMIT;
  }

  const buildTimestamp =
    getEnv("APP_BUILD_TIMESTAMP", "").trim() ||
    getEnv("BUILD_TIME", "").trim() ||
    null;

  const version = getEnv("APP_VERSION", "1.2.0").trim() || "1.2.0";

  return {
    service: serviceName,
    commitSha,
    buildTimestamp: buildTimestamp || null,
    environment,
    version
  };
}

/**
 * Assess whether release metadata is acceptable for the current environment.
 * Production-like environments reject sentinel commits and missing timestamps.
 */
export function assessReleaseMetadata(
  info: SafeBuildInfo,
  options?: { nodeEnv?: string }
): ReleaseMetadataAssessment {
  const issues: string[] = [];
  const warnings: string[] = [];
  const isProductionLike = isProductionLikeEnvironment(info.environment, options?.nodeEnv);

  if (isProductionLike) {
    if (isForbiddenProductionCommitSha(info.commitSha)) {
      issues.push(
        `Production release metadata commitSha must be a real Git SHA (rejected: ${info.commitSha}).`
      );
    } else if (!/^[0-9a-f]{7,40}$/i.test(info.commitSha)) {
      warnings.push(
        `Production commitSha should be a full or abbreviated Git hex SHA (got length ${info.commitSha.length}).`
      );
    }

    if (!info.buildTimestamp) {
      issues.push("Production release metadata requires APP_BUILD_TIMESTAMP (UTC ISO 8601).");
    } else if (Number.isNaN(Date.parse(info.buildTimestamp))) {
      issues.push("Production APP_BUILD_TIMESTAMP must be valid UTC ISO 8601.");
    }

    if (!info.version.trim() || info.version.trim().toLowerCase() === "latest") {
      issues.push("Production APP_VERSION must be set and must not be 'latest'.");
    }

    if (info.environment.trim().toLowerCase() === "local-production") {
      issues.push("APP_ENVIRONMENT must not be 'local-production' in production deployments.");
    }
  } else if (info.commitSha === DEV_FALLBACK_COMMIT) {
    warnings.push("Development build is using the explicit fallback commit label 'dev-unspecified'.");
  }

  return {
    info,
    issues,
    warnings,
    isProductionLike,
    acceptable: issues.length === 0
  };
}
