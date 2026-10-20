import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) process.exit(2);
const base = "http://127.0.0.1:3021";
const login = await fetch(`${base}/api/backend/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password }),
  signal: AbortSignal.timeout(90000)
});
const setCookies = login.headers.getSetCookie?.() ?? [];
console.log(JSON.stringify({ event: "login", status: login.status, cookies: setCookies.length }));
if (login.status !== 200) process.exit(3);
const cookies = setCookies.map((line) => {
  const [pair] = line.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Lax" };
});
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.context().addCookies(cookies);
const rsc = [];
page.on("console", (message) => {
  if (message.type() === "error" && /RSC|Falling back/i.test(message.text())) rsc.push(message.text().slice(0, 180));
});
await page.goto(`${base}/maintenance/jobs?q=WO-123`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByRole("tablist", { name: "Work order queues" }).waitFor({ timeout: 60000 });
await page.waitForTimeout(1000);
const searched = new URL(page.url());
const input = await page.getByPlaceholder("Search work orders...").inputValue();
const selected = (await page.locator("[role=tab][aria-selected='true']").first().textContent())?.replace(/\s+/g, " ").trim();
console.log(JSON.stringify({
  event: "search-without-queue",
  url: `${searched.pathname}${searched.search}`,
  input,
  selected,
  rsc
}));
await page.goto(`${base}/maintenance/jobs?queue=overdue`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.getByRole("tab", { name: /^Overdue/ }).waitFor({ timeout: 30000 });
await page.goto(`${base}/maintenance/jobs?q=WO-123`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.getByRole("tablist", { name: "Work order queues" }).waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
const returned = new URL(page.url());
const returnedInput = await page.getByPlaceholder("Search work orders...").inputValue();
const returnedSelected = (await page.locator("[role=tab][aria-selected='true']").first().textContent())?.replace(/\s+/g, " ").trim();
console.log(JSON.stringify({
  event: "return-to-search",
  url: `${returned.pathname}${returned.search}`,
  input: returnedInput,
  selected: returnedSelected
}));
await browser.close();
