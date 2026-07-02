const frontendUrl = (
  process.env.MAINTAINPRO_WEB_URL ??
  process.env.STAGING_WEB_URL ??
  process.env.DEPLOY_FRONTEND_URL ??
  ""
).replace(/\/+$/, "");
const rawApiUrl = (
  process.env.MAINTAINPRO_API_URL ??
  process.env.STAGING_API_URL ??
  process.env.DEPLOY_API_URL ??
  ""
).replace(/\/+$/, "");
const loginEmail = (process.env.MAINTAINPRO_SMOKE_EMAIL ?? process.env.SMOKE_LOGIN_EMAIL ?? "").trim();
const loginPassword = process.env.MAINTAINPRO_SMOKE_PASSWORD ?? process.env.SMOKE_LOGIN_PASSWORD ?? "";

if (!frontendUrl || !rawApiUrl) {
  console.error(
    "Set MAINTAINPRO_WEB_URL (or STAGING_WEB_URL) and MAINTAINPRO_API_URL (or STAGING_API_URL) before running smoke:deploy."
  );
  process.exit(1);
}

if (!loginEmail || !loginPassword) {
  console.error(
    "Set MAINTAINPRO_SMOKE_EMAIL (or SMOKE_LOGIN_EMAIL) and MAINTAINPRO_SMOKE_PASSWORD (or SMOKE_LOGIN_PASSWORD) before running smoke:deploy."
  );
  process.exit(1);
}

// Render free-tier instances spin down when idle. The first request after a cold
// start can take 30-60s+ to boot the process, and the first MongoDB Atlas query on
// top of that can add another 10-20s. Keep these generous so a slow-but-healthy
// deploy doesn't read as a failure.
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 60_000);
const WARMUP_ATTEMPTS = Number(process.env.SMOKE_WARMUP_ATTEMPTS ?? 2);
const WARMUP_DELAY_MS = Number(process.env.SMOKE_WARMUP_DELAY_MS ?? 5_000);
const RETRY_ATTEMPTS = Number(process.env.SMOKE_RETRY_ATTEMPTS ?? 2);
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 5_000);

function toApiBaseUrl(value) {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function toApiOrigin(value) {
  return toApiBaseUrl(value).replace(/\/api$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatFetchError(error, timeoutMs, context) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Error && error.name === "AbortError") {
    return `${context} timed out after ${timeoutMs}ms (Render cold start or slow Atlas query — retry or increase SMOKE_REQUEST_TIMEOUT_MS)`;
  }
  return `${context} failed: ${message}`;
}

// Use a manually-managed AbortController (rather than AbortSignal.timeout()) so the
// timer is always cleared once the request settles. On Node 24, a timeout signal
// that fires after fetch() has already resolved/rejected can otherwise surface as
// an unhandled "AbortError".
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function withRetry(fn, { attempts = RETRY_ATTEMPTS, delayMs = RETRY_DELAY_MS } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(delayMs * attempt);
      }
    }
  }
  throw lastError;
}

