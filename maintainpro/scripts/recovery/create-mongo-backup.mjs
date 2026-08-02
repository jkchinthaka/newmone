#!/usr/bin/env node
/**
 * Create a consistent mongodump archive from disposable E2E Mongo only.
 * Never prints connection URIs or credentials.
 */
import { mkdirSync, writeFileSync, statSync, chmodSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  CORE_COLLECTIONS,
  REQUIRED_COLLECTIONS,
  validateRecoveryTarget,
  buildSafeManifest,
  assertManifestSafe
} from "./lib/recovery-safety.mjs";
import { sha256File } from "./lib/sha256-file.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function composeBase() {
  const project = process.env.COMPOSE_PROJECT_NAME;
  return [
    "compose",
    "-p",
    project,
    "--env-file",
    process.env.MAINTAINPRO_E2E_ENV_FILE || ".env.e2e",
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.e2e.yml"
  ];
}

function runDocker(args, opts = {}) {
  // Avoid shell tracing; never pass URI strings.
  const r = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: opts.stdio || ["ignore", "pipe", "pipe"]
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").slice(0, 500);
    throw new Error(`docker command failed (exit ${r.status}): ${err.replace(/mongodb:\/\/[^\s]+/gi, "mongodb://REDACTED")}`);
  }
  return r.stdout || "";
}

async function collectionCounts(sourceDb) {
  const evalJs = `
    const dbn=${JSON.stringify(sourceDb)};
    const names=${JSON.stringify(REQUIRED_COLLECTIONS)};
    const out={};
    for (const n of names) { try { out[n]=db.getSiblingDB(dbn).getCollection(n).countDocuments(); } catch(e){ out[n]=-1; } }
    print(JSON.stringify(out));
  `;
  const out = runDocker([
    ...composeBase(),
    "exec",
    "-T",
    "mongo",
    "mongosh",
    "--quiet",
    "-u",
    process.env.MONGO_INITDB_ROOT_USERNAME || "e2e_root_not_prod",
    "-p",
    process.env.MONGO_INITDB_ROOT_PASSWORD || "e2e_root_password_not_for_production_use",
    "--authenticationDatabase",
    "admin",
    "--eval",
    evalJs
  ]);
  const line = out.trim().split(/\r?\n/).filter(Boolean).pop();
  return JSON.parse(line);
}

async function main() {
  const sourceDb = (process.env.RECOVERY_SOURCE_DATABASE || process.env.PRIMARY_DATABASE_NAME || "").trim();
  const targetDb = (process.env.RECOVERY_TARGET_DATABASE || "").trim();
  const host = (process.env.RECOVERY_MONGO_HOST || "mongo").trim();
  const guard = validateRecoveryTarget({
    e2eTestMode: process.env.E2E_TEST_MODE,
    recoveryRehearsal: process.env.RECOVERY_REHEARSAL,
    runId: process.env.E2E_RUN_ID,
    sourceDatabase: sourceDb,
    targetDatabase: targetDb || `maintainpro_restore_${process.env.E2E_RUN_ID || "x"}`,
    host,
    composeProjectName: process.env.COMPOSE_PROJECT_NAME
  });
  if (!guard.ok) {
    console.error("backup_status=rejected");
    for (const e of guard.errors) console.error(`reason=${e}`);
    process.exit(1);
  }

  const workDir =
    process.env.RECOVERY_WORK_DIR ||
    path.join(root, "artifacts", "recovery-tmp", process.env.E2E_RUN_ID || "local");
  mkdirSync(workDir, { recursive: true });
  try {
    chmodSync(workDir, 0o700);
  } catch {
    /* Windows may ignore */
  }

  const backupId = `e2e-backup-${process.env.E2E_RUN_ID}-${randomUUID().slice(0, 8)}`;
  const archiveName = `${backupId}.archive.gz`;
  const containerArchive = `/tmp/${archiveName}`;
  const hostArchive = path.join(workDir, archiveName);

  console.log(`backup_status=starting backup_id_alias=${backupId}`);
  const started = Date.now();

  // Consistent dump via mongodump --archive --gzip inside mongo container (replica-set aware).
  runDocker([
    ...composeBase(),
    "exec",
    "-T",
    "mongo",
    "bash",
    "-lc",
    `mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "${sourceDb}" --archive="${containerArchive}" --gzip`
  ]);

  runDocker(["compose", "-p", process.env.COMPOSE_PROJECT_NAME, "cp", `mongo:${containerArchive}`, hostArchive]);

  const st = statSync(hostArchive);
  if (!st.size) throw new Error("archive size is zero");
  const checksum = await sha256File(hostArchive);
  const counts = await collectionCounts(sourceDb);
  const absentCore = CORE_COLLECTIONS.filter((c) => counts[c] === -1 || counts[c] === undefined);
  if (absentCore.length) {
    throw new Error(`core collections absent: ${absentCore.join(",")}`);
  }
  for (const c of Object.keys(counts)) {
    if (counts[c] === -1) delete counts[c];
  }

  const manifest = buildSafeManifest({
    backupId,
    runId: process.env.E2E_RUN_ID,
    createdAt: new Date().toISOString(),
    applicationCommit: process.env.APP_COMMIT_SHA || process.env.GITHUB_SHA || "unknown",
    sourceDatabaseAlias: "e2e_primary",
    archiveChecksum: checksum,
    archiveSizeBytes: st.size,
    collectionCount: Object.keys(counts).length,
    collectionDocumentCounts: counts,
    toolVersions: { mongodump: "container-mongo-tools" },
    encryptionStatus: "none_e2e"
  });
  const safe = assertManifestSafe(manifest);
  if (!safe.ok) throw new Error(`manifest unsafe: ${safe.reason}`);

  const manifestPath = path.join(workDir, `${backupId}.manifest.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  // Remove container temp archive only.
  try {
    runDocker([...composeBase(), "exec", "-T", "mongo", "rm", "-f", containerArchive]);
  } catch {
    /* non-fatal */
  }

  console.log("backup_status=success");
  console.log(`checksum_status=valid`);
  console.log(`archive_size_bytes=${st.size}`);
  console.log(`collection_count=${Object.keys(counts).length}`);
  console.log(`backup_duration_ms=${Date.now() - started}`);
  console.log(`manifest_path=${path.relative(root, manifestPath)}`);
  console.log(`archive_path=${path.relative(root, hostArchive)}`);
  console.log("timing_label=E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE");
}

main().catch((err) => {
  console.error("backup_status=failed");
  console.error(`error=${String(err.message || err).slice(0, 300)}`);
  process.exit(1);
});