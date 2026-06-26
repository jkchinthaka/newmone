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

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));

async function fetchRenderPassword() {
  const apiKey = (process.env.RENDER_API_KEY ?? "").trim();
  const serviceId = (process.env.RENDER_SERVICE_ID ?? "").trim();
  if (!apiKey || !serviceId) {
    return (process.env.MAINTAINPRO_SMOKE_PASSWORD ?? process.env.MAINTAINPRO_SEED_PASSWORD ?? "").trim();
  }
  const response = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars?limit=100`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
  });
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload.map((item) => item.envVar ?? item) : [];
  return (rows.find((row) => row.key === "MAINTAINPRO_SEED_PASSWORD")?.value ?? "").trim();
}

const password = await fetchRenderPassword();
if (password.length < 12) {
  console.log("credentials=missing");
  process.exit(1);
}

const stagingEnv = {
  MAINTAINPRO_WEB_URL: "https://newmone.chinthakajayaweera1.workers.dev",
  MAINTAINPRO_API_URL: "https://newmone.onrender.com/api",
  MAINTAINPRO_SMOKE_PASSWORD: password,
  MAINTAINPRO_SEED_PASSWORD: password,
  MAINTAINPRO_SMOKE_EMAIL: "admin@maintainpro.local"
};

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...stagingEnv },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: process.platform === "win32"
  });
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  const stderr = (result.stderr ?? "").trim();
  if (stderr) console.error(stderr.slice(-1200));
  if (result.status !== 0) {
    console.log(`${label}=FAIL`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}=PASS`);
}

run("uat_002_api", process.execPath, ["scripts/uat-002-api-workflows.mjs"]);
run("test_e2e", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:e2e:staging:uat002"]);
run("smoke", process.execPath, ["scripts/smoke-deployment.mjs"]);
