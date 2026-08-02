#!/usr/bin/env node
/**
 * Boot temporary recovery-api against restored DB and smoke login/business reads.
 * Never prints passwords, tokens, or cookies.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const port = process.env.E2E_RECOVERY_API_PORT || "19091";
const base = `http://127.0.0.1:${port}`;

function compose(args) {
  const r = spawnSync(
    "docker",
    [
      "compose",
      "-p",
      process.env.COMPOSE_PROJECT_NAME,
      "--env-file",
      process.env.MAINTAINPRO_E2E_ENV_FILE || ".env.e2e",
      "-f",
      "docker-compose.yml",
      "-f",
      "docker-compose.e2e.yml",
      "-f",
      "docker-compose.recovery.yml",
      "--profile",
      "recovery",
      ...args
    ],
    { cwd: root, encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"] }
  );
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "").slice(0, 500).replace(/mongodb:\/\/[^\s]+/gi, "mongodb://REDACTED"));
  }
  return r.stdout || "";
}

async function waitHealth(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.status === 200) return;
    } catch {
      /* retry */
    }
    if ((Date.now() - start) % 15000 < 2100) console.log("waiting_recovery_api=yes"); await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("recovery_api_health_timeout");
}

function findToken(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (typeof node === "string" && node.length > 20) return null;
  if (typeof node === "object") {
    if (typeof node.accessToken === "string") return node.accessToken;
    for (const v of Object.values(node)) {
      const found = findToken(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function main() {
  const target = (process.env.RECOVERY_TARGET_DATABASE || "").trim();
  if (!target.startsWith("maintainpro_restore_")) throw new Error("invalid restore target");

  console.log("recovery_api_boot=starting");
  compose(["up", "-d", "--no-deps", "recovery-api"]);
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
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    throw new Error("recovery login failed");
  }
  const loginJson = await loginRes.json().catch(() => ({}));
  const token = findToken(loginJson);
  if (!token) throw new Error("missing access token shape");

  const authHeaders = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  };

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
    (inv.status === 200 || inv.status === 404) &&
    (po.status === 200 || po.status === 403 || po.status === 404) &&
    dash.status === 200 &&
    (audit.status === 200 || audit.status === 403);
  if (!ok) throw new Error("business smoke failed");
  console.log("application_smoke_status=pass");

  // Stop only the recovery-api service; do not touch volumes.
  compose(["stop", "recovery-api"]);
  compose(["rm", "-f", "recovery-api"]);
  console.log("recovery_api_stopped=yes");
}

main().catch((err) => {
  console.error("application_smoke_status=fail");
  console.error(`error=${String(err.message || err).slice(0, 250)}`);
  try {
    compose(["stop", "recovery-api"]);
    compose(["rm", "-f", "recovery-api"]);
  } catch {
    /* ignore */
  }
  process.exit(1);
});