async function check(name, fn) {
  const startedAt = performance.now();
  try {
    const detail = await withRetry(fn);
    const elapsed = Math.round(performance.now() - startedAt);
    console.log(`OK ${name} (${elapsed} ms)${detail ? ` - ${detail}` : ""}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const apiBaseUrl = toApiBaseUrl(rawApiUrl);
const apiOrigin = toApiOrigin(rawApiUrl);

async function warmUp() {
  for (let attempt = 1; attempt <= WARMUP_ATTEMPTS; attempt += 1) {
    const startedAt = performance.now();
    try {
      const response = await fetchWithTimeout(`${apiOrigin}/health`, {}, REQUEST_TIMEOUT_MS);
      const elapsed = Math.round(performance.now() - startedAt);
      console.log(`Warm-up attempt ${attempt}: HTTP ${response.status} (${elapsed} ms)`);
      if (response.ok) return;
    } catch (error) {
      const elapsed = Math.round(performance.now() - startedAt);
      console.log(
        `Warm-up attempt ${attempt} failed after ${elapsed} ms: ${formatFetchError(error, REQUEST_TIMEOUT_MS, "Health warm-up")}`
      );
    }
    if (attempt < WARMUP_ATTEMPTS) {
      await sleep(WARMUP_DELAY_MS);
    }
  }
}

await warmUp();

function extractChunkUrls(html) {
  return [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"'\s]+/g)].map((match) => match[0]))];
}

function isJavaScriptContentType(contentType) {
  const normalized = (contentType ?? "").toLowerCase();
  return normalized.includes("javascript") || normalized.includes("ecmascript");
}

async function verifyRouteChunks(routePath, label) {
  let response;
  try {
    response = await fetchWithTimeout(`${frontendUrl}${routePath}`);
  } catch (error) {
    throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, `${label} request`));
  }
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }
  const html = await response.text();
  const chunkUrls = extractChunkUrls(html);
  if (chunkUrls.length === 0) {
    throw new Error(`${label} did not reference any /_next/static/chunks assets`);
  }

  const failures = [];
  for (const chunkPath of chunkUrls.slice(0, 12)) {
    const chunkUrl = `${frontendUrl}${chunkPath}`;
    let chunkResponse;
    try {
      chunkResponse = await fetchWithTimeout(chunkUrl, {}, REQUEST_TIMEOUT_MS);
    } catch (error) {
      failures.push(`${chunkPath} (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    const contentType = chunkResponse.headers.get("content-type") ?? "";
    if (!chunkResponse.ok) {
      failures.push(`${chunkPath} (HTTP ${chunkResponse.status}, content-type=${contentType || "missing"})`);
      continue;
    }
    if (!isJavaScriptContentType(contentType)) {
      failures.push(`${chunkPath} (content-type=${contentType || "missing"})`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`${label} chunk validation failed: ${failures.slice(0, 3).join("; ")}`);
  }

  return `${label} ${chunkUrls.length} chunk refs OK`;
}

await check("Frontend route chunks /", async () => verifyRouteChunks("/", "home"));
await check("Frontend route chunks /work-orders", async () => verifyRouteChunks("/work-orders", "work-orders"));
await check(
  "Frontend route chunks /maintenance/job-codes",
  async () => verifyRouteChunks("/maintenance/job-codes", "maintenance/job-codes")
);

await check("Frontend loads", async () => {
  let response;
  try {
    response = await fetchWithTimeout(frontendUrl);
  } catch (error) {
    throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, "Frontend request"));
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (!/MaintainPro|Maintenance Job|__next/i.test(html)) {
    throw new Error("Unexpected frontend HTML");
  }
  return frontendUrl;
});

await check("Backend health", async () => {
  let response;
  try {
    response = await fetchWithTimeout(`${apiOrigin}/health`);
  } catch (error) {
    throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, "Backend health request"));
  }
  const body = await readJson(response);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const health = body?.data ?? body;
  if (health?.database?.status !== "operational") {
    throw new Error(
      `Database status is ${health?.database?.status ?? "unknown"}${health?.database?.message ? `: ${health.database.message}` : ""}`
    );
  }
  return `${health?.service ?? "api"} ${health?.status ?? "healthy"}`;
});

await check("Backend readiness", async () => {
  const readinessKey = (process.env.READINESS_API_KEY ?? "").trim();
  const headers = readinessKey ? { "x-readiness-key": readinessKey } : {};
  let response;
  try {
    response = await fetchWithTimeout(`${apiOrigin}/health/readiness`, { headers });
  } catch (error) {
    throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, "Backend readiness request"));
  }
  if (response.status === 403 && !readinessKey) {
    return "skipped (protected in production; set READINESS_API_KEY for full readiness check)";
  }
  const body = await readJson(response);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const readiness = body?.data ?? body;
  const primaryDb = (readiness?.dependencies ?? []).find((item) => item.key === "primaryDatabase");
  if (primaryDb?.status !== "operational") {
    throw new Error(
      `Primary MongoDB readiness is ${primaryDb?.status ?? "unknown"}${primaryDb?.message ? `: ${primaryDb.message}` : ""}`
    );
  }
  const dbName = primaryDb?.details?.databaseName ?? "unknown";
  return `overall=${readiness?.status ?? "unknown"} primaryDb=${dbName}`;
});

