import { readFileSync } from "node:fs";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
const login = await fetch("http://127.0.0.1:3000/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password })
});
const body = await login.json();
const token = body?.data?.accessToken;
const tenant = body?.data?.user?.tenantId ?? "";
const response = await fetch("http://127.0.0.1:3000/api/work-orders/queues/action-required?page=1&pageSize=25", {
  headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenant }
});
const payload = await response.json();
const rows = payload?.data?.data ?? payload?.data?.items ?? payload?.data ?? [];
const list = Array.isArray(rows) ? rows : [];
const first = list[0] ?? {};
const sizes = Object.entries(first).map(([key, value]) => [key, JSON.stringify(value)?.length ?? 0]);
sizes.sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify({
  status: response.status,
  rowCount: list.length,
  topKeys: sizes.slice(0, 12),
  totalKeys: sizes.length
}));
