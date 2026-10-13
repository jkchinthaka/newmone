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
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
});

await page.goto(`${base}/action-center`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.getByRole("button", { name: "Full navigation mode" }).click({ timeout: 15000 }).catch(() => {});
for (const button of await page.locator("aside nav button[aria-expanded='false']").all()) {
  await button.click().catch(() => {});
}
await page.locator("aside a[href='/maintenance/jobs']").click();
await page.waitForURL(/\/maintenance\/jobs/, { timeout: 30000 });
await page.locator("[role=tablist]").first().waitFor({ timeout: 20000 });
const tabs = await page.locator("[role=tab]").evaluateAll((nodes) =>
  nodes.map((node) => ({
    name: node.textContent?.replace(/\s+/g, " ").trim().slice(0, 40),
    selected: node.getAttribute("aria-selected"),
    visible: node.getClientRects().length > 0
  }))
);
console.log(JSON.stringify({ event: "tabs", url: page.url().replace(base, ""), tabs }));

const tab = page.locator("[role=tablist]").first().getByRole("tab", { name: /^Overdue/ });
const clickAt = Date.now();
await tab.click();
let url = page.url();
try {
  await page.waitForURL(/[?&]queue=overdue/, { timeout: 5000 });
  url = page.url();
} catch {
  url = page.url();
}
const selected = await page.locator("[role=tab][aria-selected='true']").first().textContent();
console.log(JSON.stringify({
  event: "queue-switch",
  ms: Date.now() - clickAt,
  url: url.replace(base, ""),
  selected: selected?.replace(/\s+/g, " ").trim().slice(0, 40) ?? "",
  rsc: consoleErrors.filter((line) => line.includes("RSC") || line.includes("Falling back"))
}));

await page.goBack();
await page.waitForTimeout(600);
const afterBack = page.url().replace(base, "");
await page.goForward();
await page.waitForTimeout(600);
console.log(JSON.stringify({
  event: "history",
  afterBack,
  afterForward: page.url().replace(base, "")
}));
await browser.close();
