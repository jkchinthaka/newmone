import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures/qa";
import { loginViaUi } from "../helpers/auth";

const pages = [
  { name: "login", path: "/login", authed: false },
  { name: "action-center", path: "/action-center", authed: true },
  { name: "work-orders", path: "/work-orders", authed: true },
  { name: "maintenance-jobs", path: "/maintenance/jobs", authed: true },
  { name: "reports", path: "/reports", authed: true },
  { name: "admin", path: "/admin", authed: true }
];

test.describe("Accessibility › core pages", () => {
  for (const entry of pages) {
    test(`${entry.name} has no serious/critical axe violations`, async ({ page }) => {
      if (!entry.authed) {
        await page.goto(entry.path);
      } else {
        // Reuse storageState from project; navigate directly.
        await page.goto(entry.path);
        if (page.url().includes("/login")) {
          await loginViaUi(page, "admin");
          await page.goto(entry.path);
        }
      }

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const serious = results.violations.filter((v) =>
        ["serious", "critical"].includes(String(v.impact || ""))
      );

      expect(
        serious,
        serious.map((v) => `${v.id}: ${v.help}`).join("\n")
      ).toEqual([]);
    });
  }

  test("login dialog controls expose accessible names", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByLabel(/email/i).or(page.locator("#login-email"))).toBeVisible();
  });
});
