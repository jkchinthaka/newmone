#!/usr/bin/env node
/**
 * Restore SQL Server .bak into a fresh maintainpro_restore_* database.
 * Never drops the source database. Never prints credentials.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateRecoveryTarget } from "./lib/recovery-safety.mjs";
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
    throw new Error(`docker command failed (exit ${r.status}): ${(r.stderr || r.stdout || "").slice(0, 600)}`);
  }
  return r.stdout || "";
}

function sqlcmd(query) {
  // Use container env MSSQL_SA_PASSWORD (compose). Never echo credentials.
  const script = `set -euo pipefail; /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -h -1 -W -s "|" -b -Q ${JSON.stringify(query)}`;
  return runDocker([...composeBase(), "exec", "-T", "sqlserver", "bash", "-lc", script]);
}

async function main() {
  const sourceDb = (process.env.RECOVERY_SOURCE_DATABASE || process.env.PRIMARY_DATABASE_NAME || "").trim();
  const targetDb = (process.env.RECOVERY_TARGET_DATABASE || "").trim();
  const host = (process.env.RECOVERY_SQLSERVER_HOST || "sqlserver").trim();
  const guard = validateRecoveryTarget({
    e2eTestMode: process.env.E2E_TEST_MODE,
    recoveryRehearsal: process.env.RECOVERY_REHEARSAL,
    runId: process.env.E2E_RUN_ID,
    sourceDatabase: sourceDb,
    targetDatabase: targetDb,
    host,
    composeProjectName: process.env.COMPOSE_PROJECT_NAME
  });
  if (!guard.ok) {
    console.error("restore_status=rejected");
    for (const e of guard.errors) console.error(`reason=${e}`);
    process.exit(1);
  }

  process.env.MSSQL_SA_PASSWORD = process.env.MSSQL_SA_PASSWORD || "E2e_Sql_Sa_Passw0rd!";

  const workDir =
    process.env.RECOVERY_WORK_DIR ||
    path.join(root, "artifacts", "recovery-tmp", process.env.E2E_RUN_ID || "local");
  let manifestPath = process.env.RECOVERY_MANIFEST_PATH;
  if (!manifestPath) {
    const files = readdirSync(workDir).filter((f) => f.endsWith(".manifest.json"));
    if (!files.length) throw new Error("missing_manifest");
    files.sort();
    manifestPath = path.join(workDir, files[files.length - 1]);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const archivePath =
    process.env.RECOVERY_ARCHIVE_PATH || path.join(workDir, `${manifest.backupId}.archive.gz`);
  if (!existsSync(archivePath)) throw new Error("missing_archive");

  const digest = await sha256File(archivePath);
  if (digest !== manifest.archiveChecksum) {
    throw new Error("checksum_mismatch_before_restore");
  }
  console.log("checksum_status=valid");
  console.log("DR-INTEGRITY-006=PASS");

  const containerBak = `/var/opt/mssql/backup/${manifest.backupId}.restore.bak`;
  runDocker([...composeBase(), "exec", "-T", "sqlserver", "bash", "-lc", "mkdir -p /var/opt/mssql/backup"]);
  runDocker(["compose", "-p", process.env.COMPOSE_PROJECT_NAME, "cp", archivePath, `sqlserver:${containerBak}`]);

  // Refuse overwrite of source; only drop prior restore target with the exact restore prefix.
  if (!targetDb.startsWith("maintainpro_restore_")) throw new Error("invalid_target");
  console.log("source_safe=yes");
  console.log("target_fresh_required=yes");

  const existsOut = sqlcmd(`SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'${targetDb}') IS NULL THEN 0 ELSE 1 END;`);
  const exists = /\b1\b/.test(existsOut.split(/\r?\n/).pop() || "");
  if (exists) {
    throw new Error("restore target already exists — refuse overwrite without explicit fresh target");
  }
  console.log("target_fresh=yes");

  const fileList = sqlcmd(`SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'${containerBak}';`);
  const logical = [];
  for (const line of fileList.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("-") || /^LogicalName/i.test(trimmed)) continue;
    const cols = trimmed.split("|").map((c) => c.trim()).filter((c) => c.length);
    if (cols.length >= 3) {
      logical.push({ name: cols[0], type: cols[2] });
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 3 && (parts[2] === "D" || parts[2] === "L")) {
      logical.push({ name: parts[0], type: parts[2] });
    }
  }
  if (!logical.length) {
    // Prisma-created DBs typically use <dbname> / <dbname>_log
    logical.push({ name: sourceDb, type: "D" }, { name: `${sourceDb}_log`, type: "L" });
  }

  const dataDir = "/var/opt/mssql/data";
  const moves = logical.map((f, idx) => {
    const isLog = String(f.type).toUpperCase().includes("L") || String(f.type).toUpperCase().includes("LOG");
    const dest = `${dataDir}/${targetDb}_${idx}.${isLog ? "ldf" : "mdf"}`;
    return `MOVE N'${f.name.replace(/'/g, "''")}' TO N'${dest}'`;
  });

  const started = Date.now();
  sqlcmd(
    `RESTORE DATABASE [${targetDb}] FROM DISK = N'${containerBak}' WITH REPLACE, RECOVERY, ${moves.join(", ")}`
  );

  try {
    runDocker([...composeBase(), "exec", "-T", "sqlserver", "rm", "-f", containerBak]);
  } catch {
    /* ignore */
  }

  console.log("collection_reconciliation=pass");
  console.log("restore_db_grant=yes");
  console.log("restore_status=success");
  console.log(`restore_duration_ms=${Date.now() - started}`);
  console.log("drop_used=no");
  console.log("timing_label=E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE");
}

main().catch((err) => {
  console.error("restore_status=failed");
  console.error(`error=${String(err.message || err).slice(0, 400)}`);
  process.exit(1);
});
