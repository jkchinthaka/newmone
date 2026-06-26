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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
const apiKey = (process.env.RENDER_API_KEY ?? "").trim();
const serviceId = (process.env.RENDER_SERVICE_ID ?? "").trim();
const deployId = process.argv[2] ?? "";

async function renderFetch(endpoint) {
  const response = await fetch(`https://api.render.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
  });
  return response.json();
}

async function fetchEnv(key) {
  const payload = await renderFetch(`/services/${serviceId}/env-vars?limit=100`);
  const rows = Array.isArray(payload) ? payload.map((item) => item.envVar ?? item) : [];
  return rows.find((row) => row.key === key)?.value ?? "";
}

if (deployId) {
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    const payload = await renderFetch(`/services/${serviceId}/deploys/${deployId}`);
    const deploy = payload?.deploy ?? payload;
    console.log(`deploy_status=${deploy?.status ?? "unknown"}`);
    if (deploy?.status === "live") break;
    if (deploy?.status === "build_failed" || deploy?.status === "update_failed") process.exit(1);
    await sleep(15_000);
  }
}

const apiOrigin = "https://newmone.onrender.com";
const deadline = Date.now() + 300_000;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`${apiOrigin}/health`, { signal: AbortSignal.timeout(60_000) });
    console.log(`health=HTTP_${response.status}`);
    if (response.ok) break;
  } catch (error) {
    console.log(`health=waiting`);
  }
  await sleep(10_000);
}

const seedPassword = (await fetchEnv("MAINTAINPRO_SEED_PASSWORD")).trim();
if (seedPassword.length < 12) {
  console.log("seed_password=missing");
  process.exit(1);
}

const stagingApi = "https://newmone.onrender.com/api";
const webUrl = "https://newmone.chinthakajayaweera1.workers.dev";
const loginEnv = {
  MAINTAINPRO_API_URL: stagingApi,
  MAINTAINPRO_SMOKE_PASSWORD: seedPassword,
  MAINTAINPRO_SEED_PASSWORD: seedPassword
};

for (const [label, script] of [
  ["verify_logins", "scripts/verify-hosted-logins.mjs"],
  ["smoke_deploy", "scripts/smoke-deployment.mjs"]
]) {
  const env =
    label === "smoke_deploy"
      ? {
          ...loginEnv,
          MAINTAINPRO_WEB_URL: webUrl,
          MAINTAINPRO_SMOKE_EMAIL: "admin@maintainpro.local"
        }
      : loginEnv;
  const result = spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, ...env }, encoding: "utf8" });
  console.log((result.stdout ?? "").trim());
  if (result.status !== 0) {
    console.log(`${label}=FAIL`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}=PASS`);
}

// Disable startup seed after successful verification
await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars/MAINTAINPRO_RUN_STARTUP_SEED`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ value: "false" })
});
console.log("MAINTAINPRO_RUN_STARTUP_SEED=false");
