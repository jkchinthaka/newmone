const frontendUrl = (process.env.MAINTAINPRO_WEB_URL ?? process.env.DEPLOY_FRONTEND_URL ?? "").replace(/\/+$/, "");
const rawApiUrl = (process.env.MAINTAINPRO_API_URL ?? process.env.DEPLOY_API_URL ?? "").replace(/\/+$/, "");
const loginEmail = process.env.MAINTAINPRO_SMOKE_EMAIL ?? "admin@maintainpro.local";
const loginPassword = process.env.MAINTAINPRO_SMOKE_PASSWORD ?? "Admin@1234";

if (!frontendUrl || !rawApiUrl) {
  console.error("Set MAINTAINPRO_WEB_URL and MAINTAINPRO_API_URL before running smoke:deploy.");
  process.exit(1);
}

function toApiBaseUrl(value) {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function toApiOrigin(value) {
  return toApiBaseUrl(value).replace(/\/api$/, "");
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function check(name, fn) {
  const startedAt = performance.now();
  try {
    const detail = await fn();
    const elapsed = Math.round(performance.now() - startedAt);
    console.log(`OK ${name} (${elapsed} ms)${detail ? ` - ${detail}` : ""}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const apiBaseUrl = toApiBaseUrl(rawApiUrl);
const apiOrigin = toApiOrigin(rawApiUrl);

await check("Frontend loads", async () => {
  const response = await fetch(frontendUrl, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (!/MaintainPro|Maintenance Job|__next/i.test(html)) {
    throw new Error("Unexpected frontend HTML");
  }
  return frontendUrl;
});

await check("Backend health", async () => {
  const response = await fetch(`${apiOrigin}/health`, { signal: AbortSignal.timeout(25000) });
  const body = await readJson(response);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const health = body?.data ?? body;
  if (health?.database?.status !== "operational") {
    throw new Error(`Database is ${health?.database?.status ?? "unknown"}`);
  }
  return `${health?.service ?? "api"} ${health?.status ?? "healthy"}`;
});

await check("CORS preflight", async () => {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: frontendUrl,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    },
    signal: AbortSignal.timeout(15000)
  });
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (allowedOrigin !== frontendUrl) {
    throw new Error(`Expected access-control-allow-origin ${frontendUrl}, got ${allowedOrigin ?? "empty"}`);
  }
  if (response.headers.get("access-control-allow-credentials") !== "true") {
    throw new Error("Credentials are not enabled in CORS response");
  }
  return "credentials allowed";
});

await check("Login endpoint", async () => {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: frontendUrl
    },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    signal: AbortSignal.timeout(25000)
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? body?.message ?? `HTTP ${response.status}`);
  }
  if (!body?.data?.accessToken) throw new Error("Access token missing from login response");
  if (JSON.stringify(body?.data?.user ?? {}).includes("passwordHash")) {
    throw new Error("Login response exposed passwordHash");
  }
  return body?.message ?? "login accepted";
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Deployment smoke checks completed successfully.");