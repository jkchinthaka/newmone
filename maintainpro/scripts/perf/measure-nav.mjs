import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) {
  console.error("missing seed password");
  process.exit(2);
}

const base = "http://127.0.0.1:3011";
const routes = [
  ["/action-center", "Home"],
  ["/maintenance/jobs", "Work orders"],
  ["/work-orders/my", "My jobs"],
  ["/requests", "Requests"],
  ["/maintenance/plans", "Preventive maintenance"],
  ["/assets", "Assets"],
  ["/fleet/gate", "Fleet gate"],
  ["/inventory", "Inventory"],
  ["/notifications", "Notifications"],
  ["/reports", "Reports"],
  ["/admin", "Administration"]
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function sample(page, path) {
  const started = Date.now();
  const response = await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const shell = Date.now() - started;
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? "";
      return text.length > 80 && !text.includes("Verifying session and tenant");
    },
    { timeout: 45000 }
  );
  const usable = Date.now() - started;
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name.replace(location.origin, ""),
      dur: Math.round(entry.duration),
      type: entry.initiatorType
    }))
  );
  const api = resources.filter((entry) => entry.name.includes("/api/") || entry.name.includes(":3000"));
  return {
    path,
    status: response?.status() ?? 0,
    finalUrl: page.url().replace(base, ""),
    shellMs: shell,
    usableMs: usable,
    slowestApi: api.sort((a, b) => b.dur - a.dur).slice(0, 5)
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const loginStarted = Date.now();
const loginResponse = await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.fill('input[type="email"], input[name="email"]', "admin@maintainpro.local");
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 });
const loginMs = Date.now() - loginStarted;
console.log(JSON.stringify({ event: "login", status: loginResponse?.status(), loginMs, landed: page.url().replace(base, "") }));
const apiTimes = [];
page.on("response", (response) => {
  const url = response.url();
  if (!url.includes(":3000") && !url.includes("/api/")) return;
  const timing = response.request().timing();
  apiTimes.push({
    path: new URL(url).pathname,
    status: response.status(),
    ms: Math.round(timing.responseEnd)
  });
});

const cold = [];

const warm = [];
for (let pass = 0; pass < 2; pass += 1) {
  for (const [path] of routes) {
    const link = page.locator(`a[href="${path}"]`).filter({ visible: true }).first();
    if ((await link.count()) === 0) {
      warm.push({ path, pass, error: "no-link" });
      continue;
    }
    const before = page.url();
    const started = Date.now();
    await link.click();
    await page.waitForFunction(
      (expected) => location.pathname === expected,
      path,
      { timeout: 30000 }
    );
    const urlMs = Date.now() - started;
    await page.waitForFunction(
      () => (document.body?.innerText ?? "").length > 80,
      { timeout: 30000 }
    );
    warm.push({ path, pass, from: before.replace(base, ""), urlMs, usableMs: Date.now() - started });
    console.log(JSON.stringify({ phase: "warm-click", ...warm.at(-1) }));
  }
}

const byPath = new Map();
for (const row of warm.filter((row) => typeof row.usableMs === "number")) {
  const list = byPath.get(row.path) ?? [];
  list.push(row.usableMs);
  byPath.set(row.path, list);
}
const summary = [...byPath.entries()].map(([path, values]) => ({
  path,
  warmMedianMs: median(values),
  warmWorstMs: Math.max(...values)
}));
const slowApi = [...apiTimes].sort((a, b) => b.ms - a.ms).slice(0, 15);
console.log(JSON.stringify({ event: "summary", summary, slowApi }));
await browser.close();
