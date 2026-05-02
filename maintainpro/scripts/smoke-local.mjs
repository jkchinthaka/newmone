const apiBaseUrl = process.env.MAINTAINPRO_API_URL ?? "http://localhost:3000/api";
const webUrl = process.env.MAINTAINPRO_WEB_URL ?? "http://localhost:3001";
const loginEmail = process.env.MAINTAINPRO_SMOKE_EMAIL ?? "admin@maintainpro.local";
const loginPassword = process.env.MAINTAINPRO_SMOKE_PASSWORD ?? "Admin@1234";

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

await check("API liveness", async () => {
  const response = await fetch(`${apiBaseUrl}/health`);
  const body = await readJson(response);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return body?.data?.service ?? body?.service ?? "healthy";
});

await check("API readiness", async () => {
  const response = await fetch(`${apiBaseUrl}/health/readiness`);
  const body = await readJson(response);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const readiness = body?.data ?? body;
  const requiredIssues = [...(readiness?.dependencies ?? []), ...(readiness?.configuration ?? [])]
    .filter((item) => item.required && item.status !== "operational")
    .map((item) => item.label);
  if (requiredIssues.length > 0) {
    throw new Error(`Required checks failing: ${requiredIssues.join(", ")}`);
  }
  return readiness?.status ?? "checked";
});

await check("Admin login", async () => {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword })
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

await check("Web app", async () => {
  const response = await fetch(webUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (!/MaintainPro|Maintenance Job|__next/i.test(html)) {
    throw new Error("Unexpected web response");
  }
  return webUrl;
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Smoke checks completed successfully.");