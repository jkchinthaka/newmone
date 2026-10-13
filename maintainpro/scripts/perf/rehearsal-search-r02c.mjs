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
console.log(JSON.stringify({ event: "login", status: login.status }));
if (login.status !== 200) process.exit(3);
const cookies = (login.headers.getSetCookie?.() ?? []).map((line) => {
  const [pair] = line.split(";");
  const eq = pair.indexOf("=");
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Lax" };
});
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.route("**/api/backend/work-orders/**", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await route.continue();
});
await page.context().addCookies(cookies);
await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.goto(`${base}/maintenance/jobs`, { waitUntil: "domcontentloaded", timeout: 120000 });
const input = page.getByPlaceholder("Search work orders...");
await input.waitFor({ timeout: 60000 });

async function commitSearch(text) {
  await input.fill(text);
  await page.waitForTimeout(500);
  await page.waitForURL(new RegExp(`q=${encodeURIComponent(text).replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}`), { timeout: 15000 });
}

await commitSearch("WO-123");
const firstUrl = page.url().replace(base, "");
await commitSearch("WO-124");
const secondUrl = page.url().replace(base, "");

await page.locator("body").click({ position: { x: 8, y: 8 } });
await page.keyboard.press("Control+k");
await page.getByRole("dialog").waitFor({ timeout: 10000 });
await page.keyboard.type("WO-123");
await page.getByRole("option", { name: /Search work orders for/ }).click();
await page.waitForFunction(() => {
  const field = document.querySelector("input[placeholder='Search work orders...']");
  return field instanceof HTMLInputElement && field.value === "WO-123";
}, null, { timeout: 10000 });
const returnedUrl = page.url().replace(base, "");
const returnedValue = await input.inputValue();
const selected = await page.locator("[role='tab'][aria-selected='true']").first().innerText();

await page.getByRole("tab", { name: /^Overdue/ }).click();
await page.waitForURL(/queue=overdue/, { timeout: 15000 });
const overdueUrl = page.url().replace(base, "");
const overdueValue = await input.inputValue();

await input.fill("");
await input.pressSequentially("pump motor", { delay: 20 });
await page.waitForTimeout(700);
const fast = await input.inputValue();

await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForFunction(() => {
  const field = document.querySelector("input[placeholder='Search work orders...']");
  return field instanceof HTMLInputElement && field.value === "WO-124";
}, null, { timeout: 8000 }).catch(() => undefined);
const backUrl = page.url().replace(base, "");
const backValue = await input.inputValue().catch(() => "");
await page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForFunction(() => {
  const field = document.querySelector("input[placeholder='Search work orders...']");
  return field instanceof HTMLInputElement && field.value === "pump motor";
}, null, { timeout: 8000 }).catch(() => undefined);
const forwardUrl = page.url().replace(base, "");
const forwardValue = await input.inputValue().catch(() => "");

console.log(JSON.stringify({
  event: "browser",
  firstUrl,
  secondUrl,
  returnedUrl,
  returnedValue,
  selected,
  overdueUrl,
  overdueValue,
  fast,
  backUrl,
  backValue,
  forwardUrl,
  forwardValue
}));
await browser.close();
if (returnedValue !== "WO-123" || !returnedUrl.includes("q=WO-123") || returnedUrl.includes("WO-124")) process.exit(4);
if (overdueValue !== "WO-123" || !overdueUrl.includes("queue=overdue") || !overdueUrl.includes("q=WO-123")) process.exit(5);
if (fast !== "pump motor") process.exit(6);
if (backValue !== "WO-124" || !backUrl.includes("q=WO-124")) process.exit(7);
if (forwardValue !== "pump motor" || !forwardUrl.includes("q=pump+motor")) process.exit(8);
