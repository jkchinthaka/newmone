import { expect, test } from "@playwright/test";

const workOrder = {
  id: "wo-visual",
  woNumber: "WO-1042",
  title: "Replace compressor belt",
  description: "Belt is glazed and slipping under load.",
  priority: "HIGH",
  status: "IN_PROGRESS",
  approvalStatus: "APPROVED",
  verificationStatus: "PENDING",
  type: "CORRECTIVE",
  jobDomain: "MACHINERY",
  assetId: "asset-1",
  createdById: "user-e2e-admin",
  slaBreached: false,
  attachments: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
  estimatedCost: 120,
  estimatedHours: 2,
  asset: { id: "asset-1", name: "Air Compressor 01", assetTag: "AST-0021" }
};

test("work order drawer is readable at representative widths", async ({ page }) => {
  await page.context().addCookies([
    { name: "maintainpro_access", value: "e2e-access-token", url: "http://127.0.0.1:3001", httpOnly: true, sameSite: "Lax" },
    { name: "maintainpro_refresh", value: "e2e-refresh-token", url: "http://127.0.0.1:3001", httpOnly: true, sameSite: "Lax" },
    { name: "maintainpro_csrf", value: "e2e-csrf-token", url: "http://127.0.0.1:3001", httpOnly: false, sameSite: "Lax" }
  ]);
  await page.addInitScript(() => {
    localStorage.setItem(
      "maintainpro_user",
      JSON.stringify({
        id: "user-e2e-admin",
        email: "admin@maintainpro.local",
        role: { name: "ADMIN" },
        tenantId: "tenant-e2e",
        permissions: ["work_orders.manage", "audit.view"]
      })
    );
  });

  await page.route("**/api/backend/**", async (route) => {
    const url = route.request().url();
    const json = (data: unknown, meta?: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data, meta, message: "ok" })
      });

    if (url.includes("/auth/me")) {
      return json({
        id: "user-e2e-admin",
        email: "admin@maintainpro.local",
        firstName: "Admin",
        lastName: "User",
        tenantId: "tenant-e2e",
        role: { id: "role-admin", name: "ADMIN" },
        permissions: ["work_orders.manage", "audit.view"]
      });
    }
    if (url.includes("/tenants/me")) {
      return json({
        activeTenant: { id: "tenant-e2e", name: "E2E Tenant", slug: "e2e-tenant", isActive: true },
        memberships: [{ tenantId: "tenant-e2e", tenantName: "E2E Tenant", tenantSlug: "e2e-tenant", membershipRole: "ADMIN", isActive: true }]
      });
    }
    const path = new URL(url).pathname;
    if (path.endsWith("/work-orders/wo-visual/domain-context")) {
      return json({
        workOrderId: "wo-visual",
        woNumber: "WO-1042",
        jobDomain: "MACHINERY",
        identity: {
          machinery: {
            label: "Air Compressor 01",
            operationalStatus: "In service",
            criticality: "High",
            site: "Plant A",
            functionalLocation: "Workshop",
            meterReading: "1200 h"
          },
          service: null,
          vehicle: null
        },
        completion: {
          functionalTestResult: "Pending",
          roadTestResult: "Not required",
          completionMeterReading: null,
          operatingRestriction: "None",
          productionImpact: "Low",
          temporaryRepair: false,
          productionResumedAt: null
        },
        serviceDue: null,
        openJobsOnTarget: 2,
        criticalOpenWorkOrders: 1,
        controlIndicators: [],
        accident: null,
        readOnlyHints: {}
      });
    }
    if (path.endsWith("/work-orders/wo-visual/evidence")) {
      return json({ items: [], requirements: { required: false } });
    }
    if (path.includes("/work-orders/queues/")) {
      return json({
        data: [workOrder],
        total: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        queue: "all",
        label: "All",
        lastUpdated: "2026-10-08T00:00:00.000Z"
      });
    }
    if (path.endsWith("/work-orders/queues")) {
      return json({
        queues: [
          { key: "action-required", label: "Action Required", count: 0 },
          { key: "all", label: "All", count: 1 },
          { key: "in-progress", label: "In Progress", count: 1 }
        ],
        defaultQueue: "all",
        lastUpdated: "2026-10-08T00:00:00.000Z"
      });
    }
    if (path.endsWith("/work-orders/wo-visual")) {
      return json(workOrder);
    }
    if (path.includes("/work-orders")) {
      return json([workOrder], { total: 1, page: 1, pageSize: 25, totalPages: 1, summary: { total: 1, open: 0, inProgress: 1, overdue: 0 } });
    }
    return json([]);
  });

  const widths = [1440, 1024, 768, 390];
  const results: Array<Record<string, unknown>> = [];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/work-orders?wo=wo-visual&tab=overview");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole("heading", { name: "Replace compressor belt" })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("button", { name: "Save Overview" })).toBeVisible();
    await expect(dialog.getByText("Air Compressor 01").first()).toBeVisible();
    const metrics = await dialog.evaluate((node) => ({
      client: node.clientWidth,
      scroll: node.scrollWidth,
      overflow: node.scrollWidth > node.clientWidth + 1
    }));
    results.push({ width, ...metrics });
    await dialog.getByRole("tab", { name: "Assignment" }).click();
    await expect(dialog.getByRole("tab", { name: "Assignment" })).toHaveAttribute("aria-selected", "true");
  }

  console.log(JSON.stringify(results));
  expect(results.every((row) => row.overflow === false)).toBeTruthy();
});
