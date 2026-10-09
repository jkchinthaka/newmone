import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function seedPassword() {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(envPath)) return "";
  const env = fs.readFileSync(envPath, "utf8");
  const match = env.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m);
  return match?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
}

const pages = [
  "/action-center",
  "/maintenance/jobs",
  "/assets",
  "/fleet",
  "/fleet/gate",
  "/inventory",
  "/reports",
  "/admin",
  "/notifications",
  "/settings"
];

const widths = [1440, 1024, 768, 390];

async function loginAsAdmin(page: import("@playwright/test").Page, password: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#login-email").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const input = document.querySelector("#login-email");
      return Boolean(input && Object.keys(input).some((key) => key.startsWith("__react")));
    });
    await page.locator("#login-email").fill("admin@maintainpro.local");
    await page.locator("#login-password").fill(password);
    await expect(page.locator("#login-email")).toHaveValue("admin@maintainpro.local");
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    const limited = page.getByText("Too many sign-in attempts");
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000, waitUntil: "commit" });
      return;
    } catch (error) {
      if (await limited.isVisible().catch(() => false)) {
        await page.waitForTimeout(65_000);
        continue;
      }
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Sign-in did not leave the login page");
}

const adminStatePath = path.resolve(__dirname, "../test-results/signed-in-admin-state.json");

test.describe("signed-in responsive pages", () => {
  test.describe.configure({ timeout: 180_000 });
  test.use({ storageState: adminStatePath });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const password = seedPassword();
    test.skip(!password, "Local seed password is not available");
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await loginAsAdmin(page, password);
    await context.storageState({ path: adminStatePath });
    await context.close();
  });

  test("operational pages do not overflow at representative widths", async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(!seedPassword(), "Local seed password is not available");

    await page.setViewportSize({ width: 1440, height: 900 });

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of pages) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.locator("body").waitFor({ state: "visible" });
        await expect(page).not.toHaveURL(/reason=session_expired/);
        await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        );
        expect(overflow, `${route} at ${width}`).toBe(false);
      }
    }
  });

  test("work-order queue and tab deep links survive refresh", async ({ page }) => {
    test.skip(!seedPassword(), "Local seed password is not available");

    for (const queue of ["overdue", "waiting-parts", "supervisor-verification"]) {
      await page.goto(`/maintenance/jobs?queue=${queue}`);
      await expect(page).toHaveURL(new RegExp(`queue=${queue}`));
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`queue=${queue}`));
    }

    await page.goto("/maintenance/jobs");
    const workOrderLink = page.locator('a[href*="wo="]').first();
    if ((await workOrderLink.count()) === 0) {
      test.info().annotations.push({ type: "note", description: "No work-order deep link on the jobs list" });
      return;
    }
    const href = await workOrderLink.getAttribute("href");
    expect(href).toBeTruthy();
    const target = href!.includes("tab=") ? href! : `${href}&tab=evidence`;
    await page.goto(target);
    await expect(page).toHaveURL(/wo=/);
    await expect(page).toHaveURL(/tab=evidence/);
    await page.reload();
    await expect(page).toHaveURL(/tab=evidence/);
    await page.goBack();
    await page.goForward();
    await expect(page).toHaveURL(/tab=evidence/);
  });

  test("gate, asset history, and notification context links survive refresh", async ({ page }) => {
    test.skip(!seedPassword(), "Local seed password is not available");

    const persistent: Array<{ route: string; marker: RegExp }> = [
      { route: "/fleet?view=gate&state=blocked", marker: /view=gate&state=blocked/ },
      { route: "/maintenance/history?scope=asset&q=AST-9001", marker: /scope=asset&q=AST-9001/ },
      { route: "/work-orders?wo=deep-link-probe&tab=history", marker: /wo=deep-link-probe&tab=history/ }
    ];
    for (const { route, marker } of persistent) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(marker);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(marker);
      await page.goBack();
      await page.goForward();
      await expect(page).toHaveURL(marker);
    }

    await page.goto("/notifications", { waitUntil: "domcontentloaded" });
    const openContext = page.getByRole("link", { name: "Open context" }).first();
    if ((await openContext.count()) === 0) {
      test.info().annotations.push({ type: "note", description: "No notification context link in the inbox" });
      return;
    }
    const href = await openContext.getAttribute("href");
    expect(href).toBeTruthy();
    await openContext.click();
    await expect(page).not.toHaveURL(/\/notifications$/);
    const landed = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(page.url().split("?")[0]).toBe(landed.split("?")[0]);
  });
});
