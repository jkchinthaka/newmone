import "dotenv/config";

const webBase = process.env.ACTION_CENTER_QA_BASE_URL ?? "http://localhost:3001";
const apiBase = process.env.ACCEPTANCE_API_BASE ?? "http://localhost:3000/api";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

function cookieHeader(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

async function timed(label, fn) {
  const started = performance.now();
  const value = await fn();
  const ms = Math.round(performance.now() - started);
  return { label, ms, ...value };
}

async function main() {
  const rows = [];

  rows.push(
    await timed("GET /health", async () => {
      const res = await fetch("http://localhost:3000/health");
      return { status: res.status };
    })
  );

  rows.push(
    await timed("POST login (BFF)", async () => {
      const res = await fetch(`${webBase}/api/backend/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "127.0.4.1" },
        body: JSON.stringify({ email: "admin@maintainpro.local", password })
      });
      const cookies = cookieHeader(res);
      return { status: res.status, cookies };
    })
  );

  const cookies = rows.find((r) => r.label.startsWith("POST login"))?.cookies;
  if (!cookies) throw new Error("login failed");

  for (const [label, url] of [
    ["GET queues aggregate", `${apiBase}/work-orders/queues`],
    ["GET work-orders list page1", `${apiBase}/work-orders?page=1&pageSize=25`],
    ["GET notifications", `${apiBase}/notifications?page=1&pageSize=20`],
    ["GET reporting-kpis overview", `${apiBase}/reporting-kpis/overview`]
  ]) {
    rows.push(
      await timed(label, async () => {
        const res = await fetch(url, { headers: { cookie: cookies } });
        const text = await res.text();
        return { status: res.status, bytes: text.length };
      })
    );
  }

  for (const [label, path] of [
    ["NAV /action-center", "/action-center"],
    ["NAV /work-orders", "/work-orders"],
    ["NAV /reports", "/reports"],
    ["NAV /inventory", "/inventory"]
  ]) {
    rows.push(
      await timed(label, async () => {
        const res = await fetch(`${webBase}${path}`, {
          headers: { cookie: cookies },
          redirect: "manual"
        });
        return { status: res.status };
      })
    );
  }

  // Warm second pass for usable-time approximation
  const warm = await timed("NAV /action-center (warm)", async () => {
    const res = await fetch(`${webBase}/action-center`, { headers: { cookie: cookies } });
    return { status: res.status };
  });
  rows.push(warm);

  console.log(JSON.stringify({ capturedAt: new Date().toISOString(), rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
