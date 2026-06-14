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

  test("does not expose a public sign-up link", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(0);
    await expect(page.getByText(/access is by invitation/i)).toBeVisible();
  });

  test("blocks empty login submission with field-level errors", async ({ page }) => {
    let loginCalls = 0;
    await page.route("**/api/auth/login", async (route) => {
      loginCalls += 1;
      await route.abort();
    });

    await page.goto("/login");
    await page.locator('input[name="email"]').fill("");
    await page.locator('input[name="password"]').fill("");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Work email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    expect(loginCalls).toBe(0);
  });

  test("rejects invalid email format before calling login API", async ({ page }) => {
    let loginCalls = 0;
    await page.route("**/api/auth/login", async (route) => {
      loginCalls += 1;
      await route.abort();
    });

    await page.goto("/login");
    await page.locator('input[name="email"]').fill("not-an-email");
    await page.locator('input[name="password"]').fill("WrongPass123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter a valid work email address")).toBeVisible();
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
    await page.locator('input[name="email"]').fill("admin@maintainpro.local");
    await page.locator('input[name="password"]').fill("WrongPass123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("logs in as admin and lands on the dashboard route", async ({ page }) => {
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
    await page.locator('input[name="email"]').fill("admin@maintainpro.local");
    await page.locator('input[name="password"]').fill(e2ePassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page).not.toHaveURL(/\/home$/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("maintainpro_access_token"))).toBe("e2e-access-token");
  });

  test("logs in as technician and lands on work orders", async ({ page }) => {
    const technicianUser = {
      ...adminUser,
      id: "user-e2e-tech",
      role: { id: "role-tech", name: "TECHNICIAN" }
    };

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: technicianUser,
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
            memberships: []
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

    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            user: technicianUser,
            accessToken: "e2e-tech-token",
            refreshToken: "e2e-tech-refresh"
          },
          message: "Login successful"
        })
      });
    });

    await page.goto("/login");
    await page.locator('input[name="email"]').fill("tech@maintainpro.local");
    await page.locator('input[name="password"]').fill(e2ePassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/work-orders");
    await expect(page).not.toHaveURL(/\/home$/);
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

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login\?reason=session_expired$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("legacy /home route shows archive label and dashboard link", async ({ page }) => {
    await mockAuthenticatedShell(page);

    await page.goto("/home");

    await expect(page.getByText("Legacy FMS Workspace").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Go to MaintainPro Dashboard/i }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/home$/);
  });

  test("admin navigation shows role-aware items without primary Home link", async ({ page }) => {
    await mockAuthenticatedShell(page);
    await page.addInitScript((user) => {
      localStorage.setItem("maintainpro_user", JSON.stringify(user));
    }, adminUser);

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/dashboard");

    const mainNav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(mainNav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Work Orders" })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "System Health" })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Home", exact: true })).toHaveCount(0);
  });

  test("mobile navigation drawer opens and shows Work Orders for admin", async ({ page }) => {
    await mockAuthenticatedShell(page);
    await page.addInitScript((user) => {
      localStorage.setItem("maintainpro_user", JSON.stringify(user));
    }, adminUser);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const mobileNav = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(mobileNav.getByRole("link", { name: "Work Orders" })).toBeVisible();
    await mobileNav.getByRole("button", { name: "Close navigation menu" }).first().click();
    await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toHaveCount(0);
  });

  test("admin console loads without crashing for admin role", async ({ page }) => {
    await mockAuthenticatedShell(page);
    await page.route("**/api/health/readiness", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            code: "HTTP_ERROR",
            message: "Forbidden"
          }
        })
      });
    });

    await page.addInitScript((user) => {
      localStorage.setItem("maintainpro_user", JSON.stringify(user));
      localStorage.setItem("maintainpro_access_token", "e2e-access-token");
    }, adminUser);

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
    await expect(page.getByText("Administration modules")).toBeVisible();
  });

  test("action center loads without crashing for admin role", async ({ page }) => {
    await mockAuthenticatedShell(page);
    await page.route("**/api/action-center**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            overdueWorkOrders: [],
            openFacilityIssues: [],
            upcomingCompliance: [],
            lowStockItems: []
          },
          message: "Action center snapshot"
        })
      });
    });

    await page.addInitScript((user) => {
      localStorage.setItem("maintainpro_user", JSON.stringify(user));
      localStorage.setItem("maintainpro_access_token", "e2e-access-token");
    }, adminUser);

    await page.goto("/action-center");

    await expect(page.getByRole("heading", { name: /Action Center/i })).toBeVisible();
  });
});
