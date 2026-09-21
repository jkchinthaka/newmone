/**
 * Runtime HCI browser smoke — authenticated pages on a clean production build.
 * Ignores browser-extension console noise.
 */
import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.env.RESPONSIVE_QA_BASE_URL ?? "http://localhost:3011";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

const paths = ["/login", "/action-center", "/vehicles", "/fleet", "/inventory", "/notifications"];

function isExtensionNoise(text) {
  return /extension:\/\/|chrome-extension:\/\/|moz-extension:\/\/|Failed to load resource: net::ERR_FILE_NOT_FOUND.*extension/i.test(
    text
  );
}

function isExpectedNoise(text) {
  // Downloadable fonts / Next chunk prefetch flakiness are not app defects for this pass.
  return /Download the React DevTools|\[HMR\]|Fast Refresh/i.test(text);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const findings = [];

  const consoleErrors = [];
  const consoleWarns = [];
  const hydration = [];
  const pageErrors = [];
  const rejections = [];
  const badHttp = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (isExtensionNoise(text) || isExpectedNoise(text)) return;
    // Chrome surfaces third-party CDN/OSRM failures as console.error — not app defects.
    if (/Failed to load resource:.*status of (4\d\d|5\d\d)/i.test(text)) {
      return;
    }
    if (/hydrat|did not match|server rendered HTML/i.test(text)) {
      hydration.push(text.slice(0, 300));
    }
    if (msg.type() === "error") consoleErrors.push(text.slice(0, 300));
    if (msg.type() === "warning") consoleWarns.push(text.slice(0, 300));
  });
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (isExtensionNoise(url)) return;
    // socket failures when realtime disabled / API origin blocked are expected when flag off
    if (/\/socket\.io\//i.test(url)) return;
  });
  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (!url.startsWith(base) && !url.includes("/api/")) return;
    if (status === 404 || status === 500 || status === 401 || status === 403) {
      // login page may 401 on /auth/me probes — ignore pre-auth
      badHttp.push({ status, url: url.slice(0, 180), path: page.url() });
    }
  });

  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.reload({ waitUntil: "networkidle" }); // hard refresh
  await page.fill('input[type="email"]', "admin@maintainpro.local");
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }),
    page.click('button[type="submit"]')
  ]);

  // Clear counters after login redirect noise
  consoleErrors.length = 0;
  consoleWarns.length = 0;
  hydration.length = 0;
  pageErrors.length = 0;
  badHttp.length = 0;

  for (const path of paths) {
    consoleErrors.length = 0;
    consoleWarns.length = 0;
    hydration.length = 0;
    pageErrors.length = 0;
    rejections.length = 0;
    badHttp.length = 0;

    await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);

    // Filter expected auth responses: none for admin on these pages
    const unexpected = badHttp.filter((h) => {
      if (path === "/login") return false;
      // 404 for missing favicon etc.
      if (h.status === 404 && /favicon|manifest|\.map$/i.test(h.url)) return false;
      return true;
    });

    const row = {
      path,
      consoleError: consoleErrors.length,
      consoleWarn: consoleWarns.length,
      hydration: hydration.length,
      pageError: pageErrors.length,
      httpBad: unexpected,
      sampleErrors: consoleErrors.slice(0, 3),
      sampleWarns: consoleWarns.slice(0, 3),
      sampleHttp: unexpected.slice(0, 5)
    };
    findings.push(row);
  }

  const failed = findings.filter(
    (f) =>
      f.consoleError > 0 ||
      f.consoleWarn > 0 ||
      f.hydration > 0 ||
      f.pageError > 0 ||
      f.httpBad.length > 0
  );

  console.log(JSON.stringify({ summary: { pages: findings.length, failed: failed.length }, findings, failed }, null, 2));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
