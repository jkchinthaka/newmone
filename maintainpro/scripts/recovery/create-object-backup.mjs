#!/usr/bin/env node
/**
 * Disposable MinIO object backup using mc inside compose network.
 * Never prints access keys or signed URLs. Never deletes buckets.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { validateRecoveryTarget } from "./lib/recovery-safety.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function composeBase() {
  return [
    "compose",
    "-p",
    process.env.COMPOSE_PROJECT_NAME,
    "--env-file",
    process.env.MAINTAINPRO_E2E_ENV_FILE || ".env.e2e",
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.e2e.yml"
  ];
}

function mcRun(script) {
  const r = spawnSync(
    "docker",
    [
      ...composeBase(),
      "run",
      "--rm",
      "--no-deps",
      "-e",
      `MINIO_ACCESS_KEY=${process.env.MINIO_ACCESS_KEY || "minioadmin"}`,
      "-e",
      `MINIO_SECRET_KEY=${process.env.MINIO_SECRET_KEY || "minioadmin123"}`,
      "--entrypoint",
      "/bin/sh",
      "minio-init",
      "-c",
      script
    ],
    { cwd: root, encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"] }
  );
  if (r.status !== 0) {
    throw new Error(
      (r.stderr || r.stdout || "")
        .slice(0, 400)
        .replace(/(key|secret|password)=[^\s]+/gi, "$1=REDACTED")
    );
  }
  return r.stdout || "";
}

function main() {
  const runId = process.env.E2E_RUN_ID;
  const sourceBucket = (process.env.RECOVERY_SOURCE_BUCKET || `maintainpro-e2e-files-${runId}`).trim();
  const restoreBucket = (process.env.RECOVERY_RESTORE_BUCKET || `maintainpro-e2e-restore-${runId}`).trim();
  if (!sourceBucket.includes("e2e")) throw new Error("source bucket must be E2E-scoped");
  if (sourceBucket === restoreBucket) throw new Error("source and restore buckets must differ");
  if (/prod|production/i.test(sourceBucket) || /prod|production/i.test(restoreBucket)) {
    throw new Error("production-like bucket rejected");
  }

  const guard = validateRecoveryTarget({
    e2eTestMode: process.env.E2E_TEST_MODE,
    recoveryRehearsal: process.env.RECOVERY_REHEARSAL,
    runId,
    sourceDatabase: process.env.RECOVERY_SOURCE_DATABASE || process.env.PRIMARY_DATABASE_NAME,
    targetDatabase: process.env.RECOVERY_TARGET_DATABASE || `maintainpro_restore_${runId}`,
    host: "mongo",
    composeProjectName: process.env.COMPOSE_PROJECT_NAME
  });
  if (!guard.ok) process.exit(1);

  const workDir =
    process.env.RECOVERY_WORK_DIR || path.join(root, "artifacts", "recovery-tmp", runId || "local");
  mkdirSync(workDir, { recursive: true });

  const fixtureKey = `recovery/${runId}/fixture.txt`;
  const fixtureBody = `maintainpro-e2e-recovery-fixture:${runId}`;
  const b64 = Buffer.from(fixtureBody, "utf8").toString("base64");

  mcRun(
    [
      "set -e",
      'mc alias set local http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null',
      `mc mb -p "local/${sourceBucket}" >/dev/null || true`,
      `echo '${b64}' | base64 -d | mc pipe "local/${sourceBucket}/${fixtureKey}" >/dev/null`
    ].join("\n")
  );

  // Authoritative checksum is whatever MinIO stored (round-trip).
  const stored = mcRun(
    [
      "set -e",
      'mc alias set local http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null',
      `mc cat "local/${sourceBucket}/${fixtureKey}"`
    ].join("\n")
  );
  const fixtureHash = createHash("sha256").update(stored).digest("hex");

  const objectManifest = {
    schemaVersion: "1.0",
    backupId: `obj-${runId}-${randomUUID().slice(0, 8)}`,
    runId,
    sourceBucketAlias: "e2e_source",
    restoreBucketAlias: "e2e_restore",
    sourceBucketSafeName: sourceBucket.startsWith("maintainpro-e2e") ? "yes" : "no",
    objects: [
      {
        key: fixtureKey,
        size: Buffer.byteLength(stored),
        checksum: fixtureHash
      }
    ],
    objectCount: 1,
    productionApproved: false
  };
  const manifestPath = path.join(workDir, `${objectManifest.backupId}.objects.json`);
  writeFileSync(manifestPath, JSON.stringify(objectManifest, null, 2), "utf8");
  writeFileSync(path.join(workDir, "object-source-bucket.txt"), sourceBucket, "utf8");
  writeFileSync(path.join(workDir, "object-restore-bucket.txt"), restoreBucket, "utf8");

  console.log("DR-OBJECT-001=PASS");
  console.log("object_backup_status=success");
  console.log(`object_count=${objectManifest.objectCount}`);
  console.log(`object_manifest_path=${path.relative(root, manifestPath)}`);
}

main();