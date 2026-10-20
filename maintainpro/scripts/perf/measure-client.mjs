import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);

const base = "http://127.0.0.1:3017";
const started = Date.now();
const login = await fetch(`${base}/api/backend/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password }),
  signal: AbortSignal.timeout(90000)
});
const setCookies = login.headers.getSetCookie?.() ?? [];
console.log(JSON.stringify({ event: "login", status: login.status, ms: Date.now() - started, cookies: setCookies.length }));
if (login.status !== 200 || setCookies.length === 0) process.exit(3);

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
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
});
page.on("pageerror", (error) => {
  consoleErrors.push(`pageerror ${error.stack?.split("\n").slice(0, 6).join(" | ") ?? error.message}`);
});

async function openHome() {
  const mark = Date.now();
  await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? "";
    return text.length > 80 && !text.includes("Verifying session");
  }, { timeout: 60000 });
  console.log(JSON.stringify({ event: "home-document", ms: Date.now() - mark, url: page.url().replace(base, "") }));
}

async function clickTo(path) {
  const fullNav = page.locator('aside button[aria-label="Full navigation mode"]');
  if (await fullNav.count()) await fullNav.click();
  let link = page.locator(`aside a[href="${path}"]`);
  if ((await link.count()) === 0) {
    for (let guard = 0; guard < 8; guard += 1) {
      const toggle = page.locator('aside nav button[aria-expanded="false"]').first();
      if ((await toggle.count()) === 0) break;
      await toggle.click();
    }
    link = page.locator(`aside a[href="${path}"]`);
  }
  if ((await link.count()) === 0) {
    const hrefs = await page.locator("aside a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    throw new Error(`missing ${path}; aside hrefs ${hrefs.join(",")}`);
  }
  await link.first().scrollIntoViewIfNeeded();
  await page.evaluate(() => { window.__spa = 1; });
  const requests = [];
  const onResponse = (response) => {
    const url = response.url();
    if (!url.includes("/api/backend/")) return;
    const timing = response.request().timing();
    requests.push({
      path: new URL(url).pathname.replace("/api/backend", ""),
      status: response.status(),
      ms: Math.max(0, Math.round(timing.responseEnd || 0))
    });
  };
  page.on("response", onResponse);
  const mark = Date.now();
  await link.click();
  let navMs = null;
  let headingMs = null;
  let contentMs = null;
  let error = null;
  try {
    await page.waitForFunction((expected) => location.pathname === expected, path, { timeout: 30000 });
    navMs = Date.now() - mark;
    await page.waitForFunction(() => (document.querySelector("h1")?.textContent?.trim() ?? "").length > 1, { timeout: 30000 });
    headingMs = Date.now() - mark;
    await page.waitForFunction(() => {
      const text = document.querySelector("main")?.innerText ?? "";
      return text.length > 80 && !/Verifying session|Loading work order queues|Gathering operational/i.test(text.slice(0, 400));
    }, { timeout: 30000 });
    contentMs = Date.now() - mark;
  } catch (err) {
    error = err instanceof Error ? err.message.split("\n")[0] : "timeout";
    contentMs = Date.now() - mark;
  }
  page.off("response", onResponse);
  const spa = await page.evaluate(() => window.__spa).catch(() => 0);
  const counts = new Map();
  for (const request of requests) counts.set(request.path, (counts.get(request.path) ?? 0) + 1);
  return {
    path,
    url: page.url().replace(base, ""),
    navMs,
    headingMs,
    contentMs,
    documentReload: spa !== 1,
    apiCount: requests.length,
    duplicates: [...counts.entries()].filter(([, count]) => count > 1).map(([key, count]) => `${key} x${count}`),
    slowest: [...requests].sort((a, b) => b.ms - a.ms).slice(0, 3),
    error
  };
}

await openHome();
const homeProbe = await page.evaluate(() => ({
  aside: document.querySelectorAll("aside").length,
  links: [...document.querySelectorAll("a")].slice(0, 12).map((node) => node.getAttribute("href")),
  heading: document.querySelector("h1")?.textContent ?? "",
  text: (document.body?.innerText ?? "").slice(0, 300)
}));
console.log(JSON.stringify({ event: "home-probe", ...homeProbe, consoleErrors }));
if (homeProbe.heading.includes("temporarily unavailable")) {
  await browser.close();
  process.exit(4);
}
const samples = [];
for (let pass = 0; pass < 4; pass += 1) {
  if (!page.url().includes("/action-center")) {
    const home = await clickTo("/action-center");
    samples.push({ pass, label: "return Home", ...home });
    console.log(JSON.stringify(samples.at(-1)));
  }
  const row = await clickTo("/maintenance/jobs");
  samples.push({ pass, label: "Home to Work Orders", ...row });
  console.log(JSON.stringify(samples.at(-1)));
}

const overdue = page.getByRole("tab", { name: /Overdue/i }).or(page.getByRole("button", { name: /^Overdue/i })).first();
if (await overdue.count()) {
  await overdue.click();
  await page.waitForTimeout(500);
  console.log(JSON.stringify({ event: "queue-switch", url: page.url().replace(base, "") }));
  await page.goBack();
  await page.waitForTimeout(400);
  const afterBack = page.url().replace(base, "");
  await page.goForward();
  await page.waitForTimeout(400);
  console.log(JSON.stringify({ event: "history", afterBack, afterForward: page.url().replace(base, "") }));
}

const chain = [
  ["/assets", "Work Orders to Assets"],
  ["/inventory", "Assets to Inventory"],
  ["/fleet/gate", "Inventory to Fleet Gate"],
  ["/action-center", "return Home"],
  ["/requests", "Home to Requests"]
];
for (let pass = 0; pass < 3; pass += 1) {
  if (pass > 0) {
    const home = await clickTo("/action-center");
    const jobs = await clickTo("/maintenance/jobs");
    samples.push({ pass, label: "setup jobs", ...jobs, homeMs: home.contentMs });
  }
  let previous = "/maintenance/jobs";
  for (const [path, label] of chain) {
    if (path === "/requests" && !page.url().includes("/action-center")) {
      await clickTo("/action-center");
    }
    const row = await clickTo(path);
    samples.push({ pass, label, from: previous, ...row });
    console.log(JSON.stringify(samples.at(-1)));
    previous = path;
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}
const grouped = new Map();
for (const row of samples) {
  if (row.pass === 0 || typeof row.contentMs !== "number") continue;
  const list = grouped.get(row.label) ?? [];
  list.push(row);
  grouped.set(row.label, list);
}
const summary = [...grouped.entries()].map(([label, rows]) => ({
  label,
  content: rows.map((row) => row.contentMs),
  medianMs: median(rows.map((row) => row.contentMs)),
  worstMs: Math.max(...rows.map((row) => row.contentMs)),
  reloads: rows.filter((row) => row.documentReload).length,
  errors: rows.filter((row) => row.error).length
}));
const rsc = consoleErrors.filter((line) => line.includes("Falling back to browser navigation") || line.includes("Failed to fetch RSC"));
console.log(JSON.stringify({ event: "summary", summary, rsc: rsc.slice(0, 6), otherErrors: consoleErrors.filter((line) => !rsc.includes(line)).slice(0, 4) }));
await browser.close();
