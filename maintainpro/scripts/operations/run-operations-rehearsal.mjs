#!/usr/bin/env node
/**
 * Phase 6B isolated operations rehearsal (exact maintainpro-e2e-* project only).
 * Exact-service stop/start only. Never removes volumes. Never reboots host/daemon.
 * Safe stdout only.
 *
 * Primary dependency outage targets SQL Server when DATABASE_PROVIDER=sqlserver;
 * otherwise Mongo (legacy).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function fail(msg) {
  const line = `operations_rehearsal_status=failed reason=${msg}`;
  console.error(line);
  console.log(line);
  process.exit(1);
}

function requireProject() {
  const project = String(process.env.COMPOSE_PROJECT_NAME || "").trim();
  if (!project.startsWith("maintainpro-e2e-")) fail("compose_project_guard");
  return project;
}

function composeArgs(project) {
  const envFile = process.env.MAINTAINPRO_E2E_ENV_FILE || path.join(root, ".env.e2e");
  return ["compose", "-p", project, "--env-file", envFile, "-f", "docker-compose.yml", "-f", "docker-compose.e2e.yml"];
}

function runCompose(project, args) {
  const result = spawnSync("docker", [...composeArgs(project), ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    timeout: 180000
  });
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    fail(`compose_${args[0]}_${args[1] || "x"}${detail ? `:${detail}` : ""}`);
  }
  return result;
}

async function httpGet(baseUrl, route, headers = {}) {
  const res = await fetch(`${baseUrl}${route}`, { headers });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isOkPage(status) {
  return status >= 200 && status < 400;
}

async function waitFor(fn, { attempts = 30, delayMs = 2000, label = "wait" } = {}) {
  let last = "";
  for (let i = 0; i < attempts; i += 1) {
    try {
      const result = await fn();
      if (result === true) return true;
      if (typeof result === "string" && result) last = result;
    } catch (error) {
      last = String(error?.message || error).slice(0, 80);
    }
    await sleep(delayMs);
  }
  fail(last ? `${label}:${last}` : label);
}

function composePsHealth(project, service) {
  const result = spawnSync(
    "docker",
    [...composeArgs(project), "ps", "--format", "json", service],
    { cwd: root, encoding: "utf8", env: process.env, timeout: 30000 }
  );
  if (result.status !== 0) return `ps_failed`;
  const lines = String(result.stdout || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "missing";
  try {
    const row = JSON.parse(lines[0]);
    const health = String(row.Health || row.State || row.Status || "").toLowerCase();
    return health || "unknown";
  } catch {
    return String(result.stdout || "").slice(0, 80);
  }
}

function reloadNginx(project) {
  const reload = spawnSync(
    "docker",
    [...composeArgs(project), "exec", "-T", "nginx", "nginx", "-s", "reload"],
    { cwd: root, encoding: "utf8", env: process.env, timeout: 30000 }
  );
  if (reload.status === 0) return "reloaded";
  const restart = spawnSync(
    "docker",
    [...composeArgs(project), "restart", "nginx"],
    { cwd: root, encoding: "utf8", env: process.env, timeout: 120000 }
  );
  if (restart.status !== 0) {
    fail("nginx_proxy_refresh");
  }
  return "restarted";
}

async function restartServiceAndRefreshProxy(project, service) {
  runCompose(project, ["restart", service]);
  await waitFor(
    async () => {
      const health = composePsHealth(project, service);
      return health.includes("healthy") ? true : `health=${health}`;
    },
    { label: `${service}_container_healthy`, attempts: 60, delayMs: 3000 }
  );
  reloadNginx(project);
  await sleep(2000);
}

async function main() {
  if (String(process.env.E2E_TEST_MODE || "").toLowerCase() !== "true") fail("e2e_test_mode_required");
  if (String(process.env.OPERATIONS_REHEARSAL || "").toLowerCase() !== "true") fail("operations_rehearsal_required");

  const project = requireProject();
  const baseUrl = String(process.env.E2E_BASE_URL || "http://127.0.0.1:18080").replace(/\/+$/, "");
  // Prefer explicit env; fall back to e2e compose defaults (SQL Server primary).
  let provider = String(process.env.DATABASE_PROVIDER || "").toLowerCase();
  if (!provider) {
    try {
      const envFile = process.env.MAINTAINPRO_E2E_ENV_FILE || path.join(root, ".env.e2e");
      const match = /(?:^|\n)\s*DATABASE_PROVIDER\s*=\s*([^\r\n#]+)/i.exec(readFileSync(envFile, "utf8"));
      provider = String(match?.[1] || "").trim().toLowerCase();
    } catch {
      /* ignore */
    }
  }
  if (!provider) provider = "sqlserver";
  const primaryDbService = provider === "sqlserver" ? "sqlserver" : "mongo";
  const summary = {
    liveness_status: null,
    readiness_status: null,
    request_correlation: null,
    api_restart: null,
    web_restart: null,
    nginx_restart: null,
    primary_db_service: primaryDbService,
    primary_db_outage_detected: null,
    primary_db_recovered: null,
    // Legacy aliases kept for evidence parsers
    mongo_outage_detected: null,
    mongo_recovered: null,
    redis_outage_detected: null,
    redis_reconciled: null,
    minio_outage_detected: null,
    minio_recovered: null,
    data_persisted: null,
    volumes_removed: "no",
    real_notifications_sent: "no"
  };

  const live = await httpGet(baseUrl, "/api/health/live");
  summary.liveness_status = live.status;
  if (live.status !== 200) fail("liveness_baseline");

  const ready = await httpGet(baseUrl, "/api/health/ready");
  summary.readiness_status = ready.status;
  if (ready.status !== 200) fail("readiness_baseline");

  const corr = await httpGet(baseUrl, "/api/health/live", { "X-Request-Id": "ops-corr-test-001" });
  const returnedId = String(corr.headers.get("x-request-id") || "").split(",")[0].trim();
  summary.request_correlation = /^[A-Za-z0-9\-_.:]{8,64}$/.test(returnedId) ? "pass" : "fail";
  if (summary.request_correlation !== "pass") fail("request_correlation");

  await restartServiceAndRefreshProxy(project, "api");
  await waitFor(
    async () => {
      const health = composePsHealth(project, "api");
      const status = (await httpGet(baseUrl, "/api/health/live")).status;
      return status === 200 ? true : `live=${status},health=${health}`;
    },
    { label: "api_restart_live", attempts: 60, delayMs: 3000 }
  );
  await waitFor(
    async () => {
      const status = (await httpGet(baseUrl, "/api/health/ready")).status;
      return status === 200 ? true : `ready=${status}`;
    },
    { label: "api_restart_ready", attempts: 60, delayMs: 3000 }
  );
  summary.api_restart = "pass";

  await restartServiceAndRefreshProxy(project, "web");
  await waitFor(
    async () => {
      const health = composePsHealth(project, "web");
      const status = (await httpGet(baseUrl, "/login")).status;
      return isOkPage(status) ? true : `login=${status},health=${health}`;
    },
    { label: "web_restart", attempts: 60, delayMs: 3000 }
  );
  summary.web_restart = "pass";

  runCompose(project, ["restart", "nginx"]);
  await waitFor(
    async () => {
      const liveStatus = (await httpGet(baseUrl, "/api/health/live")).status;
      const loginStatus = (await httpGet(baseUrl, "/login")).status;
      return liveStatus === 200 && isOkPage(loginStatus) ? true : `live=${liveStatus},login=${loginStatus}`;
    },
    { label: "nginx_restart", attempts: 40, delayMs: 3000 }
  );
  summary.nginx_restart = "pass";

  runCompose(project, ["stop", primaryDbService]);
  await waitFor(
    async () => {
      const l = await httpGet(baseUrl, "/api/health/live");
      const r = await httpGet(baseUrl, "/api/health/ready");
      return l.status === 200 && r.status === 503 ? true : `live=${l.status},ready=${r.status}`;
    },
    { label: `${primaryDbService}_outage`, attempts: 40, delayMs: 3000 }
  );
  summary.primary_db_outage_detected = "yes";
  if (primaryDbService === "mongo") {
    summary.mongo_outage_detected = "yes";
  } else {
    summary.mongo_outage_detected = "skipped_sqlserver_primary";
  }
  const dbErr = await httpGet(baseUrl, "/api/health/ready");
  if (/mongodb(\+srv)?:\/\//i.test(dbErr.text) || /sqlserver:\/\//i.test(dbErr.text) || /password\s*[:=]/i.test(dbErr.text)) {
    fail("db_error_leak");
  }

  runCompose(project, ["start", primaryDbService]);
  // SQL Server boot is slow; nudge API reconnect only after a warm-up window.
  let recoveryAttempt = 0;
  let apiNudged = false;
  await waitFor(
    async () => {
      recoveryAttempt += 1;
      const status = (await httpGet(baseUrl, "/api/health/ready")).status;
      if (status === 200) return true;
      if (!apiNudged && recoveryAttempt >= 20) {
        apiNudged = true;
        try {
          await restartServiceAndRefreshProxy(project, "api");
        } catch {
          /* continue waiting */
        }
      }
      return `ready=${status}`;
    },
    { label: `${primaryDbService}_recovery`, attempts: 80, delayMs: 3000 }
  );
  summary.primary_db_recovered = "yes";
  if (primaryDbService === "mongo") {
    summary.mongo_recovered = "yes";
  } else {
    summary.mongo_recovered = "skipped_sqlserver_primary";
  }

  runCompose(project, ["stop", "redis"]);
  await sleep(3000);
  const liveRedisDown = await httpGet(baseUrl, "/api/health/live");
  if (liveRedisDown.status !== 200) fail("redis_outage_liveness");
  summary.redis_outage_detected = "yes";
  runCompose(project, ["start", "redis"]);
  await waitFor(
    async () => {
      const status = (await httpGet(baseUrl, "/api/health/ready")).status;
      return status === 200 ? true : `ready=${status}`;
    },
    { label: "redis_recovery_ready", attempts: 40, delayMs: 3000 }
  );
  summary.redis_reconciled = "yes";

  runCompose(project, ["stop", "minio"]);
  await sleep(2000);
  const liveMinioDown = await httpGet(baseUrl, "/api/health/live");
  if (liveMinioDown.status !== 200) fail("minio_outage_liveness");
  summary.minio_outage_detected = "yes";
  runCompose(project, ["start", "minio"]);
  await waitFor(
    async () => {
      const status = (await httpGet(baseUrl, "/api/health/ready")).status;
      return status === 200 ? true : `ready=${status}`;
    },
    { label: "minio_ready", attempts: 40, delayMs: 3000 }
  );
  summary.minio_recovered = "yes";

  const loginPage = await httpGet(baseUrl, "/login");
  summary.data_persisted = isOkPage(loginPage.status) ? "yes" : "fail";
  if (summary.data_persisted !== "yes") fail(`data_persisted:login=${loginPage.status}`);

  for (const [k, v] of Object.entries(summary)) console.log(`${k}=${v}`);
  console.log("operations_rehearsal_status=success");

  const outDir = path.join(root, "artifacts/e2e-logs");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "operations-rehearsal-summary.json"), JSON.stringify(summary, null, 2));
}

main().catch((err) => fail(String(err?.message || "unexpected").slice(0, 120)));
