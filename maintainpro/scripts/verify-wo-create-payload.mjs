import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const posts = [];
  const allPostUrls = [];

  page.on("request", (req) => {
    if (req.method() === "POST") {
      allPostUrls.push(req.url());
      if (req.url().includes("work-order")) {
        posts.push({ url: req.url(), body: req.postData() });
      }
    }
  });

  await page.goto("http://localhost:3011/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@maintainpro.local");
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }),
    page.click('button[type="submit"]')
  ]);

  await page.goto("http://localhost:3011/maintenance/jobs/machinery", {
    waitUntil: "networkidle"
  });
  await page.getByRole("button", { name: /Create Work Order/i }).first().click();
  await page.waitForTimeout(800);

  // Use page.evaluate to set asset via reacting to form is hard; loosen validation by
  // selecting any listed option after typing.
  const search = page.getByPlaceholder("Search machine...");
  await search.click();
  await search.fill(" ");
  await page.waitForTimeout(1500);
  const options = page.locator("[role=option]");
  const count = await options.count();
  if (count > 0) {
    await options.nth(0).click();
  }

  await page.getByPlaceholder("Describe the problem...").fill("HCI domain stamp proof packing bearing noise");
  await page.waitForTimeout(500);

  const alertBefore = await page.locator('[role=alert]').allTextContents();
  await page.locator("form").getByRole("button", { name: /^Create Work Order$/i }).click();
  await page.waitForTimeout(2500);
  const alertAfter = await page.locator('[role=alert]').allTextContents();

  console.log(
    JSON.stringify(
      {
        optionCount: count,
        alertBefore,
        alertAfter,
        workOrderPosts: posts,
        recentPosts: allPostUrls.slice(-10)
      },
      null,
      2
    )
  );
  await browser.close();
  const ok = posts.some((p) => {
    try {
      return JSON.parse(p.body || "{}").jobDomain === "MACHINERY";
    } catch {
      return false;
    }
  });
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
