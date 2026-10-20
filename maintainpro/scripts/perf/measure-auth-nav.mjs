import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) {
  console.error("missing seed password");
  process.exit(2);
}

const base = "http://127.0.0.1:3011";
const started = Date.now();
const response = await fetch(`${base}/api/backend/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password }),
  signal: AbortSignal.timeout(60000)
});
const loginMs = Date.now() - started;
const bodyText = await response.text();
let userPresent = false;
try {
  userPresent = Boolean(JSON.parse(bodyText)?.data?.user);
} catch {
  userPresent = false;
}
const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
console.log(JSON.stringify({
  event: "api-login",
  status: response.status,
  loginMs,
  userPresent,
  cookieCount: setCookies.length
}));
if (response.status === 429 || response.status !== 200 || setCookies.length === 0) {
  process.exit(3);
}

const cookies = setCookies.map((line) => {
  const [pair, ...attrs] = line.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  const name = pair.slice(0, eq);
  const value = pair.slice(eq + 1);
  const attr = new Map(attrs.map((item) => {
    const [key, raw] = item.split("=");
    return [key.toLowerCase(), raw ?? ""];
  }));
  return {
    name,
    value,
    domain: "127.0.0.1",
    path: attr.get("path") || "/",
    httpOnly: attr.has("httponly"),
    secure: false,
    sameSite: "Lax"
  };
});

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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies(cookies);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 160));
});

const openStarted = Date.now();
await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 60000 });
const shellMs = Date.now() - openStarted;
await page.waitForFunction(() => {
  const text = document.body?.innerText ?? "";
  return text.length > 80 && !text.includes("Verifying session");
}, { timeout: 45000 }).catch(() => undefined);
console.log(JSON.stringify({
  event: "open-home",
  shellMs,
  usableMs: Date.now() - openStarted,
  url: page.url().replace(base, "")
}));
if (page.url().includes("/login")) {
  await browser.close();
  process.exit(3);
}

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
  await page.waitForFunction(() => (document.querySelector("h1")?.textContent?.trim() ?? "").length > 0, { timeout: 30000 });
}

const samples = [];
for (let pass = 0; pass < 4; pass += 1) {
  for (const [from, to, label] of hops) {
    if (!page.url().includes(from)) {
      await go(from);
      await settle(from);
    }
    const requests = [];
    const onResponse = (response) => {
      const url = response.url();
      if (!url.includes("/api/backend/") && !url.includes(":3000/api/")) return;
      requests.push({
        method: response.request().method(),
        path: new URL(url).pathname.replace("/api/backend", ""),
        status: response.status(),
        ms: Math.max(0, Math.round(response.request().timing().responseEnd))
      });
    };
    page.on("response", onResponse);
    const headingBefore = await page.locator("h1").first().innerText().catch(() => "");
    const mark = Date.now();
    const mode = await go(to);
    let navMs = null;
    let headingMs = null;
    let contentMs = null;
    let error = null;
    try {
      await page.waitForFunction((expected) => location.pathname === expected, to, { timeout: 20000 });
      navMs = Date.now() - mark;
      await page.waitForFunction((previous) => {
        const heading = document.querySelector("h1")?.textContent?.trim() ?? "";
        return heading.length > 0 && heading !== previous;
      }, headingBefore, { timeout: 20000 });
      headingMs = Date.now() - mark;
      await page.waitForFunction(() => {
        const text = document.querySelector("main")?.innerText ?? "";
        return text.length > 80 && !/Loading|Checking access|Gathering operational/i.test(text.slice(0, 500));
      }, { timeout: 20000 });
      contentMs = Date.now() - mark;
    } catch (err) {
      error = err instanceof Error ? err.message.split("\n")[0] : "timeout";
      contentMs = Date.now() - mark;
    }
    page.off("response", onResponse);
    const counts = new Map();
    for (const request of requests) {
      const key = `${request.method} ${request.path}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const row = {
      pass,
      label,
      mode,
      navMs,
      headingMs,
      contentMs,
      finalUrl: page.url().replace(base, ""),
      apiCount: requests.length,
      slowest: [...requests].sort((a, b) => b.ms - a.ms)[0] ?? null,
      duplicates: [...counts.entries()].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count })),
      error
    };
    samples.push(row);
    console.log(JSON.stringify(row));
  }
}

const warm = samples.filter((row) => row.pass > 0 && typeof row.contentMs === "number");
const grouped = new Map();
for (const row of warm) {
  const list = grouped.get(row.label) ?? [];
  list.push(row.contentMs);
  grouped.set(row.label, list);
}
console.log(JSON.stringify({
  event: "summary",
  summary: [...grouped.entries()].map(([label, values]) => ({
    label,
    samples: values,
    medianMs: median(values),
    worstMs: Math.max(...values)
  })),
  consoleErrors: consoleErrors.slice(0, 6)
}));
await browser.close();
