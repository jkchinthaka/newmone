import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));

const apiBase = (process.env.MAINTAINPRO_API_URL ?? "https://newmone.onrender.com/api").replace(/\/+$/, "");
const webUrl = (process.env.MAINTAINPRO_WEB_URL ?? "https://newmone.chinthakajayaweera1.workers.dev").replace(/\/+$/, "");

async function timedFetch(label, url, init = {}) {
  const started = performance.now();
  const response = await fetch(url, init);
  const ms = Math.round(performance.now() - started);
  return { label, url, status: response.status, ms, ok: response.ok };
}

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

async function main() {
  const results = [];
  results.push(await timedFetch("health", `${apiBase.replace(/\/api$/, "")}/health`));
  results.push(await timedFetch("frontend_home", webUrl));

  const password = await fetchRenderPassword();
  if (password.length >= 12) {
    const loginStarted = performance.now();
    const loginRes = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.SMOKE_LOGIN_EMAIL ?? "superadmin@maintainpro.local",
        password
      })
    });
    const loginMs = Math.round(performance.now() - loginStarted);
    const loginBody = await loginRes.json().catch(() => ({}));
    const token = loginBody?.data?.accessToken ?? loginBody?.accessToken;
    if (token) {
      const auth = { Authorization: `Bearer ${token}` };
      const tenantId = loginBody?.data?.user?.tenantId ?? loginBody?.data?.tenantId;
      const headers = {
        ...auth,
        ...(tenantId ? { "X-Tenant-Id": tenantId } : {})
      };
      for (const [label, route] of [
        ["work_orders_list", "/work-orders?page=1&pageSize=50"],
        ["work_orders_queues", "/work-orders/queues"],
        ["taxonomy_suggest", "/work-orders/taxonomy/suggest?q=brake"],
        ["management_summary", "/reports/management/profitability/summary"]
      ]) {
        const row = await timedFetch(label, `${apiBase}${route}`, { headers });
        results.push(row);
      }
    } else {
      results.push({ label: "login", url: `${apiBase}/auth/login`, status: loginRes.status, ms: loginMs, ok: false });
    }
  }

  const reportPath = path.join(root, "docs", "go-live", "performance-probe-results.json");
  writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");

  const slow = results.filter((r) => r.ms > 8000);
  if (slow.length > 0) {
    console.log(`performance_probe=WARN slow=${slow.map((r) => r.label).join(",")}`);
  } else {
    console.log("performance_probe=PASS");
  }
  for (const row of results) {
    console.log(`${row.label}=${row.status} ${row.ms}ms`);
  }
}

main().catch((error) => {
  console.error(`performance_probe=FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
