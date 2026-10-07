import { expect, test } from "@playwright/test";
import { loginExpectFailure } from "../helpers/auth";
import { e2eEmail, e2ePassword } from "../helpers/env";

test.describe.configure({ mode: "serial" });

test.describe("Auth › unauthenticated session", () => {
  test("invalid password is rejected", async ({ page }) => {
    const status = await loginExpectFailure(page, e2eEmail("admin"), "DefinitelyWrongPass!999");
    // 429 = auth throttle after suite setup; still a non-success login outcome.
    expect([401, 403, 400, 429]).toContain(status);
  });

  test("unknown email fails generically", async ({ page }) => {
    const status = await loginExpectFailure(
      page,
      "nobody-qa-e2e@maintainpro.local",
      e2ePassword()
    );
    expect([401, 403, 400, 404]).toContain(status);
  });

  test("direct protected route redirects when logged out", async ({ browser }) => {
    // Known defect QA-E2E-AUTH-REDIRECT: /action-center may render without redirecting to /login.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto("/action-center");
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    } finally {
      await context.close();
    }
  });
});
