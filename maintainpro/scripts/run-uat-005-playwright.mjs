import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

loadEnvFile(path.join(process.cwd(), ".env.render.local"));

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
const stagingEnv = {
  ...process.env,
  MAINTAINPRO_WEB_URL: "https://newmone.chinthakajayaweera1.workers.dev",
  MAINTAINPRO_API_URL: "https://newmone.onrender.com/api",
  MAINTAINPRO_SMOKE_PASSWORD: seedPassword,
  MAINTAINPRO_SEED_PASSWORD: seedPassword
};

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["run", "test:e2e:staging:uat005"], {
  cwd: process.cwd(),
  env: stagingEnv,
  stdio: "inherit",
  shell: process.platform === "win32"
});
process.exit(result.status ?? 1);
