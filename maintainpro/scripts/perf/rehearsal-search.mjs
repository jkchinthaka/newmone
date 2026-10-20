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
await page.context().addCookies(cookies);
await page.goto(`${base}/maintenance/jobs`, { waitUntil: "domcontentloaded", timeout: 120000 });
const input = page.getByPlaceholder("Search work orders...");
await input.waitFor({ timeout: 60000 });
await input.fill("pump ");
await page.waitForTimeout(450);
await input.press("End");
await input.type("motor", { delay: 40 });
await page.waitForTimeout(500);
const value = await input.inputValue();
await page.getByRole("tab", { name: /^Overdue/ }).click();
await page.waitForURL(/queue=overdue/, { timeout: 15000 });
const overdue = page.url().replace(base, "");
console.log(JSON.stringify({ event: "search", value, overdue, pumpmotor: value.includes("pumpmotor") }));
await browser.close();
if (value !== "pump motor") process.exit(4);
