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

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));

async function fetchRenderPassword() {
  const apiKey = (process.env.RENDER_API_KEY ?? "").trim();
  const serviceId = (process.env.RENDER_SERVICE_ID ?? "").trim();
  if (!apiKey || !serviceId) {
    return (process.env.MAINTAINPRO_SEED_PASSWORD ?? "").trim();
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
  console.error("MAINTAINPRO_SEED_PASSWORD unavailable or too short.");
  process.exit(1);
}

const databaseUrl = (process.env.DATABASE_URL ?? process.env.PRIMARY_DATABASE_URL ?? "").trim();
if (!databaseUrl.startsWith("mongodb")) {
  console.error("DATABASE_URL is missing or not a MongoDB connection string.");
  process.exit(1);
}

console.log(`database_host=${new URL(databaseUrl.replace(/^mongodb(\+srv)?:\/\//, "https://")).hostname}`);
console.log("action=run_idempotent_seed");

const result = spawnSync("npm", ["run", "db:seed"], {
  cwd: root,
  env: {
    ...process.env,
    MAINTAINPRO_SEED_PASSWORD: seedPassword,
    DATABASE_URL: databaseUrl,
    PRIMARY_DATABASE_URL: databaseUrl
  },
  encoding: "utf8",
  stdio: "inherit",
  shell: true
});

process.exit(result.status ?? 1);
