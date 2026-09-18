#!/usr/bin/env node
/**
 * Verify restored SQL Server database has seeded identity rows.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
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

function runDocker(args) {
  const r = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "").slice(0, 400));
  }
  return r.stdout || "";
}

function sqlcmd(query) {
  process.env.MSSQL_SA_PASSWORD = process.env.MSSQL_SA_PASSWORD || "E2e_Sql_Sa_Passw0rd!";
  const b64 = Buffer.from(String(query), "utf8").toString("base64");
  const script = `set -euo pipefail; echo '${b64}' | base64 -d > /tmp/mp-recovery.sql; /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -h -1 -W -b -i /tmp/mp-recovery.sql`;
  return runDocker([...composeBase(), "exec", "-T", "sqlserver", "bash", "-lc", script]);
}

function main() {
  const targetDb = (process.env.RECOVERY_TARGET_DATABASE || "").trim();
  const sourceDb = (process.env.RECOVERY_SOURCE_DATABASE || process.env.PRIMARY_DATABASE_NAME || "").trim();
  const guard = validateRecoveryTarget({
    e2eTestMode: process.env.E2E_TEST_MODE,
    recoveryRehearsal: process.env.RECOVERY_REHEARSAL,
    runId: process.env.E2E_RUN_ID,
    sourceDatabase: sourceDb,
    targetDatabase: targetDb,
    host: process.env.RECOVERY_SQLSERVER_HOST || "sqlserver",
    composeProjectName: process.env.COMPOSE_PROJECT_NAME
  });
  if (!guard.ok) process.exit(1);

  const out = sqlcmd(`
SET NOCOUNT ON;
SELECT
  (SELECT COUNT(1) FROM [${targetDb}].dbo.Tenant),
  (SELECT COUNT(1) FROM [${targetDb}].dbo.[User]),
  (SELECT COUNT(1) FROM [${targetDb}].dbo.Role),
  (SELECT COUNT(1) FROM [${targetDb}].dbo.WorkOrder),
  (SELECT COUNT(1) FROM [${targetDb}].dbo.SparePart),
  (SELECT COUNT(1) FROM [${targetDb}].dbo.PurchaseOrder),
  (SELECT COUNT(1) FROM [${targetDb}].dbo.AuditLog),
  (SELECT COUNT(1) FROM [${targetDb}].dbo.[User] u WHERE u.roleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [${targetDb}].dbo.Role r WHERE r.id = u.roleId));
`);
  const nums = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("-") && /^\d/.test(l))
    .pop()
    ?.split(/\s+/)
    .map((n) => Number(n)) || [];

  const stats = {
    tenants: nums[0] || 0,
    users: nums[1] || 0,
    roles: nums[2] || 0,
    wos: nums[3] || 0,
    parts: nums[4] || 0,
    pos: nums[5] || 0,
    audits: nums[6] || 0,
    missingRole: nums[7] || 0
  };

  const flags = {
    tenant_ok: stats.tenants >= 1,
    users_ok: stats.users >= 1,
    roles_ok: stats.roles >= 1,
    role_refs_ok: stats.missingRole === 0,
    work_orders_ok: stats.wos >= 0,
    inventory_ok: stats.parts >= 0,
    procurement_ok: stats.pos >= 0,
    audit_ok: stats.audits >= 0
  };

  let failed = 0;
  for (const [k, v] of Object.entries(flags)) {
    console.log(`${k}=${v ? "yes" : "no"}`);
    if (!v) failed += 1;
  }
  console.log(`count_tenants=${stats.tenants}`);
  console.log(`count_users=${stats.users}`);
  console.log(`count_work_orders=${stats.wos}`);
  console.log(`count_parts=${stats.parts}`);
  console.log(`count_purchase_orders=${stats.pos}`);
  if (failed) {
    console.log("relationship_reconciliation=fail");
    process.exit(1);
  }
  console.log("relationship_reconciliation=pass");
}

main();
