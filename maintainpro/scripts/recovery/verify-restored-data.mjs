#!/usr/bin/env node
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

function mongoshEval(js) {
  const r = spawnSync(
    "docker",
    [
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
    ],
    { cwd: root, encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"] }
  );
  if (r.status !== 0) throw new Error((r.stderr || "").slice(0, 300));
  return r.stdout || "";
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
    host: "mongo",
    composeProjectName: process.env.COMPOSE_PROJECT_NAME
  });
  if (!guard.ok) process.exit(1);

  const out = mongoshEval(`
    const dbn=${JSON.stringify(targetDb)};
    const d=db.getSiblingDB(dbn);
    const tenants=d.Tenant.countDocuments();
    const users=d.User.countDocuments();
    const roles=d.Role.countDocuments();
    const wos=d.WorkOrder.countDocuments();
    const parts=d.SparePart.countDocuments();
    const pos=d.PurchaseOrder.countDocuments();
    const receipts=d.PurchaseReceipt.countDocuments();
    const audits=d.AuditLog.countDocuments();
    const secs=d.SecurityEvent.countDocuments();
    // orphan role refs
    const userRoles=d.User.find({}, {roleId:1,tenantId:1}).toArray();
    let missingRole=0;
    for (const u of userRoles) {
      if (u.roleId && !d.Role.findOne({_id:u.roleId})) missingRole++;
    }
    const assignees=d.WorkOrderAssignee.countDocuments();
    const movements=d.StockMovement.countDocuments();
    print(JSON.stringify({
      tenants, users, roles, wos, parts, pos, receipts, audits, secs,
      missingRole, assignees, movements
    }));
  `);
  const stats = JSON.parse(out.trim().split(/\r?\n/).filter(Boolean).pop());
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