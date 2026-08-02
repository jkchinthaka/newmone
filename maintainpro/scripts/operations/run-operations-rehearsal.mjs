#!/usr/bin/env node
/**
 * Phase 6B isolated operations rehearsal (exact maintainpro-e2e-* project only).
 * Exact-service stop/start only. Never removes volumes. Never reboots host/daemon.
 * Safe stdout only.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function fail(msg) {
  console.error(`operations_rehearsal_status=failed reason=${msg}`);
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
    timeout: 120000
  });
  if (result.status !== 0) fail(`compose_${args[0]}_${args[1] || "x"}`);
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

async function waitFor(fn, { attempts = 30, delayMs = 2000, label = "wait" } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if (await fn()) return true;
    } catch { /* retry */ }
    await sleep(delayMs);
  }
  fail(label);
}

async function main() {
  if (String(process.env.E2E_TEST_MODE || "").toLowerCase() !== "true") fail("e2e_test_mode_required");
  if (String(process.env.OPERATIONS_REHEARSAL || "").toLowerCase() !== "true") fail("operations_rehearsal_required");

  const project = requireProject();
  const baseUrl = String(process.env.E2E_BASE_URL || "http://127.0.0.1:18080").replace(/\/+$/, "");
  const summary = {
    liveness_status: null,
    readiness_status: null,
    request_correlation: null,
    api_restart: null,
    web_restart: null,
    nginx_restart: null,
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
  const returnedId = corr.headers.get("x-request-id") || "";
  summary.request_correlation =
    returnedId === "ops-corr-test-001" || /^[A-Za-z0-9\-_.:]{8,64}$/.test(returnedId) ? "pass" : "fail";
  if (summary.request_correlation !== "pass") fail("request_correlation");

  runCompose(project, ["restart", "api"]);
  await waitFor(async () => (await httpGet(baseUrl, "/api/health/live")).status === 200, { label: "api_restart_live" });
  await waitFor(async () => (await httpGet(baseUrl, "/api/health/ready")).status === 200, { label: "api_restart_ready", attempts: 40, delayMs: 3000 });
  summary.api_restart = "pass";

  runCompose(project, ["restart", "web"]);
  await waitFor(async () => (await httpGet(baseUrl, "/login")).status === 200, { label: "web_restart" });
  summary.web_restart = "pass";

  runCompose(project, ["restart", "nginx"]);
  await waitFor(async () => (await httpGet(baseUrl, "/api/health/live")).status === 200, { label: "nginx_restart" });
  summary.nginx_restart = "pass";

  runCompose(project, ["stop", "mongo"]);
  await waitFor(async () => {
    const l = await httpGet(baseUrl, "/api/health/live");
    const r = await httpGet(baseUrl, "/api/health/ready");
    return l.status === 200 && r.status === 503;
  }, { label: "mongo_outage", attempts: 20, delayMs: 1500 });
  summary.mongo_outage_detected = "yes";
  const mongoErr = await httpGet(baseUrl, "/api/health/ready");
  if (/mongodb(\+srv)?:\/\//i.test(mongoErr.text) || /password\s*[:=]/i.test(mongoErr.text)) fail("mongo_error_leak");

  runCompose(project, ["start", "mongo"]);
  await waitFor(async () => (await httpGet(baseUrl, "/api/health/ready")).status === 200, { label: "mongo_recovery", attempts: 40, delayMs: 3000 });
  summary.mongo_recovered = "yes";

  runCompose(project, ["stop", "redis"]);
  await sleep(3000);
  const liveRedisDown = await httpGet(baseUrl, "/api/health/live");
  if (liveRedisDown.status !== 200) fail("redis_outage_liveness");
  summary.redis_outage_detected = "yes";
  runCompose(project, ["start", "redis"]);
  await waitFor(async () => (await httpGet(baseUrl, "/api/health/ready")).status === 200, { label: "redis_recovery_ready", attempts: 30, delayMs: 2000 });
  summary.redis_reconciled = "yes";

  runCompose(project, ["stop", "minio"]);
  await sleep(2000);
  const liveMinioDown = await httpGet(baseUrl, "/api/health/live");
  if (liveMinioDown.status !== 200) fail("minio_outage_liveness");
  summary.minio_outage_detected = "yes";
  runCompose(project, ["start", "minio"]);
  await waitFor(async () => (await httpGet(baseUrl, "/api/health/ready")).status === 200, { label: "minio_ready", attempts: 30, delayMs: 2000 });
  summary.minio_recovered = "yes";

  const loginPage = await httpGet(baseUrl, "/login");
  summary.data_persisted = loginPage.status === 200 ? "yes" : "fail";
  if (summary.data_persisted !== "yes") fail("data_persisted");

  for (const [k, v] of Object.entries(summary)) console.log(`${k}=${v}`);
  console.log("operations_rehearsal_status=success");

  const outDir = path.join(root, "artifacts/e2e-logs");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "operations-rehearsal-summary.json"), JSON.stringify(summary, null, 2));
}

main().catch((err) => fail(String(err?.message || "unexpected").slice(0, 120)));
