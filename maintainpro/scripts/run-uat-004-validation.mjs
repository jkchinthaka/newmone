import { spawnSync } from "node:child_process";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function run(label, command, args, extraEnv = {}, options = {}) {
  console.log(`STEP=${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: options.shell && process.platform === "win32"
  });
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.status !== 0) {
    console.log(`${label}=FAIL`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}=PASS`);
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

const seedPassword = await fetchRenderPassword();
if (seedPassword.length < 12) {
  console.log("credentials=missing");
  process.exit(1);
}

const stagingEnv = {
  MAINTAINPRO_WEB_URL: "https://newmone.chinthakajayaweera1.workers.dev",
  MAINTAINPRO_API_URL: "https://newmone.onrender.com/api",
  MAINTAINPRO_SMOKE_PASSWORD: seedPassword,
  MAINTAINPRO_SEED_PASSWORD: seedPassword
};

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = { shell: true };

run("uat_004_production_hardening", process.execPath, ["scripts/uat-004-production-hardening.mjs"], stagingEnv);
run("test_e2e_staging_uat004", npmCmd, ["run", "test:e2e:staging:uat004"], stagingEnv, npmShell);
run("uat_003_validate", process.execPath, ["scripts/run-uat-003-validation.mjs"], stagingEnv);
console.log("uat_004_validation=complete");
