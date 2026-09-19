/**
 * Smoke work-order editor modal (detail/execution surface) across closeout widths.
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

async function measure(page) {
  return page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const heading = Array.from(document.querySelectorAll("h3")).find((h) =>
      /^Work Order\b|^Create Work Order$/i.test((h.textContent || "").trim())
    );
    const overlay = document.querySelector(".fixed.inset-0.z-50");
    const panel = overlay?.querySelector(".max-w-3xl") || overlay;
    const target = panel || heading?.closest("div");
    const dr = target ? target.getBoundingClientRect() : null;
    return {
      scrollWidth: sw,
      clientWidth: cw,
      overflowX: sw > cw + 2,
      dialog: target && heading
        ? {
            found: true,
            heading: (heading.textContent || "").trim().slice(0, 60),
            width: Math.round(dr.width),
            left: Math.round(dr.left),
            right: Math.round(dr.right),
            clipped: dr.right > cw + 4 || dr.left < -4,
            textLen: (target.innerText || "").length
          }
        : { found: false }
    };
  });
}

async function openEditor(page) {
  const listTab = page.getByRole("button", { name: /^List$/i });
  if (await listTab.count()) {
    await listTab.click();
    await page.waitForTimeout(800);
  }

  // List table actions: Edit / Complete / Cancel
  const editInTable = page.locator("table").getByRole("button", { name: /^Edit$/i }).first();
  if (await editInTable.count()) {
    await editInTable.click();
    return "list-edit";
  }

  const editWo = page.getByRole("button", { name: /Edit work order/i }).first();
  if (await editWo.count()) {
    await editWo.click();
    return "kanban-edit";
  }

  const openBtn = page.getByRole("button", { name: /^Open$/i }).first();
  if (await openBtn.count()) {
    await openBtn.click();
    return "queue-open";
  }

  // Mobile card list: click first card button/row
  const card = page.locator("button, article").filter({ hasText: /WO-|Work Order/i }).first();
  if (await card.count()) {
    await card.click();
    return "card";
  }

  return null;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', "admin@maintainpro.local");
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }),
    page.click('button[type="submit"]')
  ]);

  const findings = [];
  for (const vp of widths) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${base}/work-orders`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);

    const how = await openEditor(page);
    if (!how) {
      findings.push({ viewport: vp.name, status: "skip", reason: "no_open_control" });
      continue;
    }
    await page.waitForTimeout(1200);

    const detail = await measure(page);
    const defect = detail.overflowX || !detail.dialog.found || detail.dialog.clipped;
    findings.push({
      viewport: vp.name,
      width: vp.width,
      how,
      status: defect ? "defect" : "ok",
      detail
    });

    await page.locator(".fixed.inset-0.z-50").getByRole("button", { name: /^Close$/i }).click().catch(() =>
      page.keyboard.press("Escape")
    );
  }

  const defects = findings.filter((f) => f.status === "defect");
  const skips = findings.filter((f) => f.status === "skip");
  console.log(
    JSON.stringify(
      { summary: { total: findings.length, defects: defects.length, skips: skips.length }, findings, defects },
      null,
      2
    )
  );
  await browser.close();
  process.exit(defects.length || skips.length === findings.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
