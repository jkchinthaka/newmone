import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) {
    return out;
  }
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, i).trim()] = value;
  }
  return out;
}

const root = process.cwd();
const render = loadEnvFile(path.join(root, ".env.render.local"));
const env = loadEnvFile(path.join(root, ".env"));

function reportKey(key) {
  const renderValue = (render[key] ?? "").trim();
  const envValue = (env[key] ?? "").trim();
  const source = renderValue ? "render.local" : envValue ? "env" : "missing";
  const length = (renderValue || envValue).length;
  console.log(`${key}: source=${source} len=${length}`);
}

[
  "RENDER_API_KEY",
  "RENDER_SERVICE_ID",
  "MAINTAINPRO_SEED_PASSWORD",
  "MAINTAINPRO_SMOKE_PASSWORD",
  "SMOKE_LOGIN_EMAIL",
  "MAINTAINPRO_SMOKE_EMAIL",
  "PRIMARY_DATABASE_URL",
  "DATABASE_URL"
].forEach(reportKey);

const localSeed = (env.MAINTAINPRO_SEED_PASSWORD ?? render.MAINTAINPRO_SEED_PASSWORD ?? "").trim();
const localSmoke = (env.MAINTAINPRO_SMOKE_PASSWORD ?? render.MAINTAINPRO_SMOKE_PASSWORD ?? "").trim();
console.log(`local_seed_smoke_match=${localSeed && localSmoke ? String(localSeed === localSmoke) : "n/a"}`);
console.log(
  `smoke_email=${(
    env.SMOKE_LOGIN_EMAIL ??
    env.MAINTAINPRO_SMOKE_EMAIL ??
    render.SMOKE_LOGIN_EMAIL ??
    "(default admin@maintainpro.local)"
  ).trim()}`
);

const apiKey = (render.RENDER_API_KEY ?? env.RENDER_API_KEY ?? "").trim();
const serviceId = (render.RENDER_SERVICE_ID ?? env.RENDER_SERVICE_ID ?? "").trim();

let renderSeedLen = 0;
if (apiKey && serviceId) {
  const response = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars?limit=100`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
  });
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload.map((item) => item.envVar ?? item) : [];
  renderSeedLen = (rows.find((row) => row.key === "MAINTAINPRO_SEED_PASSWORD")?.value ?? "").trim().length;
  console.log(`render_api_status=${response.status} render_seed_password_len=${renderSeedLen}`);
} else {
  console.log("render_api=skipped (RENDER_API_KEY or RENDER_SERVICE_ID missing)");
}

if (localSeed && renderSeedLen) {
  console.log(`local_render_seed_match=${String(localSeed.length === renderSeedLen)}`);
}
