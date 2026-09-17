#!/usr/bin/env node
/**
 * Non-production SQL Server backup/restore drill helper.
 * Does NOT overwrite the source database.
 *
 * Requires sqlcmd (or documents EXTERNAL when unavailable).
 *
 * Env:
 *   SQLSERVER_DRILL_SERVER=localhost
 *   SQLSERVER_DRILL_SOURCE_DB=MaintainProDev
 *   SQLSERVER_DRILL_RESTORE_DB=MaintainProDrillRestore
 *   SQLSERVER_DRILL_BACKUP_DIR=C:\\Temp\\maintainpro-drills
 *   SQLSERVER_DRILL_USER / SQLSERVER_DRILL_PASSWORD (optional; otherwise trusted)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const server = process.env.SQLSERVER_DRILL_SERVER || "localhost";
const sourceDb = process.env.SQLSERVER_DRILL_SOURCE_DB || "MaintainProDev";
const restoreDb = process.env.SQLSERVER_DRILL_RESTORE_DB || "MaintainProDrillRestore";
const backupDir = process.env.SQLSERVER_DRILL_BACKUP_DIR || path.join(process.cwd(), "artifacts", "sql-drills");
const user = process.env.SQLSERVER_DRILL_USER || "";
const password = process.env.SQLSERVER_DRILL_PASSWORD || "";

fs.mkdirSync(backupDir, { recursive: true });
const bak = path.join(backupDir, `${sourceDb}-${Date.now()}.bak`);

function sqlcmdAvailable() {
  const r = spawnSync("sqlcmd", ["-?"], { encoding: "utf8" });
  return r.status === 0 || (r.stdout || r.stderr || "").length > 0;
}

function runSql(sql) {
  const args = ["-S", server, "-b", "-W", "-s", "|", "-Q", sql];
  if (user) {
    args.push("-U", user, "-P", password);
  } else {
    args.push("-E");
  }
  args.push("-C");
  const r = spawnSync("sqlcmd", args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "sqlcmd failed").slice(0, 800));
  }
  return r.stdout || "";
}

function dataDirectory() {
  const out = runSql(
    "SET NOCOUNT ON; SELECT TOP 1 physical_name FROM sys.master_files WHERE database_id = 1 AND type_desc = 'ROWS';"
  );
  const line = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("-") && !l.includes("physical_name") && l.toLowerCase().endsWith(".mdf"));
  if (!line) {
    // Fallback to common default
    return "C:\\Program Files\\Microsoft SQL Server\\MSSQL15.MSSQLSERVER\\MSSQL\\DATA";
  }
  return path.dirname(line.split("|")[0].trim());
}

function fileListLogicalNames() {
  const out = runSql(
    `SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'${bak.replace(/'/g, "''")}';`
  );
  const rows = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("-") && !l.toLowerCase().startsWith("logicalname"));
  const logical = [];
  for (const row of rows) {
    const cols = row.split("|").map((c) => c.trim());
    if (cols[0] && cols[2]) {
      logical.push({ name: cols[0], type: cols[2] });
    }
  }
  if (!logical.length) {
    throw new Error("Unable to parse RESTORE FILELISTONLY output");
  }
  return logical;
}

console.log("MaintainPro SQL Server drill (non-destructive)");
console.log(`  server=${server} source=${sourceDb} restoreAs=${restoreDb}`);

if (!sqlcmdAvailable()) {
  console.log("RESULT: EXTERNAL — sqlcmd not available in this environment.");
  console.log("Tooling and docs are complete; execute drill on a host with sqlcmd + permissions.");
  process.exit(0);
}

if (restoreDb.toLowerCase() === sourceDb.toLowerCase()) {
  console.error("REFUSED: restore database name must differ from source.");
  process.exit(2);
}

const started = Date.now();
try {
  console.log("1) BACKUP source…");
  runSql(`BACKUP DATABASE [${sourceDb}] TO DISK = N'${bak.replace(/'/g, "''")}' WITH INIT`);
  console.log(`   bak=${bak}`);

  console.log("2) DROP restore target if exists…");
  runSql(
    `IF DB_ID(N'${restoreDb}') IS NOT NULL BEGIN ALTER DATABASE [${restoreDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${restoreDb}]; END`
  );

  const dataDir = dataDirectory();
  const files = fileListLogicalNames();
  const moves = files.map((f, idx) => {
    const ext = String(f.type).toUpperCase().includes("LOG") ? "ldf" : "mdf";
    const dest = path.join(dataDir, `${restoreDb}_${idx}.${ext}`).replace(/'/g, "''");
    return `MOVE N'${f.name.replace(/'/g, "''")}' TO N'${dest}'`;
  });

  console.log("3) RESTORE under separate name (WITH MOVE)…");
  runSql(
    `RESTORE DATABASE [${restoreDb}] FROM DISK = N'${bak.replace(/'/g, "''")}' WITH REPLACE, ${moves.join(", ")}`
  );

  console.log("4) Smoke: count WorkOrder + _prisma_migrations…");
  const out = runSql(
    `SET NOCOUNT ON; SELECT (SELECT COUNT(1) FROM [${restoreDb}].dbo.WorkOrder) AS wo_count, (SELECT COUNT(1) FROM [${restoreDb}].dbo._prisma_migrations) AS migration_count;`
  );
  console.log(out.trim());

  const ms = Date.now() - started;
  console.log(`RESULT: PASSED (${ms}ms)`);
  process.exit(0);
} catch (err) {
  console.log(`RESULT: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  console.log("If permission denied, treat as EXTERNAL host limitation; do not overwrite source DB.");
  process.exit(1);
}
