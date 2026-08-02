#!/usr/bin/env node
/**
 * Boot temporary recovery API against restored DB using the existing api image.
 * Synchronous control flow (no early-exit async races). Never prints secrets.
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

function httpJson(method, urlPath, { headers = {}, body } = {}) {
  const args = [
    "-sS",
    "-o",
    "-",
    "-w",
    "\n__STATUS__:%{http_code}",
    "-X",
    method,
    `${base}${urlPath}`
  ];
  for (const [k, v] of Object.entries(headers)) {
    args.push("-H", `${k}: ${v}`);
  }
  if (body !== undefined) {
    args.push("-H", "content-type: application/json");
    args.push("--data-binary", body);
  }
  const r = spawnSync("curl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const text = `${r.stdout || ""}`;
  const m = /__STATUS__:(\d{3})\s*$/.exec(text);
  const status = m ? Number(m[1]) : 0;
  const raw = m ? text.slice(0, m.index) : text;
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  return { status, json, raw };
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

function waitHealth(timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = spawnSync(
      "curl",
      ["-sS", "-o", "/dev/null", "-w", "%{http_code}", `${base}/api/health`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    if (String(r.stdout || "").trim() === "200") return;
    if ((Date.now() - start) % 15000 < 2100) console.log("waiting_recovery_api=yes");
    spawnSync("sleep", ["2"]);
  }
  throw new Error("recovery_api_health_timeout");
}

function stopRecovery() {
  try {
    spawnSync("docker", ["rm", "-f", containerName], { encoding: "utf8" });
  } catch {
    /* ignore */
  }
}

function main() {
  const target = (process.env.RECOVERY_TARGET_DATABASE || "").trim();
  if (!target.startsWith("maintainpro_restore_")) throw new Error("invalid restore target");

  stopRecovery();
  console.log("recovery_api_boot=starting");

  const user = process.env.MONGO_APP_USERNAME || "e2e_app_not_prod";
  const pass = process.env.MONGO_APP_PASSWORD || "e2e_app_password_not_for_production_use";
  const authDb = process.env.MONGO_INITDB_DATABASE || "maintainpro_e2e_auth";
  const backupDb = process.env.BACKUP_DATABASE_NAME || "maintainpro_e2e_backup";
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
      "APP_SERVICE_NAME=maintainpro-api-recovery",
      "api"
    ])
  );

  const running = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", containerName], {
    encoding: "utf8"
  });
  console.log(`recovery_container_running=${String(running.stdout || "").trim() || "unknown"}`);
  if (String(running.stdout || "").trim() !== "true") {
    const logs = spawnSync("docker", ["logs", "--tail", "50", containerName], { encoding: "utf8" });
    console.error(
      `recovery_container_logs=${`${logs.stdout || ""}${logs.stderr || ""}`
        .slice(0, 600)
        .replace(/mongodb:\/\/[^\s]+/gi, "mongodb://REDACTED")}`
    );
    throw new Error("recovery container not running");
  }

  waitHealth();
  console.log("recovery_api_health=200");

  const emailDomain = (process.env.E2E_SEED_EMAIL_DOMAIN || "e2e.maintainpro.test").trim();
  const runId = process.env.E2E_RUN_ID;
  const email = `admin-a.${runId}@${emailDomain}`.toLowerCase();
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error("E2E_SEED_PASSWORD missing");

  const login = httpJson("POST", "/api/auth/login", {
    body: JSON.stringify({ email, password })
  });
  console.log(`recovery_login=${login.status}`);
  if (login.status !== 200) throw new Error("recovery login failed");
  const token = findToken(login.json);
  if (!token) throw new Error("missing access token shape");

  const authHeaders = { authorization: `Bearer ${token}` };
  const me = httpJson("GET", "/api/auth/me", { headers: authHeaders });
  console.log(`recovery_auth_me=${me.status}`);
  if (me.status !== 200) throw new Error("auth/me failed");

  const tenantId = me.json?.data?.tenantId || me.json?.data?.user?.tenantId;
  const headers = { ...authHeaders };
  if (tenantId) headers["x-tenant-id"] = String(tenantId);

  const wo = httpJson("GET", "/api/work-orders?page=1&pageSize=5", { headers });
  console.log(`recovery_work_orders=${wo.status}`);
  const inv = httpJson("GET", "/api/inventory/parts?page=1&pageSize=5", { headers });
  console.log(`recovery_inventory=${inv.status}`);
  const po = httpJson("GET", "/api/purchase-orders?page=1&pageSize=5", { headers });
  console.log(`recovery_purchase_orders=${po.status}`);
  const dash = httpJson("GET", "/api/reports/dashboard", { headers });
  console.log(`recovery_dashboard=${dash.status}`);
  const audit = httpJson("GET", "/api/audit-logs?page=1&pageSize=5", { headers });
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
}

try {
  main();
  process.exit(0);
} catch (err) {
  console.error("application_smoke_status=fail");
  console.error(`error=${String(err.message || err).slice(0, 250)}`);
  stopRecovery();
  process.exit(1);
}