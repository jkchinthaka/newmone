import { expect, test } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { authenticatedPost } from "./helpers/browser-session";
import { buildValidWorkOrderPayload } from "./helpers/work-order-payload";

test.describe("Block D screen smoke @full-stack @smoke", () => {
  test("create work order shows the due date field", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    await page.goto("/work-orders");
    await page.getByRole("button", { name: "Create job" }).click();
    await page.getByRole("button", { name: "Machinery" }).click();
    await page.getByRole("button", { name: "More options" }).click();
    await expect(page.getByRole("textbox", { name: "Due date" })).toBeVisible();
  });

  test("maintenance config stores the default tax rate at 18", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    await page.goto("/admin/maintenance-config");
    const field = page.getByLabel("Default tax rate %");
    await expect(field).toBeVisible();
    await expect(field).toHaveValue(/18/);
  });

  test("work order evidence card shows the photo upload", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const payload = await buildValidWorkOrderPayload(page, { title: "E2E evidence smoke" });
    const created = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(created.status()).toBe(201);
    const body = (await created.json()) as { data?: { id?: string }; id?: string };
    const id = body.data?.id ?? body.id;
    expect(id).toBeTruthy();
    await page.goto(`/maintenance/jobs?wo=${id}&tab=evidence`);
    await expect(page.getByText("Photos & field proof")).toBeVisible();
    await expect(page.locator("input[type=file]").first()).toBeAttached();
  });

  test("approvals inbox opens", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    await page.goto("/approvals");
    await expect(page.getByRole("heading", { name: "Pending Approvals" })).toBeVisible();
  });

  test("meter readings page opens", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    await page.goto("/utilities/readings");
    await expect(page.getByRole("heading", { name: "Meter Readings" })).toBeVisible();
  });

  test("admin users page shows access status", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    await page.goto("/admin/users");
    await expect(page.getByText("access status")).toBeVisible();
  });
});
