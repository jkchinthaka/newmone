import { readFileSync } from "node:fs";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);

const base = "http://127.0.0.1:3018";
const login = await fetch(`${base}/api/backend/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password })
});
const setCookies = login.headers.getSetCookie?.() ?? [];
console.log(JSON.stringify({ event: "login", status: login.status, cookies: setCookies.length }));
if (login.status !== 200) process.exit(3);
const cookie = setCookies.map((line) => line.split(";")[0]).join("; ");

const paths = [
  "/assets?page=1&limit=25",
  "/assets/summary",
  "/assets/filter-options",
  "/inventory/parts?page=1&pageSize=25",
  "/inventory/dashboard",
  "/vehicles?page=1&pageSize=25",
  "/maintenance-requests?page=1&limit=25",
  "/maintenance-requests/summary"
];

for (const path of paths) {
  const samples = [];
  for (let i = 0; i < 2; i += 1) {
    const start = Date.now();
    const response = await fetch(`${base}/api/backend${path}`, { headers: { cookie } });
    const bytes = (await response.arrayBuffer()).byteLength;
    samples.push({ status: response.status, ms: Date.now() - start, bytes });
  }
  console.log(JSON.stringify({ path, samples }));
}
