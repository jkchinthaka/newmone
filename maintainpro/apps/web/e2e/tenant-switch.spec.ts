import { expect, test, type Page } from "@playwright/test";

const tenantA = {
  tenantId: "tenant-e2e-a",
  tenantName: "E2E Tenant A",
  tenantSlug: "e2e-tenant-a",
  membershipRole: "ADMIN",
  isActive: true
};

const tenantB = {
  tenantId: "tenant-e2e-b",
  tenantName: "E2E Tenant B",
  tenantSlug: "e2e-tenant-b",
  membershipRole: "ADMIN",
  isActive: true
};

const adminUser = {
  id: "user-e2e-admin",
  email: "admin@maintainpro.local",
  firstName: "Admin",
  lastName: "User",
  tenantId: tenantA.tenantId,
  role: {
    id: "role-admin",
    name: "ADMIN"
  },
  permissions: ["vehicles.view", "work_orders.manage", "fg.access"]
};

async function mockMultiTenantShell(page: Page, state: { switchedTo: string; tenantHeaders: string[] }) {
  await page.context().addCookies([
    {
      name: "maintainpro_access",
      value: "e2e-access-token",
      url: "http://127.0.0.1:3001",
      httpOnly: true,
      sameSite: "Lax"
    },
    {
      name: "maintainpro_refresh",
      value: "e2e-refresh-token",
      url: "http://127.0.0.1:3001",
      httpOnly: true,
      sameSite: "Lax"
    },
    {
      name: "maintainpro_csrf",
      value: "e2e-csrf-token",
      url: "http://127.0.0.1:3001",
      httpOnly: false,
      sameSite: "Lax"
    }
  ]);

  await page.route("**/api/backend/**", async (route) => {
    const url = route.request().url();
    const header = route.request().headers()["x-tenant-id"];
    if (header) {
      state.tenantHeaders.push(header);
    }

    if (url.includes("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: adminUser,
          message: "Profile fetched"
        })
      });
      return;
    }

    if (url.includes("/tenants/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            activeTenant: {
              id: tenantA.tenantId,
              name: tenantA.tenantName,
              slug: tenantA.tenantSlug,
              isActive: true
            },
            memberships: [tenantA, tenantB]
          },
          message: "Tenant context fetched"
        })
      });
      return;
    }

    if (url.includes("/tenants/") && url.includes("/switch")) {
      state.switchedTo = url.split("/tenants/")[1]?.split("/switch")[0] ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { switched: true },
          message: "Tenant switched"
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { items: [] },
        meta: { total: 0 },
        message: "ok"
      })
    });
  });
}

test.describe("tenant switching", () => {
  test("clears the previous tenant after a successful organization switch", async ({ page }) => {
    const state = { switchedTo: "", tenantHeaders: [] as string[] };
    await mockMultiTenantShell(page, state);

    await page.addInitScript((user) => {
      localStorage.setItem("maintainpro_user", JSON.stringify(user));
      localStorage.setItem("maintainpro_active_tenant", "tenant-e2e-a");
    }, adminUser);

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/dashboard");

    const switcher = page.getByLabel("Switch organization");
    await expect(switcher).toBeVisible();
    await expect(switcher).toHaveValue("tenant-e2e-a");

    await switcher.selectOption("tenant-e2e-b");
    await expect.poll(() => state.switchedTo).toBe("tenant-e2e-b");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("maintainpro_active_tenant"))).toBe(
      "tenant-e2e-b"
    );
    await expect.poll(() => state.tenantHeaders.includes("tenant-e2e-b")).toBe(true);
    await expect(switcher).toHaveValue("tenant-e2e-b");
  });
});
