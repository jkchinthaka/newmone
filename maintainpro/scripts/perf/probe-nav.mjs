import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const envText = readFileSync("C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.env", "utf8");
const password = envText.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m)?.[1]?.trim();
const base = "http://127.0.0.1:3019";
const login = await fetch(`${base}/api/backend/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@maintainpro.local", password })
});
const setCookies = login.headers.getSetCookie?.() ?? [];
if (login.status !== 200) {
  console.log(JSON.stringify({ status: login.status }));
  process.exit(3);
}
const cookies = setCookies.map((line) => {
  const [pair] = line.split(";");
  const eq = pair.indexOf("=");
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Lax" };
});
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.context().addCookies(cookies);
await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 20000 });
await page.locator("aside").waitFor({ timeout: 15000 });
const buttons = await page.locator("aside button[aria-expanded='false']").all();
for (const button of buttons) await button.click();
const hrefs = await page.locator("aside a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
console.log(JSON.stringify({ hrefs }));
await browser.close();
