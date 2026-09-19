/**
 * Production-build responsive overflow audit (authenticated).
 * Excludes intentional overflow-x scroll regions from clipped-button detection.
 */
import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.env.RESPONSIVE_QA_BASE_URL ?? "http://localhost:3011";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

const widths = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 }
];

const paths = [
  "/action-center",
  "/requests",
  "/requests/new",
  "/work-orders",
  "/assets",
  "/inventory",
  "/fleet",
  "/fleet/gate",
  "/approvals",
  "/admin/work-permits",
  "/maintenance/reliability",
  "/reports",
  "/admin/users",
  "/admin/maintenance-config"
];

async function measure(page) {
  return page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    function inScrollX(el) {
      let n = el;
      while (n && n !== document.body) {
        const s = getComputedStyle(n);
        if ((s.overflowX === "auto" || s.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 2) {
          return true;
        }
        n = n.parentElement;
      }
      return false;
    }
    const offenders = [];
    if (sw > cw + 2) {
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const r = el.getBoundingClientRect();
        if (r.width > cw + 8 && r.height > 0 && !inScrollX(el)) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || "").slice(0, 80),
            w: Math.round(r.width)
          });
          if (offenders.length >= 8) break;
        }
      }
    }
    const clipped = [];
    for (const el of document.querySelectorAll("button, a, [role='button']")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if ((r.right > cw + 4 || r.left < -4) && !inScrollX(el)) {
        clipped.push((el.textContent || "").trim().slice(0, 40));
        if (clipped.length >= 8) break;
      }
    }
    const menu = document.querySelector('button[aria-label="Open navigation menu"]');
    const menuStyle = menu ? getComputedStyle(menu) : null;
    return {
      scrollWidth: sw,
      clientWidth: cw,
      overflowX: sw > cw + 2,
      offenders,
      clippedButtons: clipped,
      bodyTextLen: (document.body?.innerText || "").length,
      mobileNav: menu
        ? {
            found: true,
            displayed: menuStyle.display !== "none" && menuStyle.visibility !== "hidden"
          }
        : { found: false }
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const findings = [];

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', "admin@maintainpro.local");
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }),
    page.click('button[type="submit"]')
  ]);

  let woDetail = null;
  await page.goto(`${base}/work-orders`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
  woDetail = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href*="/work-orders/"]')).find((el) =>
      /\/work-orders\/[^/?]+/.test(el.getAttribute("href") || "")
    );
    return a?.getAttribute("href") || null;
  });
  const allPaths = woDetail ? [...paths, woDetail] : paths;

  for (const vp of widths) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const path of allPaths) {
      const url = path.startsWith("http") ? path : `${base}${path}`;
      let status = "ok";
      let detail = {};
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(1000);
        if (page.url().includes("/login")) {
          status = "error";
          detail = { message: "redirected to login" };
        } else {
          const metrics = await measure(page);
          detail = { ...metrics, http: res?.status() };
          if (metrics.overflowX || metrics.clippedButtons.length) status = "defect";
          if (vp.width < 1280 && metrics.mobileNav.found && !metrics.mobileNav.displayed) {
            status = "defect";
            detail.mobileNavIssue = true;
          }
          if (vp.width >= 1280 && metrics.mobileNav.displayed) {
            // ok — xl:hidden handles; displayed false expected at xl
          }
        }
      } catch (e) {
        status = "error";
        detail = { message: String(e.message || e).slice(0, 200) };
      }
      const row = { viewport: vp.name, width: vp.width, path, status, detail };
      findings.push(row);
      console.log(JSON.stringify(row));
    }
  }

  // Login short-height check: Sign in button should be reachable via page scroll
  await page.setViewportSize({ width: 390, height: 560 });
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const loginReach = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (!btn) return { found: false };
    btn.scrollIntoView({ block: "center" });
    const r = btn.getBoundingClientRect();
    return {
      found: true,
      inView: r.top >= 0 && r.bottom <= window.innerHeight + 2,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      vh: window.innerHeight
    };
  });
  findings.push({
    viewport: "mobile-short-560",
    width: 390,
    path: "/login",
    status: loginReach.found && loginReach.inView ? "ok" : "defect",
    detail: loginReach
  });
  console.log(JSON.stringify(findings[findings.length - 1]));

  await browser.close();
  const defects = findings.filter((f) => f.status === "defect");
  const errors = findings.filter((f) => f.status === "error");
  console.log(
    JSON.stringify({ summary: { total: findings.length, defects: defects.length, errors: errors.length, base }, defects, errors }, null, 2)
  );
  process.exit(defects.length || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
