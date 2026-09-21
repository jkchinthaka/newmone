/**
 * Smoke: domain-aware Direct Create HCI (no full WO persistence required).
 * Verifies domain picker / locked domain titles and cross-domain field hiding.
 */
import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.env.RESPONSIVE_QA_BASE_URL ?? "http://localhost:3011";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', "admin@maintainpro.local");
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }),
    page.click('button[type="submit"]')
  ]);
}

async function openCreate(page) {
  await page.getByRole("button", { name: /Create Work Order/i }).first().click();
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const findings = [];

  await login(page);

  // Machinery lane — locked domain, no Vehicle field
  await page.goto(`${base}/maintenance/jobs/machinery`, { waitUntil: "networkidle", timeout: 60000 });
  await openCreate(page);
  const machinery = await page.evaluate(() => {
    const dialog = document.querySelector(".fixed.inset-0.z-50") || document.body;
    const text = dialog.innerText || "";
    return {
      title: /Create Machinery Work Order/i.test(text),
      hasVehicle: /Vehicle \*/.test(text) || /\nVehicle\n/.test(text),
      hasMachine: /Machine \/ Asset/i.test(text),
      hasWizardSteps: /1\. Context/.test(text),
      hasPlannedStart: /Planned start/i.test(text)
    };
  });
  findings.push({ path: "/maintenance/jobs/machinery", ...machinery });
  await page.keyboard.press("Escape");

  // Vehicle lane
  await page.goto(`${base}/maintenance/jobs/vehicle`, { waitUntil: "networkidle", timeout: 60000 });
  await openCreate(page);
  const vehicle = await page.evaluate(() => {
    const dialog = document.querySelector(".fixed.inset-0.z-50") || document.body;
    const text = dialog.innerText || "";
    return {
      title: /Create Vehicle Work Order/i.test(text),
      hasMachine: /Machine \/ Asset/i.test(text),
      hasVehicle: /Vehicle/i.test(text),
      hasWizardSteps: /1\. Context/.test(text)
    };
  });
  findings.push({ path: "/maintenance/jobs/vehicle", ...vehicle });
  await page.keyboard.press("Escape");

  // Service lane
  await page.goto(`${base}/maintenance/jobs/service`, { waitUntil: "networkidle", timeout: 60000 });
  await openCreate(page);
  const service = await page.evaluate(() => {
    const dialog = document.querySelector(".fixed.inset-0.z-50") || document.body;
    const text = dialog.innerText || "";
    return {
      title: /Create Service Work Order/i.test(text),
      hasLocation: /Location \/ Facility/i.test(text),
      hasVehicleLabel: /\bVehicle \*/.test(text),
      hasMachine: /Machine \/ Asset/i.test(text)
    };
  });
  findings.push({ path: "/maintenance/jobs/service", ...service });
  await page.keyboard.press("Escape");

  // General work orders — domain picker first
  await page.goto(`${base}/work-orders`, { waitUntil: "networkidle", timeout: 60000 });
  await openCreate(page);
  const general = await page.evaluate(() => {
    const dialog = document.querySelector(".fixed.inset-0.z-50") || document.body;
    const text = dialog.innerText || "";
    return {
      asksKind: /What kind of work/i.test(text),
      hasMachinery: /Machinery/i.test(text),
      hasService: /Facility \/ Service/i.test(text),
      hasVehicle: /Vehicle/i.test(text)
    };
  });
  findings.push({ path: "/work-orders", ...general });

  const ok =
    machinery.title &&
    !machinery.hasVehicle &&
    machinery.hasMachine &&
    !machinery.hasWizardSteps &&
    !machinery.hasPlannedStart &&
    vehicle.title &&
    !vehicle.hasMachine &&
    !vehicle.hasWizardSteps &&
    service.title &&
    service.hasLocation &&
    !service.hasVehicleLabel &&
    !service.hasMachine &&
    general.asksKind;

  console.log(JSON.stringify({ ok, findings }, null, 2));
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
