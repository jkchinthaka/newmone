import { expect, test, type Page } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { authenticatedGet, authenticatedPost } from "./helpers/browser-session";
import { e2eRunId } from "./helpers/env";

const invocationStamp = `${process.pid.toString(36)}${Date.now().toString(36)}`;

function fixtureIdentity(testInfo: { project: { name: string }; workerIndex: number; retry: number }) {
  const project = testInfo.project.name.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "project";
  return `${e2eRunId()}-${project}-w${testInfo.workerIndex}-r${testInfo.retry}-${invocationStamp}`;
}

async function openListedWorkOrder(page: Page, woNumber: string) {
  const label = `Open ${woNumber.replace(/"/g, "")}`;
  await page.locator(`[aria-label="${label}"]`).locator("visible=true").click();
}
import { buildValidWorkOrderPayload } from "./helpers/work-order-payload";

test.describe("Release candidate behavior @full-stack @smoke", () => {
  test("retired splash and action center leave those screens", async ({ page }) => {
    await page.goto("/splash");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Loading your workspace...")).toHaveCount(0);

    await page.goto("/action-center");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Home" })).toHaveCount(0);

    await loginViaUi(page, "admin-a");
    await page.goto("/splash");
    await expect(page).not.toHaveURL(/\/splash$/);
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/action-center");
    await expect(page).not.toHaveURL(/\/action-center$/);
  });

  test("work order search keeps the latest text across back and forward", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    await page.goto("/work-orders");
    const search = page.getByPlaceholder("Search work orders...");
    await expect(search).toBeVisible();

    await search.fill("pump");
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("pump");
    await search.fill("pump motor");
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("pump motor");

    await page.goBack();
    await expect(page.getByPlaceholder("Search work orders...")).toHaveValue("pump");
    await page.goForward();
    await expect(page.getByPlaceholder("Search work orders...")).toHaveValue("pump motor");
  });

  test("work order overview stays view-first until edit", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const payload = await buildValidWorkOrderPayload(page, {
      title: `E2E overview ${e2eRunId()}`
    });
    const created = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(created.status()).toBe(201);
    const body = await created.json();
    const woNumber = String((body.data || body).woNumber || "");
    expect(woNumber.length).toBeGreaterThan(0);

    await page.goto(`/work-orders?q=${encodeURIComponent(woNumber)}&queue=open-requests`);
    await openListedWorkOrder(page, woNumber);
    await expect(page.getByRole("button", { name: "Edit details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit details" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  });

  test("a request action menu opens once and Escape closes it", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const assets = await authenticatedGet(page, "/api/backend/assets?page=1&limit=5");
    expect(assets.status()).toBe(200);
    const assetBody = await assets.json();
    const assetRows = Array.isArray(assetBody.data) ? assetBody.data : assetBody.data?.items ?? [];
    const assetId = String(assetRows.find((row: { id?: string }) => row.id)?.id || "");
    expect(assetId.length).toBeGreaterThan(0);
    const created = await authenticatedPost(page, "/api/backend/maintenance-requests", {
      data: {
        description: `E2E request menu ${e2eRunId()}`,
        assetId
      }
    });
    expect(created.status()).toBeGreaterThanOrEqual(200);
    expect(created.status()).toBeLessThan(300);
    const body = await created.json();
    const requestNumber = String((body.data || body).requestNumber || "");
    expect(requestNumber.length).toBeGreaterThan(0);

    await page.goto("/requests");
    const action = page.getByRole("button", { name: `Actions for ${requestNumber}` });
    await expect(action).toBeVisible();
    await action.click();
    const menu = page.getByRole("menu");
    await expect(menu).toHaveCount(1);
    const box = await menu.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThan(8);
    expect(box!.y).toBeGreaterThan(8);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("mobile navigation closes on Escape and keeps focus in the dialog", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaUi(page, "admin-a");
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(
      () => document.activeElement?.closest("[role='dialog']")?.getAttribute("aria-label")
    );
    expect(focused).toBe("Mobile navigation");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("workforce designation filter uses eligible employees from the API", async ({ page, browser }, testInfo) => {
    await loginViaUi(page, "admin-a");
    const runId = fixtureIdentity(testInfo);
    const eligibleName = `E2E Eligible ${runId}`;
    const blockedName = `E2E Blocked ${runId}`;
    const created = await authenticatedPost(page, "/api/backend/workforce/employees", {
      data: {
        fullName: eligibleName,
        employeeNo: `E2E-ELIG-${runId}`,
        designation: "ELECTRICIAN",
        availabilityStatus: "AVAILABLE",
        canReceiveWorkOrders: true,
        active: true
      }
    });
    expect(created.status()).toBeGreaterThanOrEqual(200);
    expect(created.status()).toBeLessThan(300);
    const eligible = await created.json();
    const eligibleId = String((eligible.data || eligible).id || "");
    expect(eligibleId.length).toBeGreaterThan(0);

    const blocked = await authenticatedPost(page, "/api/backend/workforce/employees", {
      data: {
        fullName: blockedName,
        employeeNo: `E2E-BLOCK-${runId}`,
        designation: "ELECTRICIAN",
        availabilityStatus: "ON_LEAVE",
        canReceiveWorkOrders: false,
        active: true
      }
    });
    expect(blocked.status()).toBeGreaterThanOrEqual(200);
    expect(blocked.status()).toBeLessThan(300);

    const listed = await authenticatedGet(
      page,
      "/api/backend/workforce/employees?designation=ELECTRICIAN"
    );
    expect(listed.status()).toBe(200);
    const rows = (await listed.json()).data || [];
    const names = (Array.isArray(rows) ? rows : []).map((row: { fullName?: string }) => row.fullName);
    expect(names).toContain(eligibleName);
    expect(names).not.toContain(blockedName);

    const payload = await buildValidWorkOrderPayload(page, { title: `E2E assign ${runId}` });
    const workOrder = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(workOrder.status()).toBe(201);
    const woNumber = String(((await workOrder.json()).data || {}).woNumber || "");
    await page.goto(`/work-orders?q=${encodeURIComponent(woNumber)}&queue=open-requests`);
    await openListedWorkOrder(page, woNumber);
    await page.getByRole("tab", { name: "Assignment" }).click();
    const filter = page.getByLabel("Filter by designation");
    await expect(filter).toBeVisible();
    await filter.selectOption("ELECTRICIAN");
    await expect(page.getByRole("option", { name: new RegExp(eligibleName) })).toHaveCount(1);
    await expect(page.getByRole("option", { name: new RegExp(blockedName) })).toHaveCount(0);
    await filter.selectOption("");
    await expect(page.getByRole("option", { name: new RegExp(eligibleName) })).toHaveCount(1);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    try {
      await loginViaUi(otherPage, "admin-b");
      const foreign = await authenticatedGet(otherPage, `/api/backend/workforce/employees/${eligibleId}`);
      expect(foreign.status()).toBe(404);
    } finally {
      await other.close();
    }
  });
});