await check("CORS preflight", async () => {
  let response;
  try {
    response = await fetchWithTimeout(`${apiBaseUrl}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: frontendUrl,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
      }
    });
  } catch (error) {
    throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, "CORS preflight request"));
  }
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (allowedOrigin === "*") {
    throw new Error("Wildcard access-control-allow-origin is not allowed with credentials");
  }
  if (allowedOrigin !== frontendUrl) {
    throw new Error(`Expected access-control-allow-origin ${frontendUrl}, got ${allowedOrigin ?? "empty"}`);
  }
  if (response.headers.get("access-control-allow-credentials") !== "true") {
    throw new Error("Credentials are not enabled in CORS response");
  }
  return "credentials allowed";
});

async function assertRouteAvailable(path, token, label) {
  let response;
  try {
    response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: frontendUrl
      }
    });
  } catch (error) {
    throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, `${label} request`));
  }

  if (response.status === 404) {
    throw new Error(`${label} returned HTTP 404 (route missing on deployed API)`);
  }
  if (response.status === 401) {
    throw new Error(`${label} returned HTTP 401 (token rejected unexpectedly)`);
  }

  return `${label} HTTP ${response.status}`;
}

let smokeAccessToken = "";

await check("Login endpoint", async () => {
  let response;
  try {
    response = await fetchWithTimeout(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: frontendUrl
      },
      body: JSON.stringify({ email: loginEmail, password: loginPassword })
    });
  } catch (error) {
    throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, "Login request"));
  }
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? body?.message ?? `HTTP ${response.status} (login rejected)`);
  }
  if (!body?.data?.accessToken) throw new Error("Access token missing from login response");
  if (JSON.stringify(body?.data?.user ?? {}).includes("passwordHash")) {
    throw new Error("Login response exposed passwordHash");
  }
  smokeAccessToken = body.data.accessToken;
  return body?.message ?? "login accepted";
});

await check("Workforce employees route", async () =>
  assertRouteAvailable("/workforce/employees?designation=TECHNICIAN", smokeAccessToken, "GET /workforce/employees")
);

await check("Work order assignees route", async () => {
  const listResponse = await fetchWithTimeout(`${apiBaseUrl}/work-orders`, {
    headers: {
      Authorization: `Bearer ${smokeAccessToken}`,
      Origin: frontendUrl
    }
  });
  const listBody = await readJson(listResponse);
  if (!listResponse.ok) {
    throw new Error(`GET /work-orders returned HTTP ${listResponse.status}`);
  }
  const rows = Array.isArray(listBody?.data) ? listBody.data : [];
  const workOrderId = rows[0]?.id;
  if (!workOrderId) {
    return "skipped (no work orders in staging tenant)";
  }
  return assertRouteAvailable(`/work-orders/${workOrderId}/assignees`, smokeAccessToken, "GET /work-orders/:id/assignees");
});

await check("Work order history route", async () => {
  const listResponse = await fetchWithTimeout(`${apiBaseUrl}/work-orders`, {
    headers: {
      Authorization: `Bearer ${smokeAccessToken}`,
      Origin: frontendUrl
    }
  });
  const listBody = await readJson(listResponse);
  if (!listResponse.ok) {
    throw new Error(`GET /work-orders returned HTTP ${listResponse.status}`);
  }
  const rows = Array.isArray(listBody?.data) ? listBody.data : [];
  const workOrderId = rows[0]?.id;
  if (!workOrderId) {
    return "skipped (no work orders in staging tenant)";
  }
  return assertRouteAvailable(`/work-orders/${workOrderId}/history`, smokeAccessToken, "GET /work-orders/:id/history");
});

await check("Work order queues route", async () => {
  let response;
  try {
    response = await fetchWithTimeout(
      `${apiBaseUrl}/work-orders/queues`,
      {
        headers: {
          Authorization: `Bearer ${smokeAccessToken}`,
          Origin: frontendUrl
        }
      },
      Number(process.env.SMOKE_QUEUES_TIMEOUT_MS ?? 120_000)
    );
  } catch (error) {
    throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, "GET /work-orders/queues request"));
  }
  const body = await readJson(response);
  if (response.status === 404) {
    throw new Error("GET /work-orders/queues returned HTTP 404 (route missing on deployed API)");
  }
  if (response.status === 503) {
    throw new Error(body?.error?.message ?? "GET /work-orders/queues returned HTTP 503");
  }
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `GET /work-orders/queues returned HTTP ${response.status}`);
  }
  const payload = body?.data ?? body;
  if (!Array.isArray(payload?.queues)) {
    throw new Error("Queue summary response missing queues array");
  }
  return `queues=${payload.queues.length}`;
});

await check("Work order taxonomy suggest route", async () => {
  for (const query of ["brake", "wifi", "unknowntext"]) {
    let response;
    try {
      response = await fetchWithTimeout(`${apiBaseUrl}/work-orders/taxonomy/suggest?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${smokeAccessToken}`,
          Origin: frontendUrl
        }
      });
    } catch (error) {
      throw new Error(formatFetchError(error, REQUEST_TIMEOUT_MS, `taxonomy suggest (${query}) request`));
    }
    const body = await readJson(response);
    if (response.status === 404) {
      throw new Error(`GET /work-orders/taxonomy/suggest?q=${query} returned HTTP 404 (route missing)`);
    }
    if (!response.ok) {
      throw new Error(body?.error?.message ?? `taxonomy suggest (${query}) returned HTTP ${response.status}`);
    }
    const payload = body?.data ?? body;
    if (!("suggestion" in payload)) {
      throw new Error(`taxonomy suggest (${query}) missing suggestion field`);
    }
  }
  return "brake/wifi/unknown queries accepted";
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Deployment smoke checks completed successfully.");
