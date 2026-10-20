import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);

const base = "http://127.0.0.1:3018";
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
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 240));
});

const readyJs = {
  "/assets": `() => {
    const text = document.querySelector("main")?.innerText ?? "";
    if (text.includes("Loading assets") || text.includes("Checking access")) return false;
    return text.includes("Asset registry") && (document.querySelectorAll("table tbody tr").length > 0 || /Unable to load assets|No assets|match these filters/i.test(text));
  }`,
  "/inventory": `() => {
    const text = document.querySelector("main")?.innerText ?? "";
    if (text.includes("Loading inventory") || text.includes("Checking access")) return false;
    return text.includes("Inventory Control Center") && (document.querySelectorAll("table tbody tr").length > 0 || text.includes("No inventory items") || text.includes("Unable to load inventory"));
  }`,
  "/fleet/gate": `() => {
    const text = document.querySelector("main")?.innerText ?? "";
    if (text.includes("Loading vehicles") || text.includes("Checking access")) return false;
    return text.includes("Fleet Gate Operations") && (document.querySelectorAll("table tbody tr").length > 0 || text.includes("No fleet records") || text.includes("Unable to load vehicles"));
  }`,
  "/requests": `() => {
    const text = document.querySelector("main")?.innerText ?? "";
    if (!text.includes("Maintenance Requests") || text.includes("Checking access")) return false;
    const live = document.querySelector("[aria-live='polite']")?.textContent ?? "";
    if (live.includes("Loading")) return false;
    return document.querySelectorAll("table tbody tr").length > 0 || /no requests|couldn't load|No maintenance/i.test(text);
  }`,
  "/maintenance/jobs": `() => {
    const text = document.querySelector("main")?.innerText ?? "";
    if (text.includes("Loading work order") || text.includes("Checking access")) return false;
    return text.includes("Work Orders") && (document.querySelectorAll("table tbody tr").length > 0 || /No work orders|Unable to load/i.test(text));
  }`,
  "/action-center": `() => {
    const text = document.querySelector("main")?.innerText ?? "";
    return text.length > 80 && !text.includes("Checking access") && !text.includes("Loading");
  }`
};

async function expandNav() {
  await page.getByRole("button", { name: "Full navigation mode" }).click({ timeout: 8000 }).catch(() => {});
  for (const button of await page.locator("aside nav button[aria-expanded='false']").all()) {
    await button.click().catch(() => {});
  }
}

async function clickTo(path) {
  await expandNav();
  const link = page.locator(`aside a[href='${path}']`).first();
  const requests = [];
  const onResponse = (response) => {
    const url = response.url();
    if (!url.includes("/api/backend/")) return;
    const timing = response.request().timing();
    requests.push({
      path: new URL(url).pathname.replace("/api/backend", ""),
      status: response.status(),
      ms: Math.round(Date.now() - clickAt)
    });
    void timing;
  };
  let clickAt = 0;
  page.on("response", onResponse);
  await page.evaluate(() => { window.__spa = 1; });
  clickAt = Date.now();
  await link.click();
  await page.waitForURL((url) => url.pathname === path, { timeout: 30000 });
  const navMs = Date.now() - clickAt;
  let dataMs = null;
  let dataError = null;
  try {
    await page.waitForFunction(readyJs[path], { timeout: 30000 });
    dataMs = Date.now() - clickAt;
  } catch (error) {
    dataError = "data-timeout";
  }
  const documentReload = await page.evaluate(() => window.__spa !== 1);
  page.off("response", onResponse);
  const interesting = requests.filter((row) =>
    /assets|inventory|vehicles|maintenance-requests|work-orders/.test(row.path)
  );
  return {
    url: page.url().replace(base, ""),
    navMs,
    dataMs,
    dataError,
    documentReload,
    api: interesting.slice(0, 8)
  };
}

await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(readyJs["/action-center"], { timeout: 30000 });
console.log(JSON.stringify({ event: "home", url: page.url().replace(base, ""), ms: Date.now() - started }));

const chain = [
  ["/maintenance/jobs", "jobs"],
  ["/assets", "Work Orders to Assets"],
  ["/inventory", "Assets to Inventory"],
  ["/fleet/gate", "Inventory to Fleet Gate"],
  ["/action-center", "home"],
  ["/requests", "Home to Requests"]
];

for (let pass = 0; pass < 3; pass += 1) {
  if (pass > 0) {
    await clickTo("/action-center");
    await clickTo("/maintenance/jobs");
  }
  for (const [path, label] of chain) {
    if (path === "/action-center" && page.url().includes("/action-center")) continue;
    if (path === "/requests" && !page.url().includes("/action-center")) await clickTo("/action-center");
    if (path === "/assets" && !page.url().includes("/maintenance/jobs")) await clickTo("/maintenance/jobs");
    const row = await clickTo(path);
    console.log(JSON.stringify({ pass, label, ...row }));
  }
}

const rsc = consoleErrors.filter((line) => line.includes("RSC") || line.includes("Falling back"));
console.log(JSON.stringify({ event: "errors", rsc: rsc.slice(0, 4), other: consoleErrors.filter((line) => !rsc.includes(line)).slice(0, 4) }));
await browser.close();
