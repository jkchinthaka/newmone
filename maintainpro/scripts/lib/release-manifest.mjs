/**
 * Release manifest builder (no secrets, no machine-specific absolute paths).
 */

import { deterministicChecksum } from "./release-workflow.mjs";

/**
 * @param {object} input
 */
export function buildReleaseManifest(input) {
  const gitCommitSha = String(input.gitCommitSha || "").trim().toLowerCase();
  if (!gitCommitSha || gitCommitSha === "unknown" || gitCommitSha === "latest") {
    throw new Error("DEPLOY-REL-002: Release build must record an exact Git SHA.");
  }

  const manifest = {
    application: input.application || "maintainpro",
    releaseVersion: input.releaseVersion || "1.2.0",
    gitCommitSha,
    gitBranch: input.gitBranch || "",
    buildTimestampUtc: input.buildTimestampUtc || new Date().toISOString(),
    nodeVersion: input.nodeVersion || process.version,
    npmVersion: input.npmVersion || "",
    apiImage: input.apiImage || `maintainpro-api:${gitCommitSha}`,
    webImage: input.webImage || `maintainpro-web:${gitCommitSha}`,
    composeFiles: input.composeFiles || [
      "docker-compose.yml",
      "docker-compose.production.yml"
    ],
    prismaSchemaChecksum: input.prismaSchemaChecksum || "",
    packageLockChecksum: input.packageLockChecksum || "",
    nginxConfigChecksum: input.nginxConfigChecksum || "",
    testsExecuted: input.testsExecuted || [],
    testResults: input.testResults || {},
    knownBlockers: input.knownBlockers || [],
    operatorApprovalsRequired: input.operatorApprovalsRequired || [
      "change-ticket",
      "mongo-root-rotation-gate",
      "backup-confirmation"
    ]
  };

  assertNoSecretsInManifest(manifest);
  return manifest;
}

export function assertNoSecretsInManifest(manifest) {
  const json = JSON.stringify(manifest);
  if (/[A-Za-z]:\\\\|\/Users\/|\/home\//.test(json)) {
    throw new Error("Release manifest must not include machine-specific absolute paths.");
  }
  if (/mongodb(\+srv)?:\/\//i.test(json) || /password|Bearer |BEGIN .*PRIVATE KEY/i.test(json)) {
    throw new Error("Release manifest must not include credentials or secret material.");
  }
}

export function checksumFileContents(content) {
  return deterministicChecksum(content);
}

/**
 * DEPLOY-REL-003 / 004 helpers
 */
export function assertManifestMatchesRuntimeSha(manifestSha, runtimeSha, serviceLabel) {
  const a = String(manifestSha || "").trim().toLowerCase();
  const b = String(runtimeSha || "").trim().toLowerCase();
  if (!a || !b || (a !== b && !a.startsWith(b) && !b.startsWith(a))) {
    return {
      ok: false,
      message: `${serviceLabel} health SHA does not match release manifest.`
    };
  }
  return { ok: true, message: `${serviceLabel} health SHA matches release manifest.` };
}
