/**
 * SQL Server backup → restore to a different disposable DB → count compare → drop.
 * Uses Docker sqlserver container (maintainpro-sqlserver-1).
 */
import { spawnSync } from "node:child_process";

const container = process.env.PHASE2_SQL_CONTAINER || "maintainpro-sqlserver-1";
const saPassword = process.env.MSSQL_SA_PASSWORD || "MaintainPro_Dev_Passw0rd!";
const sourceDb = process.env.PHASE2_BACKUP_SOURCE_DB || "MaintainProDev";
const targetDb = process.env.PHASE2_RESTORE_DB || `MaintainProPhase2Restore_${Date.now().toString(36)}`;
const bakPath = `/var/opt/mssql/backup/${targetDb}.bak`;

function sqlcmd(query) {
  const r = spawnSync(
    "docker",
    [
      "exec",
      container,
      "/opt/mssql-tools18/bin/sqlcmd",
      "-C",
      "-S",
      "localhost",
      "-U",
      "sa",
      "-P",
      saPassword,
      "-h",
      "-1",
      "-W",
      "-b",
      "-Q",
      query
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error(`sqlcmd failed: ${(r.stderr || r.stdout || "").slice(0, 800)}`);
  }
  return (r.stdout || "").trim();
}

function counts(db) {
  const out = sqlcmd(`
SET NOCOUNT ON;
SELECT
  (SELECT COUNT(1) FROM [${db}].dbo.Tenant),
  (SELECT COUNT(1) FROM [${db}].dbo.[User]),
  (SELECT COUNT(1) FROM [${db}].dbo.Role),
  (SELECT COUNT(1) FROM [${db}].dbo.WorkOrder),
  (SELECT COUNT(1) FROM [${db}].dbo.MaintenanceRequest),
  (SELECT COUNT(1) FROM [${db}].dbo.SparePart),
  (SELECT COUNT(1) FROM [${db}].dbo._prisma_migrations);
`);
  const cols = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .pop()
    .split(/\s+/)
    .map(Number);
  return {
    Tenant: cols[0],
    User: cols[1],
    Role: cols[2],
    WorkOrder: cols[3],
    MaintenanceRequest: cols[4],
    SparePart: cols[5],
    PrismaMigrations: cols[6]
  };
}

function main() {
  console.log(JSON.stringify({ step: "backup", sourceDb, bakPath }));
  sqlcmd(`
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'${sourceDb}')
  THROW 50001, 'source db missing', 1;
BACKUP DATABASE [${sourceDb}] TO DISK = N'${bakPath}' WITH INIT, COPY_ONLY, STATS = 5;
`);

  const before = counts(sourceDb);
  console.log(JSON.stringify({ step: "source-counts", before }));

  console.log(JSON.stringify({ step: "restore", targetDb }));
  sqlcmd(`
IF DB_ID(N'${targetDb}') IS NOT NULL
BEGIN
  ALTER DATABASE [${targetDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [${targetDb}];
END
RESTORE DATABASE [${targetDb}] FROM DISK = N'${bakPath}' WITH REPLACE,
  MOVE N'MaintainProDev' TO N'/var/opt/mssql/data/${targetDb}.mdf',
  MOVE N'MaintainProDev_log' TO N'/var/opt/mssql/data/${targetDb}_log.ldf';
`);

  // Logical file names may differ — probe and retry if needed
  let after;
  try {
    after = counts(targetDb);
  } catch (e) {
    // Retry restore with discovered logical names
    const files = sqlcmd(`RESTORE FILELISTONLY FROM DISK = N'${bakPath}'`);
    console.log(JSON.stringify({ step: "filelist", files: files.slice(0, 500) }));
    throw e;
  }

  const match = JSON.stringify(before) === JSON.stringify(after);
  console.log(JSON.stringify({ step: "compare", before, after, match }, null, 2));

  sqlcmd(`
ALTER DATABASE [${targetDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE [${targetDb}];
`);
  console.log(JSON.stringify({ step: "cleanup-done", targetDb }));

  if (!match) process.exit(1);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
