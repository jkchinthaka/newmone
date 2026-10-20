import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);

const base = process.env.REHEARSAL_BASE || "http://127.0.0.1:3021";
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
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
});
let reloads = 0;
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame() && page.url().startsWith(base)) reloads += 1;
});

await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.locator("aside").waitFor({ timeout: 60000 });
await page.getByRole("button", { name: "Full navigation mode" }).click({ timeout: 5000 }).catch(() => {});
for (let i = 0; i < 12; i += 1) {
  const button = page.locator("aside nav button[aria-expanded='false']").first();
  if ((await button.count()) === 0) break;
  await button.click();
}
await page.evaluate(() => { window.__spa = 1; });
await page.locator("aside a[href='/maintenance/jobs']").click({ timeout: 30000 });
await page.waitForURL(/\/maintenance\/jobs/, { timeout: 60000 });
await page.getByRole("tablist", { name: "Work order queues" }).waitFor({ timeout: 30000 });
await page.waitForTimeout(1200);
const jobsUrl = new URL(page.url());
const purpose = await page.locator("p", { hasText: "Jobs that need a decision" }).count();
const rows = await page.locator("table tbody tr, [data-row], a[href*='wo=']").count();
console.log(JSON.stringify({
  event: "default-queue",
  path: jobsUrl.pathname,
  queue: jobsUrl.searchParams.get("queue"),
  purpose,
  rows,
  spa: await page.evaluate(() => window.__spa ?? 0)
}));

await page.evaluate(() => { window.__spa = 1; });
const overdue = page.getByRole("tab", { name: /^Overdue/ });
await overdue.click();
await page.waitForURL(/[?&]queue=overdue/, { timeout: 15000 });
await page.waitForTimeout(400);
console.log(JSON.stringify({
  event: "explicit-queue",
  url: page.url().replace(base, ""),
  spa: await page.evaluate(() => window.__spa ?? 0)
}));

await page.goBack({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const afterBack = page.url().replace(base, "");
await page.goForward({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
console.log(JSON.stringify({
  event: "history",
  afterBack,
  afterForward: page.url().replace(base, ""),
  spa: await page.evaluate(() => window.__spa ?? 0)
}));

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 60000 });
const menuButton = page.getByRole("button", { name: /menu|navigation/i }).first();
await menuButton.click();
const drawer = page.locator("#mobile-navigation-drawer");
await drawer.waitFor({ timeout: 10000 });
const stack = await page.evaluate(() => {
  const drawerEl = document.querySelector("#mobile-navigation-drawer");
  const bottom = document.querySelector("nav[aria-label='Quick navigation']");
  const z = (el) => Number(getComputedStyle(el).zIndex);
  const drawerBox = drawerEl.getBoundingClientRect();
  const bottomBox = bottom.getBoundingClientRect();
  const link = drawerEl.querySelector("a[href]");
  return {
    drawerZ: z(drawerEl.parentElement),
    bottomZ: z(bottom),
    link: link?.getAttribute("href") ?? "",
    overlap: drawerBox.bottom > bottomBox.top && drawerBox.top < bottomBox.bottom
  };
});
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const closed = await drawer.count();
const overflow = await page.evaluate(() => document.body.style.overflow);
console.log(JSON.stringify({ event: "mobile", stack, closed, overflow, reloads }));
const rsc = consoleErrors.filter((line) => /RSC|Falling back to browser navigation/i.test(line));
console.log(JSON.stringify({ event: "console", rsc, errors: consoleErrors.length }));
await browser.close();
if (rsc.length) process.exit(4);
