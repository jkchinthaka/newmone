// QA crawl: opens every sidebar page as the super admin, clicks safe buttons/tabs, and lists
// console errors, failed API calls (4xx/5xx), crashes and blank pages. Nothing is written to a file.
// Run from maintainpro/:  node apps/web/scripts/qa-crawl.mjs   (app must be running on 3041)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.QA_BASE || "http://127.0.0.1:3041";
const EMAIL = process.env.QA_EMAIL || "superadmin@maintainpro.local";
const MAX_CLICKS = Number(process.env.QA_MAX_CLICKS || 25);

function seedPassword() {
  if (process.env.QA_PASSWORD) return process.env.QA_PASSWORD;
  const envPath = path.resolve(here, "../../../.env");
  if (!fs.existsSync(envPath)) return "";
  const m = fs.readFileSync(envPath, "utf8").match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m);
  return m?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
}

// Default (safe) mode never clicks anything that changes data. With QA_MUTATE=1 it also clicks
// Save/Create/Approve/Reject/Delete/Assign/Start/Finish/... buttons (this CHANGES the local database).
// Even then it never ends the session, wipes an account/tenant, or touches passwords/access.
const MUTATE = process.env.QA_MUTATE === "1";
const HARD_BLOCK = /log ?out|sign ?out|delete (account|tenant|all)|purge|wipe|deactivate|disable user|reset password|revoke|change password|tenant|factory/i;
const UNSAFE = /delete|remove|approve|reject|submit|save|create|send|confirm|disable|enable|archive|cancel|close|import|upload|reset|invite|assign|finish|start|complete|verify|add |\badd\b|\bnew\b|^\+|post|publish|pay|issue|renew|sync|run |generate|apply|merge|return for info|accept|decline|activate|clear|discard|mark/i;
const isBlocked = (label) => HARD_BLOCK.test(label) || (!MUTATE && UNSAFE.test(label));

const password = seedPassword();
if (!password) {
  console.error("No password. Set MAINTAINPRO_SEED_PASSWORD in maintainpro/.env or QA_PASSWORD.");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let issues = [];
let current = "login";
const seen = new Set();
const add = (kind, detail) => {
  const key = `${current}|${kind}|${detail}`;
  if (seen.has(key)) return;
  seen.add(key);
  issues.push({ page: current, kind, detail });
};

page.on("console", (m) => {
  if (m.type() === "error") {
    const t = m.text();
    if (/favicon|ERR_BLOCKED_BY_CLIENT|Download the React DevTools/i.test(t)) return;
    add("console", t.slice(0, 180));
  }
});
page.on("pageerror", (e) => add("crash", String(e.message || e).slice(0, 180)));
page.on("response", (r) => {
  const u = r.url();
  if (r.status() >= 400 && /\/api\//.test(u)) {
    add(`api ${r.status()}`, `${r.request().method()} ${new URL(u).pathname}`);
  }
});

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const i = document.querySelector("#login-email");
    return Boolean(i && Object.keys(i).some((k) => k.startsWith("__react")));
  });
  await page.locator("#login-email").fill(EMAIL);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000, waitUntil: "commit" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function collectRoutes() {
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  const routes = new Set(["/admin"]);
  for (const h of hrefs) {
    if (!h || !h.startsWith("/") || h.startsWith("//") || h.startsWith("/api") || /logout|login/.test(h)) continue;
    routes.add(h.split("#")[0]);
  }
  return [...routes].sort();
}

async function visit(route) {
  current = route;
  const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch((e) => {
    add("load", String(e.message).slice(0, 120));
    return null;
  });
  if (!res) return;
  if (res.status() >= 400) add(`http ${res.status()}`, route);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(600);
  const text = (await page.locator("body").innerText().catch(() => "")).trim();
  if (text.length < 40) add("blank", "page has almost no text");
  if (/404|this page could not be found|application error|something went wrong/i.test(text.slice(0, 600))) {
    add("error-page", text.slice(0, 100).replace(/\s+/g, " "));
  }
  const buttons = page.locator("main button:visible, main [role=tab]:visible, [role=tablist] button:visible");
  const n = Math.min(await buttons.count(), MAX_CLICKS);
  for (let i = 0; i < n; i += 1) {
    const b = buttons.nth(i);
    const label = ((await b.innerText().catch(() => "")) || (await b.getAttribute("aria-label").catch(() => "")) || "").trim();
    if (!label || isBlocked(label)) continue;
    if (!MUTATE && (await b.getAttribute("type").catch(() => "")) === "submit") continue;
    if (await b.isDisabled().catch(() => true)) continue;
    try {
      await b.click({ timeout: 2500 });
      await page.waitForTimeout(250);
      await page.keyboard.press("Escape");
      if (new URL(page.url()).pathname !== route.split("?")[0]) {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      }
    } catch (e) {
      add("click", `"${label.slice(0, 40)}" ${String(e.message).split("\n")[0].slice(0, 80)}`);
    }
  }
}

try {
  await login();
  const routes = await collectRoutes();
  console.log(`Crawling ${routes.length} pages as ${EMAIL} (${MUTATE ? "MUTATE mode: data WILL change" : "safe mode"}) ...`);
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  let done = 0;
  for (const r of routes) {
    await visit(r);
    done += 1;
    process.stdout.write(`\r${done}/${routes.length} ${r.padEnd(50).slice(0, 50)}`);
  }
  console.log("\n");
} catch (e) {
  console.error("Crawl stopped:", e.message);
  issues.push({ page: current, kind: "fatal", detail: String(e.message).slice(0, 200) });
}
await browser.close();

if (issues.length === 0) console.log("No issues found.");
else {
  console.log(`${issues.length} issue(s):`);
  for (const i of issues) console.log(`- ${i.page}  [${i.kind}]  ${i.detail}`);
}
process.exit(issues.length ? 1 : 0);
