const rawApiUrl =
  process.env.MAINTAINPRO_API_ORIGIN ??
  process.env.DEPLOY_API_ORIGIN ??
  process.env.MAINTAINPRO_API_URL ??
  process.env.DEPLOY_API_URL ??
  "http://localhost:3000";

function toApiOrigin(value) {
  return value.replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

const healthUrl = `${toApiOrigin(rawApiUrl)}/health`;
const response = await fetch(healthUrl, { signal: AbortSignal.timeout(20000) });
const body = await readJson(response);

if (!response.ok) {
  throw new Error(`Healthcheck failed: HTTP ${response.status}`);
}

const health = body?.data ?? body;
if (health?.database?.status && health.database.status !== "operational") {
  throw new Error(`Database health is ${health.database.status}: ${health.database.message ?? "no detail"}`);
}

console.log(`OK healthcheck ${healthUrl} - ${health?.status ?? "healthy"}`);