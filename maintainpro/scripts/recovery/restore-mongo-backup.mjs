#!/usr/bin/env node
/**
 * Restore mongodump archive into a fresh maintainpro_restore_* database.
 * Never uses --drop. Never overwrites source. Fail closed if target has collections.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateRecoveryTarget, REQUIRED_COLLECTIONS } from "./lib/recovery-safety.mjs";
import { sha256File } from "./lib/sha256-file.mjs";

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

function runDocker(args) {
  const r = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").slice(0, 500).replace(/mongodb:\/\/[^\s]+/gi, "mongodb://REDACTED");
    throw new Error(`docker failed (${r.status}): ${err}`);
  }
  return r.stdout || "";
}

function mongoshEval(js) {
  return runDocker([
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
    js
  ]);
}

async function main() {
  const sourceDb = (process.env.RECOVERY_SOURCE_DATABASE || process.env.PRIMARY_DATABASE_NAME || "").trim();
  const targetDb = (process.env.RECOVERY_TARGET_DATABASE || "").trim();
  const guard = validateRecoveryTarget({
    e2eTestMode: process.env.E2E_TEST_MODE,
    recoveryRehearsal: process.env.RECOVERY_REHEARSAL,
    runId: process.env.E2E_RUN_ID,
    sourceDatabase: sourceDb,
    targetDatabase: targetDb,
    host: process.env.RECOVERY_MONGO_HOST || "mongo",
    composeProjectName: process.env.COMPOSE_PROJECT_NAME,
    dropFlag: false,
    resetFlag: false
  });
  if (!guard.ok) {
    console.error("restore_status=rejected");
    for (const e of guard.errors) console.error(`reason=${e}`);
    process.exit(1);
  }
  console.log("source_safe=yes");
  console.log("target_fresh_required=yes");

  const workDir =
    process.env.RECOVERY_WORK_DIR ||
    path.join(root, "artifacts", "recovery-tmp", process.env.E2E_RUN_ID || "local");
  let manifestPath = process.env.RECOVERY_MANIFEST_PATH;
  if (!manifestPath) {
    const files = readdirSync(workDir).filter((f) => f.endsWith(".manifest.json"));
    files.sort();
    manifestPath = path.join(workDir, files[files.length - 1]);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const archivePath =
    process.env.RECOVERY_ARCHIVE_PATH || path.join(workDir, `${manifest.backupId}.archive.gz`);
  if (!existsSync(archivePath) || !statSync(archivePath).size) throw new Error("archive_missing");

  const digest = await sha256File(archivePath);
  if (digest !== manifest.archiveChecksum) {
    console.log("checksum_status=invalid");
    console.log("DR-INTEGRITY-006=FAIL");
    throw new Error("restore blocked: integrity failed");
  }
  console.log("checksum_status=valid");
  console.log("DR-INTEGRITY-006=PASS");

  // Fail closed if target already has collections.
  const existsOut = mongoshEval(`
    const dbn=${JSON.stringify(targetDb)};
    const cols=db.getSiblingDB(dbn).getCollectionNames();
    print(JSON.stringify({count: cols.length}));
  `);
  const existsJson = JSON.parse(existsOut.trim().split(/\r?\n/).filter(Boolean).pop());
  if (existsJson.count > 0) {
    console.error("restore_status=rejected");
    console.error("reason=target_not_empty");
    process.exit(1);
  }
  console.log("target_fresh=yes");

  const containerArchive = `/tmp/restore-${manifest.backupId}.archive.gz`;
  runDocker(["compose", "-p", process.env.COMPOSE_PROJECT_NAME, "cp", archivePath, `mongo:${containerArchive}`]);

  const started = Date.now();
  // Explicitly omit --drop. Namespace remap source -> fresh target.
  runDocker([
    ...composeBase(),
    "exec",
    "-T",
    "mongo",
    "bash",
    "-lc",
    `mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive=${containerArchive} --gzip --nsFrom='${sourceDb}.*' --nsTo='${targetDb}.*'`
  ]);

  const countOut = mongoshEval(`
    const dbn=${JSON.stringify(targetDb)};
    const names=${JSON.stringify(REQUIRED_COLLECTIONS)};
    const out={};
    for (const n of names) { try { out[n]=db.getSiblingDB(dbn).getCollection(n).countDocuments(); } catch(e){ out[n]=-1; } }
    print(JSON.stringify(out));
  `);
  const restored = JSON.parse(countOut.trim().split(/\r?\n/).filter(Boolean).pop());
  const expected = manifest.collectionDocumentCounts || {};
  let mismatches = 0;
  for (const name of Object.keys(expected)) {
    if (restored[name] !== expected[name]) mismatches += 1;
  }
  if (mismatches) {
    console.error("collection_reconciliation=fail");
    console.error(`mismatch_count=${mismatches}`);
    process.exit(1);
  }
  console.log("collection_reconciliation=pass");

  // App user is scoped to E2E primary/backup DBs only. Grant readWrite on the fresh restore DB.
  const appUser = process.env.MONGO_APP_USERNAME || "e2e_app_not_prod";
  mongoshEval(`
    const dbn=${JSON.stringify(targetDb)};
    const user=${JSON.stringify(appUser)};
    try {
      db.getSiblingDB("admin").grantRolesToUser(user, [{ role: "readWrite", db: dbn }]);
      print(JSON.stringify({ granted: true }));
    } catch (e) {
      // createUser fallback when grant fails because user is authSource-local
      try {
        db.getSiblingDB(dbn).createUser({
          user: user,
          pwd: "unused-if-exists",
          roles: [{ role: "readWrite", db: dbn }]
        });
      } catch (e2) {}
      try {
        db.getSiblingDB("admin").grantRolesToUser(user, [{ role: "readWrite", db: dbn }]);
        print(JSON.stringify({ granted: true, retry: true }));
      } catch (e3) {
        print(JSON.stringify({ granted: false, error: String(e3.message || e3) }));
      }
    }
  `);
  console.log("restore_db_grant=attempted");
  console.log("restore_status=success");
  console.log(`restore_duration_ms=${Date.now() - started}`);
  console.log("drop_used=no");
  console.log("timing_label=E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE");

  try {
    runDocker([...composeBase(), "exec", "-T", "mongo", "rm", "-f", containerArchive]);
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error("restore_status=failed");
  console.error(`error=${String(err.message || err).slice(0, 300)}`);
  process.exit(1);
});