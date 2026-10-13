import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) {
  console.error("missing seed password");
  process.exit(2);
}

const base = "http://127.0.0.1:3011";
const hops = [
  ["/action-center", "/maintenance/jobs", "Home to Work Orders"],
  ["/maintenance/jobs", "/assets", "Work Orders to Assets"],
  ["/assets", "/inventory", "Assets to Inventory"],
  ["/inventory", "/fleet/gate", "Inventory to Fleet Gate"],
  ["/action-center", "/reports", "Home to Reports"],
  ["/action-center", "/requests", "Home to Requests"]
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 180));
});

const loginEvents = [];
page.on("response", (response) => {
  if (!response.url().includes("auth/login")) return;
  loginEvents.push({
    status: response.status(),
    ms: Math.max(0, Math.round(response.request().timing().responseEnd))
  });
});
const loginStarted = Date.now();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.fill("#login-email", "admin@maintainpro.local");
await page.fill("#login-password", password);
await page.click('button[type="submit"]');
const left = await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60000 }).then(() => true).catch(() => false);
const alertText = await page.locator("[role=alert]").allInnerTexts().catch(() => []);
console.log(JSON.stringify({
  event: "login",
  left,
  loginMs: Date.now() - loginStarted,
  landed: page.url().replace(base, ""),
  loginEvents,
  alertText
}));
if (loginEvents.some((event) => event.status === 429)) {
  await browser.close();
  process.exit(3);
}
if (!left) {
  await browser.close();
  process.exit(3);
}

await page.waitForFunction(
  () => (document.body?.innerText ?? "").length > 80 && !(document.body.innerText.includes("Verifying session")),
  { timeout: 45000 }
);

async function go(path) {
  const link = page.locator(`a[href="${path}"]`).filter({ visible: true }).first();
  if ((await link.count()) === 0) {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
    return "document";
  }
  await link.click();
  return "click";
}

async function settle(path) {
  await page.waitForFunction((expected) => location.pathname === expected, path, { timeout: 30000 });
  await page.waitForFunction(() => {
    const heading = document.querySelector("h1")?.textContent?.trim() ?? "";
    const text = document.querySelector("main")?.innerText ?? "";
    return heading.length > 0 && text.length > 40 && !text.includes("Verifying session");
  }, { timeout: 30000 });
}

const samples = [];
for (let pass = 0; pass < 4; pass += 1) {
  for (const [from, to, label] of hops) {
    if (!page.url().endsWith(from) && !page.url().includes(`${from}?`)) {
      await go(from);
      await settle(from);
    }
    const requests = [];
    const onResponse = async (response) => {
      const url = response.url();
      if (!url.includes("/api/backend/") && !url.includes(":3000/api/")) return;
      const started = response.request().timing().startTime;
      requests.push({
        method: response.request().method(),
        path: new URL(url).pathname.replace("/api/backend", ""),
        status: response.status(),
        ms: Math.max(0, Math.round(response.request().timing().responseEnd)),
        start: started
      });
    };
    page.on("response", onResponse);
    const headingBefore = await page.locator("h1").first().innerText().catch(() => "");
    const started = Date.now();
    const mode = await go(to);
    let navMs = null;
    let headingMs = null;
    let contentMs = null;
    let error = null;
    try {
      await page.waitForFunction((expected) => location.pathname === expected, to, { timeout: 20000 });
      navMs = Date.now() - started;
      await page.waitForFunction((previous) => {
        const heading = document.querySelector("h1")?.textContent?.trim() ?? "";
        return heading.length > 0 && heading !== previous;
      }, headingBefore, { timeout: 20000 });
      headingMs = Date.now() - started;
      await page.waitForFunction(() => {
        const text = document.querySelector("main")?.innerText ?? "";
        return text.length > 80 && !/Loading|Checking access|Gathering operational/i.test(text.slice(0, 400));
      }, { timeout: 20000 });
      contentMs = Date.now() - started;
    } catch (err) {
      error = err instanceof Error ? err.message.split("\n")[0] : "timeout";
      contentMs = Date.now() - started;
    }
    page.off("response", onResponse);
    const counts = new Map();
    for (const request of requests) {
      const key = `${request.method} ${request.path}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
    const slowest = [...requests].sort((a, b) => b.ms - a.ms)[0] ?? null;
    const row = {
      pass,
      label,
      mode,
      from,
      to,
      finalUrl: page.url().replace(base, ""),
      navMs,
      headingMs,
      contentMs,
      apiCount: requests.length,
      slowest,
      duplicates,
      error
    };
    samples.push(row);
    console.log(JSON.stringify(row));
  }

  if (page.url().includes("/maintenance/jobs") === false) {
    await go("/maintenance/jobs");
    await settle("/maintenance/jobs").catch(() => undefined);
  }
  const detailLink = page.locator('main a[href*="wo="]').filter({ visible: true }).first();
  const detailCount = await detailLink.count();
  if (detailCount > 0) {
    const started = Date.now();
    const requests = [];
    const onResponse = (response) => {
      const url = response.url();
      if (!url.includes("/api/backend/") && !url.includes(":3000/api/")) return;
      requests.push({
        path: new URL(url).pathname.replace("/api/backend", ""),
        status: response.status(),
        ms: Math.max(0, Math.round(response.request().timing().responseEnd))
      });
    };
    page.on("response", onResponse);
    await detailLink.click();
    let opened = false;
    try {
      await page.waitForFunction(
        () => location.search.includes("wo=") || Boolean(document.querySelector("[role=dialog]")),
        { timeout: 15000 }
      );
      opened = true;
    } catch {
      opened = false;
    }
    page.off("response", onResponse);
    const slowest = [...requests].sort((a, b) => b.ms - a.ms)[0] ?? null;
    const row = {
      pass,
      label: "Work Orders to Job Detail",
      mode: "click",
      opened,
      contentMs: Date.now() - started,
      finalUrl: page.url().replace(base, ""),
      apiCount: requests.length,
      slowest
    };
    samples.push(row);
    console.log(JSON.stringify(row));
    await page.keyboard.press("Escape").catch(() => undefined);
  } else {
    console.log(JSON.stringify({ pass, label: "Work Orders to Job Detail", error: "no-visible-job-link" }));
  }
}

const warm = samples.filter((row) => row.pass > 0 && typeof row.contentMs === "number" && !row.error);
const grouped = new Map();
for (const row of warm) {
  const list = grouped.get(row.label) ?? [];
  list.push(row.contentMs);
  grouped.set(row.label, list);
}
const summary = [...grouped.entries()].map(([label, values]) => ({
  label,
  samples: values,
  medianMs: median(values),
  worstMs: Math.max(...values)
}));
console.log(JSON.stringify({ event: "summary", summary, consoleErrors: consoleErrors.slice(0, 8) }));
await browser.close();
