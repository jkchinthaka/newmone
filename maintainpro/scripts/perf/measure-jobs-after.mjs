import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);

const base = "http://127.0.0.1:3016";
const started = Date.now();
const response = await fetch(`${base}/api/backend/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password }),
  signal: AbortSignal.timeout(60000)
});
const setCookies = response.headers.getSetCookie?.() ?? [];
console.log(JSON.stringify({ event: "login", status: response.status, ms: Date.now() - started, cookies: setCookies.length }));
if (response.status !== 200 || setCookies.length === 0) process.exit(3);

const cookies = setCookies.map((line) => {
  const [pair, ...attrs] = line.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  const attr = new Map(attrs.map((item) => {
    const [key, raw] = item.split("=");
    return [key.toLowerCase(), raw ?? ""];
  }));
  return {
    name: pair.slice(0, eq),
    value: pair.slice(eq + 1),
    domain: "127.0.0.1",
    path: attr.get("path") || "/",
    httpOnly: attr.has("httponly"),
    secure: false,
    sameSite: "Lax"
  };
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies(cookies);
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text().slice(0, 220));
});

for (let pass = 0; pass < 2; pass += 1) {
  const mark = Date.now();
  await page.goto(`${base}/maintenance/jobs`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const shellMs = Date.now() - mark;
  await page.waitForFunction(() => {
    const text = document.querySelector("main")?.innerText ?? "";
    return text.length > 80 && !text.includes("Verifying session") && !text.includes("Loading work order queues");
  }, { timeout: 60000 });
  console.log(JSON.stringify({
    pass,
    shellMs,
    contentMs: Date.now() - mark,
    url: page.url().replace(base, ""),
    rscFallbacks: errors.filter((line) => line.includes("Falling back to browser navigation")).length
  }));
}
console.log(JSON.stringify({ errors: errors.slice(0, 6) }));
await browser.close();
