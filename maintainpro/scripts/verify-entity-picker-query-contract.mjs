/**
 * Verify WO entity picker query contracts after hotfix.
 */
import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.env.RESPONSIVE_QA_BASE_URL ?? "http://localhost:3001";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const assetUrls = [];
  const vehicleUrls = [];
  const locationUrls = [];
  const httpBad = [];
  const consoleErrors = [];
  const consoleWarns = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    const t = msg.text();
    if (/chrome-extension|moz-extension/i.test(t)) return;
    if (msg.type() === "error") consoleErrors.push(t.slice(0, 220));
    if (msg.type() === "warning") consoleWarns.push(t.slice(0, 220));
  });
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 220)));
  page.on("response", (res) => {
    const url = res.url();
    const status = res.status();
    const short = url.includes(base) ? url.replace(base, "") : url;
    if (url.includes("/api/backend/assets")) assetUrls.push({ status, url: short });
    if (url.includes("/api/backend/vehicles")) vehicleUrls.push({ status, url: short });
    if (url.includes("/api/backend/organization/locations")) {
      locationUrls.push({ status, url: short });
    }
    if ([400, 401, 403, 404, 500].includes(status) && url.includes("/api/backend/")) {
      httpBad.push({ status, url: short.slice(0, 200) });
    }
  });

  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', "admin@maintainpro.local");
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }),
    page.click('button[type="submit"]')
  ]);

  consoleErrors.length = 0;
  consoleWarns.length = 0;
  httpBad.length = 0;
  pageErrors.length = 0;

  async function openCreate(path) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.getByRole("button", { name: /Create Work Order/i }).first().click();
    // Wait for EntityPicker mount + debounced initial list fetch.
    await page.waitForTimeout(1200);
  }

  assetUrls.length = 0;
  await openCreate("/maintenance/jobs/machinery");
  const machineryIdle = [...assetUrls];
  await page.getByPlaceholder("Search machine...").click();
  await page.getByPlaceholder("Search machine...").fill("a");
  await page.waitForTimeout(1000);
  const machinerySearch = assetUrls.filter((u) => /search=/.test(u.url));
  const machineryErrorVisible = await page.locator("text=Request failed with status code 400").count();
  await page.keyboard.press("Escape");

  vehicleUrls.length = 0;
  await openCreate("/maintenance/jobs/vehicle");
  const vehicleIdle = [...vehicleUrls];
  await page.getByPlaceholder("Search vehicle...").fill("a");
  await page.waitForTimeout(1000);
  const vehicleSearch = vehicleUrls.filter((u) => /[?&]q=/.test(u.url));
  await page.keyboard.press("Escape");

  locationUrls.length = 0;
  await openCreate("/maintenance/jobs/service");
  const locationIdle = [...locationUrls];
  await page.getByPlaceholder("Select location...").fill("a");
  await page.waitForTimeout(1000);
  const locationSearch = locationUrls.filter((u) => /[?&]q=/.test(u.url));
  await page.keyboard.press("Escape");

  assetUrls.length = 0;
  await page.goto(`${base}/work-orders`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: /Create Work Order/i }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Machinery/i }).first().click();
  await page.waitForTimeout(1200);
  const generalMachinery = [...assetUrls];

  const summarize = (list) =>
    list.map((x) => ({
      status: x.status,
      qs: (x.url.split("?")[1] || "")
    }));

  const allAsset = [...machineryIdle, ...machinerySearch, ...generalMachinery];
  const result = {
    machineryIdle: summarize(machineryIdle),
    machinerySearch: summarize(machinerySearch),
    vehicleIdle: summarize(vehicleIdle),
    vehicleSearch: summarize(vehicleSearch),
    locationIdle: summarize(locationIdle),
    locationSearch: summarize(locationSearch),
    generalMachinery: summarize(generalMachinery),
    machineryErrorVisible,
    badAssetQs: allAsset.filter((u) => /[?&](pageSize|q)=/.test(u.url)),
    consoleError: consoleErrors.length,
    consoleWarn: consoleWarns.length,
    httpBadCount: httpBad.length,
    httpBad: httpBad.slice(0, 8),
    pageErrors: pageErrors.length,
    sampleErrors: consoleErrors.slice(0, 5)
  };
  console.log(JSON.stringify(result, null, 2));

  const assetsOk =
    machineryIdle.some((u) => u.status < 400 && /limit=20/.test(u.url) && !/[?&]pageSize=/.test(u.url)) &&
    machinerySearch.some(
      (u) =>
        u.status < 400 &&
        /limit=20/.test(u.url) &&
        /search=/.test(u.url) &&
        !/[?&]q=/.test(u.url)
    ) &&
    result.badAssetQs.length === 0 &&
    machineryErrorVisible === 0;

  const vehiclesOk =
    vehicleIdle.some((u) => u.status < 400 && /pageSize=20/.test(u.url)) &&
    vehicleSearch.some((u) => u.status < 400 && /[?&]q=/.test(u.url));

  const locationsOk =
    locationIdle.some((u) => u.status < 400 && /pageSize=20/.test(u.url)) &&
    locationSearch.some((u) => u.status < 400 && /[?&]q=/.test(u.url));

  const clean = result.consoleError === 0 && result.httpBadCount === 0 && result.pageErrors === 0;

  await browser.close();
  process.exit(assetsOk && vehiclesOk && locationsOk && clean ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
