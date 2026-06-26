import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = stripQuotes(trimmed.slice(i + 1).trim());
  }
}

function dbNameFromUri(uri) {
  if (!uri || typeof uri !== "string") return "unknown";
  try {
    const pathname = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "https://")).pathname;
    const name = pathname.replace(/^\//, "").split("?")[0];
    return name || "unknown";
  } catch {
    const match = uri.match(/\/([^/?]+)(?:\?|$)/);
    return match?.[1] ?? "unknown";
  }
}

function generatePassword() {
  return randomBytes(24).toString("base64url");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));

const apiKey = (process.env.RENDER_API_KEY ?? "").trim();
const serviceId = (process.env.RENDER_SERVICE_ID ?? "").trim();

if (!apiKey || !serviceId) {
  console.log("RENDER_CONFIG=missing");
  process.exit(1);
}

async function renderFetch(endpoint, init = {}) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(init.headers ?? {})
  };
  if (init.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`https://api.render.com/v1${endpoint}`, { ...init, headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data?.message ?? data?.error ?? `HTTP ${response.status}`;
    throw new Error(`Render API ${response.status}: ${message}`);
  }
  return data;
}

async function fetchEnvVars() {
  const payload = await renderFetch(`/services/${serviceId}/env-vars?limit=100`);
  const rows = Array.isArray(payload) ? payload.map((item) => item.envVar ?? item) : [];
  const map = new Map();
  for (const row of rows) {
    if (row?.key) map.set(row.key, row.value ?? "");
  }
  return map;
}

async function upsertEnvVar(key, value) {
  await renderFetch(`/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value })
  });
}

function runCommand(label, command, args, env = {}) {
  console.log(`STEP=${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32"
  });
  const stdout = (result.stdout ?? "").trim();
  const stderr = (result.stderr ?? "").trim();
  if (stdout) console.log(stdout);
  if (stderr && !/password|mongodb(\+srv)?:\/\//i.test(stderr)) {
    console.error(stderr.slice(0, 500));
  }
  if (result.status !== 0) {
    console.log(`${label}=FAIL exit=${result.status ?? "unknown"}`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}=PASS`);
}

const webUrl = (
  process.env.MAINTAINPRO_WEB_URL ??
  process.env.STAGING_WEB_URL ??
  "https://newmone.chinthakajayaweera1.workers.dev"
).replace(/\/+$/, "");

const stagingApi = (
  process.env.MAINTAINPRO_API_URL ??
  process.env.STAGING_API_URL ??
  "https://newmone.onrender.com/api"
).replace(/\/+$/, "");

const apiOrigin = stagingApi.replace(/\/api$/, "");

const envVars = await fetchEnvVars();
const databaseUrl = (envVars.get("DATABASE_URL") ?? envVars.get("PRIMARY_DATABASE_URL") ?? "").trim();
const frontendUrl = (envVars.get("FRONTEND_URL") ?? webUrl).trim();

console.log(`DATABASE_URL:set db=${dbNameFromUri(databaseUrl)}`);
console.log(`FRONTEND_URL:${frontendUrl ? "set" : "missing"}`);
console.log(`MAINTAINPRO_SEED_PASSWORD:${envVars.get("MAINTAINPRO_SEED_PASSWORD")?.trim() ? "set" : "missing"}`);
console.log(`CORS_ORIGIN:${envVars.get("CORS_ORIGIN")?.trim() ? "set" : "missing"}`);

if (!databaseUrl) {
  console.log("DATABASE_URL=missing_on_render");
  process.exit(1);
}

let seedPassword = (process.env.MAINTAINPRO_SEED_PASSWORD ?? process.env.MAINTAINPRO_SMOKE_PASSWORD ?? "").trim();
const renderSeed = (envVars.get("MAINTAINPRO_SEED_PASSWORD") ?? "").trim();

if (seedPassword.length < 12 && renderSeed.length >= 12) {
  seedPassword = renderSeed;
}

if (seedPassword.length < 12) {
  seedPassword = generatePassword();
  await upsertEnvVar("MAINTAINPRO_SEED_PASSWORD", seedPassword);
  console.log("MAINTAINPRO_SEED_PASSWORD=updated_on_render");
} else if (!renderSeed || renderSeed !== seedPassword) {
  await upsertEnvVar("MAINTAINPRO_SEED_PASSWORD", seedPassword);
  console.log("MAINTAINPRO_SEED_PASSWORD=aligned_on_render");
} else {
  console.log("MAINTAINPRO_SEED_PASSWORD=already_aligned");
}

if (!envVars.get("CORS_ORIGIN")?.trim() && frontendUrl) {
  await upsertEnvVar("CORS_ORIGIN", frontendUrl);
  console.log("CORS_ORIGIN=set_from_frontend_url");
}

await upsertEnvVar("MAINTAINPRO_RUN_STARTUP_SEED", "true");
console.log("MAINTAINPRO_RUN_STARTUP_SEED=true");

runCommand("render_deploy", process.execPath, ["scripts/render-deploy.mjs"]);

const deployWaitMs = Number(process.env.UAT_DEPLOY_WAIT_MS ?? 240_000);
const pollMs = Number(process.env.UAT_DEPLOY_POLL_MS ?? 15_000);
const deadline = Date.now() + deployWaitMs;
let warmed = false;

while (Date.now() < deadline) {
  try {
    const response = await fetch(`${apiOrigin}/health`, { signal: AbortSignal.timeout(60_000) });
    if (response.ok) {
      warmed = true;
      console.log(`render_warmup=HTTP_${response.status}`);
      break;
    }
    console.log(`render_warmup=HTTP_${response.status}`);
  } catch (error) {
    console.log(`render_warmup=waiting ${error instanceof Error ? error.message : String(error)}`);
  }
  await sleep(pollMs);
}

if (!warmed) {
  console.log("render_warmup=FAIL timeout");
  process.exit(1);
}

await upsertEnvVar("MAINTAINPRO_RUN_STARTUP_SEED", "false");
console.log("MAINTAINPRO_RUN_STARTUP_SEED=false");

const loginEnv = {
  MAINTAINPRO_API_URL: stagingApi,
  MAINTAINPRO_SMOKE_PASSWORD: seedPassword,
  MAINTAINPRO_SEED_PASSWORD: seedPassword
};

runCommand("verify_logins", process.execPath, ["scripts/verify-hosted-logins.mjs"], loginEnv);

const smokeEnv = {
  MAINTAINPRO_WEB_URL: webUrl,
  MAINTAINPRO_API_URL: stagingApi,
  MAINTAINPRO_SMOKE_EMAIL: "admin@maintainpro.local",
  MAINTAINPRO_SMOKE_PASSWORD: seedPassword
};

runCommand("smoke_deploy", process.execPath, ["scripts/smoke-deployment.mjs"], smokeEnv);

console.log("UAT-001_BOOTSTRAP=complete");
console.log("ACTION=store MAINTAINPRO_SEED_PASSWORD in secret manager; set shell MAINTAINPRO_SMOKE_PASSWORD to the same value");
