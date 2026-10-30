import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function seedPassword() {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(envPath)) return "";
  const env = fs.readFileSync(envPath, "utf8");
  const match = env.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m);
  return match?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
}

const outDir = path.resolve(__dirname, "../../../docs/handover/ui-redesign/batch-3b");

const pages = [
  { slug: "work-orders", route: "/maintenance/jobs", heading: "Jobs" },
  { slug: "approvals", route: "/approvals", heading: "Approvals" },
  { slug: "fleet", route: "/fleet", heading: "Fleet" },
  { slug: "spare-parts", route: "/inventory", heading: "Spare Parts" }
] as const;

const widths = [1440, 390] as const;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").waitFor({ state: "visible" });
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000, waitUntil: "commit" });
}

test.describe("batch 3b visual", () => {
  test.describe.configure({ timeout: 180_000, mode: "serial" });

  for (const role of [
    { slug: "admin", email: "admin@maintainpro.local" },
    { slug: "manager", email: "manager@maintainpro.local" }
  ]) {
    test(`${role.slug} screenshots at 390 and 1440`, async ({ page }) => {
      const password = seedPassword();
      test.skip(!password, "Local seed password is not available");
      fs.mkdirSync(outDir, { recursive: true });
      await login(page, role.email, password);
      const consoleErrors: string[] = [];
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      for (const width of widths) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        for (const target of pages) {
          await page.goto(target.route, { waitUntil: "domcontentloaded" });
          const heading = page.getByRole("heading", { name: target.heading, exact: true });
          const opened = await heading
            .waitFor({ state: "visible", timeout: 15_000 })
            .then(() => true)
            .catch(() => false);
          if (!opened) {
            await page.screenshot({
              path: path.join(outDir, `${role.slug}-${target.slug}-redirect-${width}.png`),
              fullPage: false
            });
            const landed = page.url();
            if (role.slug === "manager" && target.slug === "approvals") {
              test.info().annotations.push({
                type: "redirect",
                description: `manager /approvals at ${width} landed on ${landed} because navigation requires approvals.view`
              });
              continue;
            }
            throw new Error(`${target.route} at ${width} landed on ${landed}`);
          }
          await page.waitForTimeout(500);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
          );
          expect(overflow, `${target.route} at ${width}`).toBe(false);
          await page.screenshot({
            path: path.join(outDir, `${role.slug}-${target.slug}-${width}.png`),
            fullPage: false
          });
        }
      }

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    });
  }
});
