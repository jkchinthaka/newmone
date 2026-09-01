import { expect, test, type Page } from "@playwright/test";

const superAdminUser = {
  id: "user-e2e-super-admin",
  email: "superadmin@maintainpro.local",
  firstName: "Super",
  lastName: "Admin",
  tenantId: "tenant-e2e",
  role: { id: "role-super-admin", name: "SUPER_ADMIN" },
  permissions: []
};

const adminUser = {
  ...superAdminUser,
  id: "user-e2e-admin",
  email: "admin@maintainpro.local",
  role: { id: "role-admin", name: "ADMIN" }
};

async function mockAuthenticatedShell(page: Page, user: typeof superAdminUser) {
  await page.context().addCookies([
    { name: "maintainpro_access", value: "e2e-access-token", url: "http://127.0.0.1:3001", httpOnly: true, sameSite: "Lax" },
    { name: "maintainpro_refresh", value: "e2e-refresh-token", url: "http://127.0.0.1:3001", httpOnly: true, sameSite: "Lax" },
    { name: "maintainpro_csrf", value: "e2e-csrf-token", url: "http://127.0.0.1:3001", httpOnly: false, sameSite: "Lax" }
  ]);

  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: user, message: "Profile fetched" }) })
  );
  await page.route("**/api/backend/tenants/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          activeTenant: { id: "tenant-e2e", name: "E2E Tenant", slug: "e2e-tenant", isActive: true },
          memberships: [{ tenantId: "tenant-e2e", tenantName: "E2E Tenant", tenantSlug: "e2e-tenant", membershipRole: user.role.name, isActive: true }]
        },
        message: "Tenant context fetched"
      })
    })
  );
  await page.route("**/api/backend/notifications**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [] }, meta: { total: 0 }, message: "ok" }) })
  );

  await page.addInitScript((seedUser) => {
    localStorage.setItem("maintainpro_user", JSON.stringify(seedUser));
  }, user);
}

test.describe("Bulk Import — authorization and wizard", () => {
  test("Bulk Upload button is visible to SUPER_ADMIN on the Departments page", async ({ page }) => {
    await mockAuthenticatedShell(page, superAdminUser);
    await page.route("**/api/backend/departments**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], message: "Departments fetched" }) })
    );

    await page.goto("/master-data/departments");

    await expect(page.getByRole("button", { name: "Bulk Upload" })).toBeVisible();
  });

  test("Bulk Upload button is hidden for a non-SUPER_ADMIN role (client UX only — server independently enforces this)", async ({ page }) => {
    await mockAuthenticatedShell(page, adminUser);
    await page.route("**/api/backend/departments**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], message: "Departments fetched" }) })
    );

    await page.goto("/master-data/departments");

    await expect(page.getByRole("button", { name: "Bulk Upload" })).toHaveCount(0);
  });

  test("full preview -> confirm -> result flow against a mocked API", async ({ page }) => {
    await mockAuthenticatedShell(page, superAdminUser);
    await page.route("**/api/backend/departments**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], message: "Departments fetched" }) })
    );

    const previewResponse = {
      data: {
        run: {
          id: "run-e2e-1",
          entityType: "DEPARTMENT",
          mode: "CREATE_NEW_SKIP_EXISTING",
          status: "VALIDATED",
          originalFilename: "departments.csv",
          fileFormat: "csv",
          fileSha256: "abc123",
          fileSizeBytes: 42,
          actorEmail: superAdminUser.email,
          totalRows: 1,
          createCount: 1,
          updateCount: 0,
          skipCount: 0,
          errorCount: 0,
          errorSummary: null,
          createdAt: new Date().toISOString(),
          validatedAt: new Date().toISOString(),
          committedAt: null,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString()
        },
        rows: [
          {
            id: "row-1",
            rowNumber: 2,
            naturalKey: "OPS",
            data: { code: "OPS", name: "Operations" },
            action: "CREATE",
            errors: [],
            warnings: [],
            createdEntityId: null
          }
        ],
        summary: { totalRows: 1, createCount: 1, updateCount: 0, skipCount: 0, errorCount: 0 },
        blocked: false,
        commitAllowed: true
      },
      message: "Preview generated"
    };

    await page.route("**/api/backend/bulk-import/department/preview", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(previewResponse) })
    );
    await page.route("**/api/backend/bulk-import/department/run-e2e-1/commit", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { run: { ...previewResponse.data.run, status: "COMPLETED" }, reused: false, message: "Import completed." },
          message: "Import completed."
        })
      })
    );

    await page.goto("/master-data/departments");
    await page.getByRole("button", { name: "Bulk Upload" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose file" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "departments.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Code,Name\nOPS,Operations\n", "utf-8")
    });

    await expect(page.getByText("Will create")).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirm & Import/ })).toBeEnabled();

    await page.getByRole("button", { name: /Confirm & Import/ }).click();

    await expect(page.getByText("Import completed.")).toBeVisible();
  });

  test("Admin Bulk Import History page requires SUPER_ADMIN", async ({ page }) => {
    await mockAuthenticatedShell(page, adminUser);

    await page.goto("/admin/bulk-imports");

    await expect(page.getByText("SUPER_ADMIN access required")).toBeVisible();
  });
});
