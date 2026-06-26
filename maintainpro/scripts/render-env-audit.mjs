import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

const apiKey = (process.env.RENDER_API_KEY ?? "").trim();
const serviceId = (process.env.RENDER_SERVICE_ID ?? "").trim();

if (!apiKey || !serviceId) {
  console.log("RENDER_CONFIG=missing");
  process.exit(1);
}

const WATCH = [
  "DATABASE_URL",
  "PRIMARY_DATABASE_URL",
  "MONGO_DATABASE_NAME",
  "PRIMARY_DATABASE_NAME",
  "MAINTAINPRO_SEED_PASSWORD",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CORS_ORIGIN",
  "FRONTEND_URL"
];

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

const response = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars?limit=100`, {
  headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
});

if (!response.ok) {
  console.log(`RENDER_API_ERROR=HTTP_${response.status}`);
  process.exit(1);
}

const payload = await response.json();
const vars = Array.isArray(payload) ? payload.map((item) => item.envVar ?? item) : [];

for (const key of WATCH) {
  const row = vars.find((v) => v.key === key);
  if (!row) {
    console.log(`${key}:missing`);
    continue;
  }
  const value = row.value ?? "";
  if (!value.trim()) {
    console.log(`${key}:empty`);
    continue;
  }
  if (key.includes("DATABASE") || key.includes("URL") || key.includes("PASSWORD") || key.includes("SECRET")) {
    if (key === "DATABASE_URL" || key === "PRIMARY_DATABASE_URL") {
      console.log(`${key}:set db=${dbNameFromUri(value)}`);
    } else {
      console.log(`${key}:set`);
    }
  } else {
    console.log(`${key}:${value}`);
  }
}
