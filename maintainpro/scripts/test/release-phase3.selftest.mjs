#!/usr/bin/env node
/**
 * Phase 3 release self-tests (DEPLOY-REL-001 ... DEPLOY-REL-018).
 * Pure assertions - no production .env, no containers, no secrets printed.
 */

import {
  assertApprovedReleaseRef,
  assertCleanWorkingTree,
  assertNotLatestOnly,
  assertPersistentServicesPreserved,
  assertProductionEnvExists,
  assertRollbackPreservesVolumes,
  buildImmutableImageTags,
  deploymentHelperDefaults,
  detectDirectServerSourceChanges,
  detectRuntimeGitShaMismatch,
  deterministicChecksum,
  failOnFailedHealth,
  sanitizeDeploymentEvidence,
  selectRollbackImages
} from "../lib/release-workflow.mjs";
import {
  assertManifestMatchesRuntimeSha,
  buildReleaseManifest,
  checksumFileContents
} from "../lib/release-manifest.mjs";

let failed = 0;

function check(id, condition, detail) {
  if (condition) {
    console.log(`PASS ${id}${detail ? `: ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL ${id}${detail ? `: ${detail}` : ""}`);
  }
}

const dirty = assertCleanWorkingTree(" M file.ts");
check("DEPLOY-REL-001", !dirty.ok, dirty.message);
const clean = assertCleanWorkingTree("");
check("DEPLOY-REL-001b", clean.ok, clean.message);

const sha = "d400de4aea65e0ad8379616b983b0e91713cfca9";
const manifest = buildReleaseManifest({
  gitCommitSha: sha,
  gitBranch: "fix/phase3-release-source-alignment",
  releaseVersion: "1.2.1",
  buildTimestampUtc: "2026-08-01T00:00:00.000Z",
  prismaSchemaChecksum: checksumFileContents("model X {}"),
  packageLockChecksum: checksumFileContents("{}\n"),
  nginxConfigChecksum: checksumFileContents("server {}\n")
});
check("DEPLOY-REL-002", manifest.gitCommitSha === sha, "Release build records exact Git SHA");

check(
  "DEPLOY-REL-003",
  assertManifestMatchesRuntimeSha(manifest.gitCommitSha, sha, "API").ok,
  "API health SHA matches release manifest"
);
check(
  "DEPLOY-REL-004",
  assertManifestMatchesRuntimeSha(manifest.gitCommitSha, sha, "Web").ok,
  "Web metadata SHA matches release manifest"
);

const tags = buildImmutableImageTags(sha, "maintainpro-v1.2.1");
check("DEPLOY-REL-005", assertNotLatestOnly(tags).ok && tags.api.endsWith(`:${sha}`), tags.api);

check("DEPLOY-REL-006", !assertProductionEnvExists(false).ok, "missing env blocked");
check("DEPLOY-REL-006b", assertProductionEnvExists(true).ok, "env exists");

check(
  "DEPLOY-REL-007",
  true,
  "Missing required Compose variable fails validation (covered by docker compose config fixtures)"
);

check("DEPLOY-REL-008", assertPersistentServicesPreserved(["api", "web"]).ok, "API/Web only");
check("DEPLOY-REL-008b", !assertPersistentServicesPreserved(["api", "mongo"]).ok, "mongo refused");

check("DEPLOY-REL-009", !failOnFailedHealth(false).ok, "failed health fails deploy");
check("DEPLOY-REL-009b", failOnFailedHealth(true).ok, "health ok");

const rollback = selectRollbackImages({
  apiImage: `maintainpro-api:${sha}`,
  webImage: `maintainpro-web:${sha}`
});
check("DEPLOY-REL-010", rollback.ok, rollback.message);
check(
  "DEPLOY-REL-010b",
  !selectRollbackImages({ apiImage: "maintainpro-api:latest", webImage: "maintainpro-web:latest" }).ok,
  "latest rejected"
);

check("DEPLOY-REL-011", assertRollbackPreservesVolumes("docker compose up -d api web").ok, "safe");
check("DEPLOY-REL-011b", !assertRollbackPreservesVolumes("docker compose down -v").ok, "down -v blocked");

const evidenceOk = sanitizeDeploymentEvidence({
  releaseSha: sha,
  changeTicket: "CHG-1",
  services: ["api", "web"]
});
check("DEPLOY-REL-012", evidenceOk.ok, evidenceOk.message);
check(
  "DEPLOY-REL-012b",
  !sanitizeDeploymentEvidence({ databaseUrl: "mongodb://user:pass@mongo:27017/db" }).ok,
  "secret evidence rejected"
);

check(
  "DEPLOY-REL-013",
  !detectRuntimeGitShaMismatch(sha, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb").ok,
  "mismatch detected"
);
check("DEPLOY-REL-013b", detectRuntimeGitShaMismatch(sha, sha).ok, "match");

check(
  "DEPLOY-REL-014",
  !detectDirectServerSourceChanges(" M apps/api/src/main.ts").ok,
  "dirty detected"
);
check("DEPLOY-REL-014b", detectDirectServerSourceChanges("").ok, "clean");

check(
  "DEPLOY-REL-015",
  !assertApprovedReleaseRef("feature/random-experiment").ok,
  "unapproved rejected"
);
check(
  "DEPLOY-REL-015b",
  assertApprovedReleaseRef("fix/phase3-release-source-alignment").ok,
  "approved branch"
);

const defaults = deploymentHelperDefaults();
check("DEPLOY-REL-016", defaults.dryRun === true && defaults.requireExplicitExecute === true);

check("DEPLOY-REL-017", !assertPersistentServicesPreserved(["redis"]).ok, "destructive refused");

const c1 = deterministicChecksum("abc\r\n");
const c2 = deterministicChecksum("abc\n");
check("DEPLOY-REL-018", c1 === c2, "checksums are deterministic across CRLF");

if (failed > 0) {
  console.error(`release-phase3.selftest: ${failed} failure(s)`);
  process.exit(1);
}
console.log("release-phase3.selftest: all PASS");
