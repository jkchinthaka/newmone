import { readFileSync } from "node:fs";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);

const login = await fetch("http://127.0.0.1:3000/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password })
});
const body = await login.json();
const token = body?.data?.accessToken ?? body?.accessToken;
const tenant = body?.data?.user?.tenantId ?? body?.data?.tenants?.[0]?.id ?? "";
console.log(JSON.stringify({ event: "login", status: login.status, hasToken: Boolean(token) }));
if (!token) process.exit(3);

const paths = [
  "/assets?page=1&limit=25",
  "/assets/summary",
  "/inventory/parts?page=1&pageSize=25",
  "/inventory/dashboard",
  "/vehicles?page=1&pageSize=25",
  "/maintenance-requests?page=1&limit=25",
  "/maintenance-requests/summary"
];

for (const path of paths) {
  const samples = [];
  for (let i = 0; i < 3; i += 1) {
    const start = Date.now();
    const response = await fetch(`http://127.0.0.1:3000/api${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        ...(tenant ? { "x-tenant-id": tenant } : {})
      }
    });
    const bytes = (await response.arrayBuffer()).byteLength;
    samples.push({ status: response.status, ms: Date.now() - start, bytes });
  }
  console.log(JSON.stringify({ path, samples }));
}
