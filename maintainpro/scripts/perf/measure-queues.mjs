import { readFileSync } from "node:fs";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);

async function session(email) {
  const login = await fetch("http://127.0.0.1:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await login.json();
  const token = body?.data?.accessToken ?? body?.accessToken;
  const tenant = body?.data?.user?.tenantId ?? body?.data?.tenants?.[0]?.id ?? "";
  return { status: login.status, token, tenant };
}

async function timed(token, tenant, path) {
  const samples = [];
  for (let i = 0; i < 3; i += 1) {
    const start = Date.now();
    const response = await fetch(`http://127.0.0.1:3000/api${path}`, {
      headers: { authorization: `Bearer ${token}`, ...(tenant ? { "x-tenant-id": tenant } : {}) }
    });
    const bytes = (await response.arrayBuffer()).byteLength;
    samples.push({ status: response.status, ms: Date.now() - start, bytes });
  }
  return samples;
}

for (const [role, email, list] of [
  ["admin", "admin@maintainpro.local", "/work-orders/queues/action-required?page=1&pageSize=25"],
  ["technician", "tech@maintainpro.local", "/work-orders/queues/my-tasks?page=1&pageSize=25"]
]) {
  const auth = await session(email);
  console.log(JSON.stringify({ event: "login", role, status: auth.status, hasToken: Boolean(auth.token) }));
  if (!auth.token) continue;
  console.log(JSON.stringify({ role, path: "/work-orders/queues", samples: await timed(auth.token, auth.tenant, "/work-orders/queues") }));
  console.log(JSON.stringify({ role, path: list, samples: await timed(auth.token, auth.tenant, list) }));
}
