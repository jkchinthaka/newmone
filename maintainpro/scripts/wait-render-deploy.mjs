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

const deployId = process.argv[2];
const serviceId = process.env.RENDER_SERVICE_ID;
const apiKey = process.env.RENDER_API_KEY;

if (!deployId || !serviceId || !apiKey) {
  console.log("wait_render_deploy=skipped");
  process.exit(0);
}

for (let attempt = 0; attempt < 40; attempt += 1) {
  const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys/${deployId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
  });
  const payload = await response.json();
  const status = payload?.status ?? payload?.deploy?.status ?? "unknown";
  console.log(`deploy_status=${status}`);
  if (status === "live") {
    console.log("wait_render_deploy=live");
    process.exit(0);
  }
  if (status === "build_failed" || status === "canceled" || status === "update_failed") {
    console.log("wait_render_deploy=failed");
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}

console.log("wait_render_deploy=timeout");
process.exit(1);
