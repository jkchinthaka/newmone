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

await input.click();
await input.pressSequentially("pump motor", { delay: 20 });
await page.waitForTimeout(700);
const fast = await input.inputValue();

await input.fill("");
await input.pressSequentially("pump ", { delay: 30 });
await page.waitForTimeout(450);
await input.pressSequentially("motor", { delay: 40 });
await page.waitForTimeout(700);
const paused = await input.inputValue();

await page.getByRole("tab", { name: /^Overdue/ }).click();
await page.waitForURL(/queue=overdue/, { timeout: 15000 });
const overdue = page.url().replace(base, "");
const afterQueue = await input.inputValue();

await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 });
const backUrl = page.url().replace(base, "");
const backValue = await input.inputValue().catch(() => "");
await page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 });
const forwardUrl = page.url().replace(base, "");
const forwardValue = await input.inputValue();

await page.keyboard.press("Control+k");
const palette = page.getByRole("dialog");
await palette.waitFor({ timeout: 10000 });
await page.keyboard.type("WO-123");
await page.getByRole("option", { name: /Search work orders for/ }).click();
await page.waitForURL(/q=WO-123/, { timeout: 15000 });
await page.getByPlaceholder("Search work orders...").waitFor({ timeout: 15000 });
const paletteValue = await page.waitForFunction(() => {
  const field = document.querySelector("input[placeholder='Search work orders...']");
  return field instanceof HTMLInputElement && field.value === "WO-123" ? field.value : false;
}, null, { timeout: 5000 }).then((handle) => handle.jsonValue()).catch(async () => page.getByPlaceholder("Search work orders...").inputValue());
const paletteUrl = page.url().replace(base, "");

console.log(JSON.stringify({
  event: "browser",
  fast,
  paused,
  overdue,
  afterQueue,
  backUrl,
  backValue,
  forwardUrl,
  forwardValue,
  paletteUrl,
  paletteValue
}));
await browser.close();
if (fast !== "pump motor" || paused !== "pump motor" || afterQueue !== "pump motor" || paletteValue !== "WO-123") process.exit(4);
