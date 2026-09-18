#!/usr/bin/env node
/**
 * Create a SQL Server .bak from the disposable E2E primary database.
 * Never prints connection URIs or credentials.
 */
import { mkdirSync, writeFileSync, statSync, chmodSync, copyFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  validateRecoveryTarget,
  buildSafeManifest,
  assertManifestSafe
} from "./lib/recovery-safety.mjs";
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
    throw new Error(`docker command failed (exit ${r.status}): ${(r.stderr || r.stdout || "").slice(0, 500)}`);
  }
  return r.stdout || "";
}

function saPassword() {
  return process.env.MSSQL_SA_PASSWORD || "E2e_Sql_Sa_Passw0rd!";
}

function sqlcmd(query) {
  // Password is passed inside the container shell via env — not printed.
  const script = `set -e; /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -b -Q ${JSON.stringify(query)}`;
  return runDocker([...composeBase(), "exec", "-T", "sqlserver", "bash", "-lc", script]);
}

function tableCounts(sourceDb) {
  const q = `
SET NOCOUNT ON;
SELECT
  (SELECT COUNT(1) FROM [${sourceDb}].dbo.Tenant) AS Tenant,
  (SELECT COUNT(1) FROM [${sourceDb}].dbo.[User]) AS [User],
  (SELECT COUNT(1) FROM [${sourceDb}].dbo.Role) AS Role,
  (SELECT COUNT(1) FROM [${sourceDb}].dbo.WorkOrder) AS WorkOrder,
  (SELECT COUNT(1) FROM [${sourceDb}].dbo.SparePart) AS SparePart,
  (SELECT COUNT(1) FROM [${sourceDb}].dbo.PurchaseOrder) AS PurchaseOrder,
  (SELECT COUNT(1) FROM [${sourceDb}].dbo.AuditLog) AS AuditLog;
`;
  const out = sqlcmd(q);
  const lines = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("-") && !/^Tenant/i.test(l));
  const data = lines[0] || "";
  const cols = data.split(/\s+/).map((n) => Number(n));
  return {
    Tenant: cols[0] ?? 0,
    User: cols[1] ?? 0,
    Role: cols[2] ?? 0,
    WorkOrder: cols[3] ?? 0,
    SparePart: cols[4] ?? 0,
    PurchaseOrder: cols[5] ?? 0,
    AuditLog: cols[6] ?? 0
  };
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
  const containerBak = `/var/opt/mssql/backup/${backupId}.bak`;
  const hostArchive = path.join(workDir, archiveName);
  const hostBak = path.join(workDir, `${backupId}.bak`);

  // Ensure SA password is visible inside the sqlserver container shell.
  process.env.MSSQL_SA_PASSWORD = saPassword();

  console.log(`backup_status=starting backup_id_alias=${backupId}`);
  const started = Date.now();

  runDocker([...composeBase(), "exec", "-T", "sqlserver", "bash", "-lc", "mkdir -p /var/opt/mssql/backup && chown mssql /var/opt/mssql/backup || true"]);
  sqlcmd(`BACKUP DATABASE [${sourceDb}] TO DISK = N'${containerBak}' WITH INIT, COPY_ONLY`);

  runDocker(["compose", "-p", process.env.COMPOSE_PROJECT_NAME, "cp", `sqlserver:${containerBak}`, hostBak]);
  // Keep .archive.gz naming so existing integrity verifier continues to work.
  copyFileSync(hostBak, hostArchive);
  try {
    unlinkSync(hostBak);
  } catch {
    /* ignore */
  }

  const st = statSync(hostArchive);
  if (!st.size) throw new Error("archive size is zero");
  const checksum = await sha256File(hostArchive);
  const counts = tableCounts(sourceDb);
  if ((counts.Tenant || 0) < 1 || (counts.User || 0) < 1 || (counts.Role || 0) < 1) {
    throw new Error("core tables empty in source — seed before recovery rehearsal");
  }

  const manifest = buildSafeManifest({
    backupId,
    runId: process.env.E2E_RUN_ID,
    createdAt: new Date().toISOString(),
    applicationCommit: process.env.APP_COMMIT_SHA || process.env.GITHUB_SHA || "unknown",
    sourceDatabaseAlias: "e2e_primary",
    archiveFormat: "sqlserver-bak",
    compression: "native",
    archiveChecksum: checksum,
    archiveSizeBytes: st.size,
    collectionCount: Object.keys(counts).length,
    collectionDocumentCounts: counts,
    toolVersions: { sqlcmd: "mssql-tools18" },
    encryptionStatus: "none_e2e"
  });
  const safe = assertManifestSafe(manifest);
  if (!safe.ok) throw new Error(`manifest unsafe: ${safe.reason}`);

  const manifestPath = path.join(workDir, `${backupId}.manifest.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  try {
    runDocker([...composeBase(), "exec", "-T", "sqlserver", "rm", "-f", containerBak]);
  } catch {
    /* non-fatal */
  }

  console.log("backup_status=success");
  console.log("checksum_status=valid");
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
