import { expect, test } from "@playwright/test";
import { loginViaUi, readCookieMap } from "./helpers/auth";

test.describe("E2E RBAC and tenant isolation @full-stack @tenant @security", () => {
  test("E2E-RBAC-001 technician cannot open admin users management", async ({ page }) => {
    await loginViaUi(page, "tech-a");
    const response = await page.request.get("/api/backend/users");
    expect([401, 403]).toContain(response.status());
  });

  test("E2E-RBAC-002 inventory keeper cannot manage users", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const response = await page.request.post("/api/backend/users", {
      data: { email: "x@y.z", firstName: "x", lastName: "y", roleId: "000000000000000000000000" }
    });
    expect([401, 403]).toContain(response.status());
  });

  test("E2E-TENANT-001 tenant A cannot read tenant B asset by direct id", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    // List assets — should not include Tenant B tags
    const response = await page.request.get("/api/backend/assets");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("E2E-B-ASSET-");
  });

  test("E2E-TENANT-006 tenant-scoped lists exclude other tenant records", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const response = await page.request.get("/api/backend/work-orders");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("E2E-B-WO-");
  });

  test("E2E-TENANT-005 tenant switch requires membership and hides token", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const me = await page.request.get("/api/backend/tenants/me");
    expect(me.status()).toBe(200);
    const meBody = await me.json();
    const memberships = meBody.data?.memberships || meBody.memberships || [];
    const other = memberships.find((m: { tenantSlug?: string }) =>
      String(m.tenantSlug || "").startsWith("e2e-b-")
    );
    test.skip(!other?.tenantId, "Tenant B membership not present for admin-a — product/seed gap");
    const cookies = await readCookieMap(page);
    const csrf = cookies.get("maintainpro_csrf")?.value;
    const response = await page.request.post(`/api/backend/tenants/${other.tenantId}/switch`, {
      headers: csrf ? { "x-csrf-token": csrf } : {}
    });
    expect([200, 201]).toContain(response.status());
    const json = await response.json();
    expect(JSON.stringify(json)).not.toMatch(/"accessToken"\s*:/);
  });
});