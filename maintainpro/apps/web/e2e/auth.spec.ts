import { expect, test, type Page } from "@playwright/test";

const adminUser = {
  id: "user-e2e-admin",
  email: "admin@maintainpro.local",
  firstName: "Admin",
  lastName: "User",
  tenantId: "tenant-e2e",
  role: {
    id: "role-admin",
    name: "ADMIN"
  },
  permissions: ["vehicles.view", "work_orders.manage"]
};
const e2ePassword = "E2eValidPass123!";

async function mockAuthenticatedShell(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: adminUser,
        message: "Profile fetched"
      })
    });
  });

  await page.route("**/api/tenants/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          activeTenant: {
            id: "tenant-e2e",
            name: "E2E Tenant",
            slug: "e2e-tenant",
            isActive: true
          },
          memberships: [
            {
              tenantId: "tenant-e2e",
              tenantName: "E2E Tenant",
              tenantSlug: "e2e-tenant",
              membershipRole: "ADMIN",
              isActive: true
            }
          ]
        },
        message: "Tenant context fetched"
      })
    });
  });

  await page.route("**/api/notifications**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { items: [] },
        meta: { total: 0 },
        message: "Notifications fetched"
      })
    });
  });
}

test.describe("authentication", () => {
  test("keeps the password hidden by default and toggles visibility", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.getByLabel("Show password").click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    await page.getByLabel("Hide password").click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("blocks empty login submission with field-level errors", async ({ page }) => {
    let loginCalls = 0;
    await page.route("**/api/auth/login", async (route) => {
      loginCalls += 1;
      await route.abort();
    });

    await page.goto("/login");
    await page.locator('input[name="username"]').fill("");
    await page.locator('input[name="password"]').fill("");
    await page.getByRole("button", { name: "LOGIN" }).click();

    await expect(page.getByText("Username is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    expect(loginCalls).toBe(0);
  });

  test("shows a clear invalid-credentials message", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            code: "HTTP_ERROR",
            message: "Invalid email or password"
          }
        })
      });
    });

    await page.goto("/login");
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("WrongPass123");
    await page.getByRole("button", { name: "LOGIN" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("logs in, stores the session, and opens the protected home page", async ({ page }) => {
    await mockAuthenticatedShell(page);
    await page.addInitScript(() => {
      localStorage.setItem("maintainpro_active_tenant", "stale-tenant-from-previous-session");
    });
    await page.route("**/api/auth/login", async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        email: "admin@maintainpro.local",
        password: e2ePassword
      });
      expect(route.request().headers()["x-tenant-id"]).toBeUndefined();

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            user: adminUser,
            accessToken: "e2e-access-token",
            refreshToken: "e2e-refresh-token"
          },
          message: "Login successful"
        })
      });
    });

    await page.goto("/login");
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill(e2ePassword);
    await page.getByRole("button", { name: "LOGIN" }).click();

    await page.waitForURL("**/home");
    await expect(page.getByRole("heading", { name: "Pending Requests" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("maintainpro_access_token"))).toBe("e2e-access-token");
  });

  test("redirects unauthenticated protected-route access to login", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            code: "HTTP_ERROR",
            message: "Unauthorized"
          }
        })
      });
    });

    await page.goto("/home");

    await expect(page).toHaveURL(/\/login\?reason=session_expired$/);
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  });
});
