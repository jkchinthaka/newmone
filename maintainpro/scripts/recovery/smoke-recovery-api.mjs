#!/usr/bin/env node
/**
 * Boot temporary recovery API against restored DB using the existing api image.
 * Loopback-only. Never prints passwords, tokens, or cookies.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const port = process.env.E2E_RECOVERY_API_PORT || "19091";
const base = `http://127.0.0.1:${port}`;
const containerName = `${process.env.COMPOSE_PROJECT_NAME}-recovery-api`;

function composeArgs(extra) {
  return [
    "compose",
    "-p",
    process.env.COMPOSE_PROJECT_NAME,
    "--env-file",
    process.env.MAINTAINPRO_E2E_ENV_FILE || ".env.e2e",
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.e2e.yml",
    ...extra
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
    throw new Error(
      (r.stderr || r.stdout || "")
        .slice(0, 500)
        .replace(/mongodb:\/\/[^\s]+/gi, "mongodb://REDACTED")
    );
  }
  return r.stdout || "";
}

function findToken(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (typeof node === "object") {
    if (typeof node.accessToken === "string") return node.accessToken;
    for (const v of Object.values(node)) {
      const found = findToken(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function waitHealth(timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.status === 200) return;
    } catch {
      /* retry */
    }
    if ((Date.now() - start) % 15000 < 2100) console.log("waiting_recovery_api=yes");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("recovery_api_health_timeout");
}

function stopRecovery() {
  try {
    runDocker(["rm", "-f", containerName]);
  } catch {
    /* ignore */
  }
}

async function main() {
  // Ensure logs are visible even if the process is interrupted.

  const target = (process.env.RECOVERY_TARGET_DATABASE || "").trim();
  if (!target.startsWith("maintainpro_restore_")) throw new Error("invalid restore target");

  stopRecovery();
  console.log("recovery_api_boot=starting");

  const user = process.env.MONGO_APP_USERNAME || "e2e_app_not_prod";
  const pass = process.env.MONGO_APP_PASSWORD || "e2e_app_password_not_for_production_use";
  const authDb = process.env.MONGO_INITDB_DATABASE || "maintainpro_e2e_auth";
  const backupDb = process.env.BACKUP_DATABASE_NAME || "maintainpro_e2e_backup";
  // Construct URL in env assignment without printing.
  const dbUrl = `mongodb://${user}:${pass}@mongo:27017/${target}?authSource=${authDb}&replicaSet=rs0`;
  const backupUrl = `mongodb://${user}:${pass}@mongo:27017/${backupDb}?authSource=${authDb}&replicaSet=rs0`;

  runDocker(
    composeArgs([
      "run",
      "-d",
      "--no-deps",
      "--name",
      containerName,
      "-p",
      `127.0.0.1:${port}:3000`,
      "-e",
      "DATABASE_REPLICATION_MODE=disabled",
      "-e",
      "BACKUP_DATABASE_REQUIRED_FOR_READINESS=false",
      "-e",
      `PRIMARY_DATABASE_NAME=${target}`,
      "-e",
      `PRIMARY_DATABASE_URL=${dbUrl}`,
      "-e",
      `DATABASE_URL=${dbUrl}`,
      "-e",
      `MONGODB_URI=${dbUrl}`,
      "-e",
      `BACKUP_DATABASE_URL=${backupUrl}`,
      "-e",
      "REDIS_KEY_PREFIX=e2e-recovery:",
      "-e",
      `APP_SERVICE_NAME=maintainpro-api-recovery`,
      "api"
    ])
  );

  // Confirm detached container is running before health polling.
  const ps = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", containerName], {
    encoding: "utf8"
  });
  console.log(`recovery_container_running=${String(ps.stdout || "").trim() || "unknown"}`);
  if (String(ps.stdout || "").trim() !== "true") {
    const logs = spawnSync("docker", ["logs", "--tail", "40", containerName], { encoding: "utf8" });
    const safe = `${logs.stdout || ""}${logs.stderr || ""}`.slice(0, 500).replace(/mongodb:\/\/[^\s]+/gi, "mongodb://REDACTED");
    console.error(`recovery_container_logs=${safe}`);
    throw new Error("recovery container not running");
  }
  await waitHealth();
  console.log("recovery_api_health=200");

  const emailDomain = (process.env.E2E_SEED_EMAIL_DOMAIN || "e2e.maintainpro.test").trim();
  const runId = process.env.E2E_RUN_ID;
  const email = `admin-a.${runId}@${emailDomain}`.toLowerCase();
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error("E2E_SEED_PASSWORD missing");

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  console.log(`recovery_login=${loginRes.status}`);
  if (loginRes.status !== 200) throw new Error("recovery login failed");
  const loginJson = await loginRes.json().catch(() => ({}));
  const token = findToken(loginJson);
  if (!token) throw new Error("missing access token shape");

  const authHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const me = await fetch(`${base}/api/auth/me`, { headers: authHeaders });
  console.log(`recovery_auth_me=${me.status}`);
  if (me.status !== 200) throw new Error("auth/me failed");

  const tenantHeader = {};
  try {
    const meBody = await me.json();
    const tenantId = meBody?.data?.tenantId || meBody?.data?.user?.tenantId;
    if (tenantId) tenantHeader["x-tenant-id"] = tenantId;
  } catch {
    /* ignore */
  }
  const headers = { ...authHeaders, ...tenantHeader };

  const wo = await fetch(`${base}/api/work-orders?page=1&pageSize=5`, { headers });
  console.log(`recovery_work_orders=${wo.status}`);
  const inv = await fetch(`${base}/api/inventory/parts?page=1&pageSize=5`, { headers });
  console.log(`recovery_inventory=${inv.status}`);
  const po = await fetch(`${base}/api/purchase-orders?page=1&pageSize=5`, { headers });
  console.log(`recovery_purchase_orders=${po.status}`);
  const dash = await fetch(`${base}/api/reports/dashboard`, { headers });
  console.log(`recovery_dashboard=${dash.status}`);
  const audit = await fetch(`${base}/api/audit-logs?page=1&pageSize=5`, { headers });
  console.log(`recovery_audit=${audit.status}`);

  const ok =
    wo.status === 200 &&
    inv.status === 200 &&
    (po.status === 200 || po.status === 403) &&
    dash.status === 200 &&
    (audit.status === 200 || audit.status === 403);
  if (!ok) throw new Error("business smoke failed");
  console.log("application_smoke_status=pass");

  stopRecovery();
  console.log("recovery_api_stopped=yes");
  process.exitCode = 0;
}

main()
  .then(() => {
    if (process.exitCode === undefined) process.exitCode = 0;
  })
  .catch((err) => {
    console.error("application_smoke_status=fail");
    console.error(`error=${String(err.message || err).slice(0, 250)}`);
    stopRecovery();
    process.exit(1);
  });