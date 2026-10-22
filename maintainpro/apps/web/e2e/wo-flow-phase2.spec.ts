import { PrismaClient } from "@prisma/client";
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";

const password = process.env.MAINTAINPRO_SEED_PASSWORD?.trim() ?? "";
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Runs once on desktop Chromium.");
  test.skip(!password || !databaseUrl, "MAINTAINPRO_SEED_PASSWORD and DATABASE_URL are required");
});

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  } catch {
    const limited = await page.getByText(/too many|try again|rate/i).first().isVisible().catch(() => false);
    if (!limited) {
      const notice = await page.locator("body").innerText();
      throw new Error(`Sign in stayed on the login page: ${notice.replace(/\s+/g, " ").slice(0, 240)}`);
    }
    await page.waitForTimeout(65_000);
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  }
  return page;
}

async function csrfHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const token = cookies.find((cookie) => cookie.name === "maintainpro_csrf")?.value ?? "";
  return token ? { "x-csrf-token": token } : {};
}

async function jsonBody(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  return JSON.parse(text) as { data?: Record<string, unknown> };
}

async function send(page: Page, method: "get" | "post" | "patch", path: string, data?: unknown) {
  return page.request[method](path, { headers: await csrfHeaders(page), data });
}

function record(body: { data?: Record<string, unknown> }) {
  return body.data ?? {};
}

function localDateTime(offsetMinutes: number) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function pendingWorkOrder(manager: Page, assetId: string, stamp: string) {
  const me = await jsonBody(await send(manager, "get", "/api/backend/auth/me"));
  const createdById = (me.data?.id ?? (me.data?.user as { id?: string } | undefined)?.id) as string;
  expect(createdById).toBeTruthy();
  const created = await jsonBody(
    await send(manager, "post", "/api/backend/work-orders", {
      title: `Phase 2 dialog ${stamp}`,
      description: `Pending approval dialog ${stamp}`,
      priority: "MEDIUM",
      type: "CORRECTIVE",
      assetId,
      createdById,
      requiresApproval: true
    })
  );
  const workOrderId = created.data?.id as string;
  expect(workOrderId).toBeTruthy();
  const current = await jsonBody(await send(manager, "get", `/api/backend/work-orders/${workOrderId}`));
  const row = record(current);
  expect(row.approvalStatus).toBe("PENDING");
  expect(row.status).toBe("OPEN");
  return { id: workOrderId, woNumber: String(row.woNumber) };
}

async function listRow(page: Page, woNumber: string) {
  await page.goto("/work-orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByPlaceholder("Search by title or WO number").fill(woNumber);
  const row = page.locator("tbody tr").filter({ hasText: woNumber });
  await expect(row).toBeVisible({ timeout: 20_000 });
  return row;
}

async function fillApproveAssign(dialog: Locator, technicianId: string) {
  await dialog.locator("select").selectOption(technicianId);
  await dialog.locator('input[type="datetime-local"]').nth(0).fill(localDateTime(60));
  await dialog.locator('input[type="datetime-local"]').nth(1).fill(localDateTime(180));
}

async function attachPhoto(page: Page, workOrderId: string, evidenceType: "BEFORE_PHOTO" | "AFTER_PHOTO", fileName: string) {
  const created = await jsonBody(
    await send(page, "post", `/api/backend/work-orders/${workOrderId}/evidence`, {
      evidenceType,
      fileName,
      mimeType: "image/jpeg",
      sizeBytes: jpeg.length
    })
  );
  const attachmentId = created.data?.attachmentId as string;
  expect(attachmentId).toBeTruthy();
  const stored = await page.request.post(`/api/backend/work-orders/${workOrderId}/evidence/${attachmentId}/content`, {
    headers: { ...(await csrfHeaders(page)), "content-type": "application/octet-stream" },
    data: jpeg
  });
  expect(stored.ok(), await stored.text()).toBeTruthy();
  const confirmed = await jsonBody(
    await send(page, "post", `/api/backend/work-orders/${workOrderId}/evidence/confirm`, { attachmentId })
  );
  expect(confirmed.data?.status ?? confirmed.data?.ok).toBeTruthy();
}

test("approve and assign from one dialog, keep approval when assign fails, and verify and close", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const prisma = new PrismaClient();
  const asset = await prisma.asset.findFirst({ select: { id: true } });
  expect(asset?.id).toBeTruthy();

  const manager = await signIn(browser, "manager@maintainpro.local");
  const admin = await signIn(browser, "admin@maintainpro.local");
  const tech = await signIn(browser, "tech@maintainpro.local");

  const me = await jsonBody(await send(tech, "get", "/api/backend/auth/me"));
  const technicianId = (me.data?.id ?? (me.data?.user as { id?: string } | undefined)?.id) as string;
  expect(technicianId).toBeTruthy();
  const openLabour = await prisma.workOrderLabourEntry.findMany({
    where: { technicianUserId: technicianId, endedAt: null },
    select: { workOrderId: true }
  });
  for (const row of openLabour) {
    const openJob = await jsonBody(await send(tech, "get", `/api/backend/work-orders/${row.workOrderId}`));
    const held = await send(tech, "post", `/api/backend/work-orders/${row.workOrderId}/hold`, {
      holdReasonCode: "OTHER",
      delayReason: "Clear leftover labour before the phase 2 dialog test",
      notes: "Clear leftover labour before the phase 2 dialog test",
      expectedVersion: openJob.data?.version
    });
    expect(held.ok(), await held.text()).toBeTruthy();
  }
  await prisma.$disconnect();

  const pending = await pendingWorkOrder(manager, asset!.id, `${stamp}-ok`);
  const row = await listRow(admin, pending.woNumber);
  await expect(pageDialogs(admin)).toHaveCount(0);
  await row.getByRole("button", { name: "Approve & assign" }).click();
  const dialog = admin.getByRole("dialog", { name: "Approve and assign" });
  await expect(dialog).toBeVisible();
  await expect(pageDialogs(admin)).toHaveCount(1);
  await expect(dialog.getByRole("heading", { name: "Approve & assign" })).toBeVisible();
  await fillApproveAssign(dialog, technicianId);
  await dialog.getByRole("button", { name: "Approve & assign" }).click();
  await expect(admin.getByText(`${pending.woNumber} approved and assigned`)).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toBeHidden();
  const assigned = record(await jsonBody(await send(admin, "get", `/api/backend/work-orders/${pending.id}`)));
  expect(assigned.approvalStatus).toBe("APPROVED");
  expect(assigned.status).toBe("ASSIGNED");
  expect(assigned.technicianId).toBe(technicianId);

  const blocked = await pendingWorkOrder(manager, asset!.id, `${stamp}-fail`);
  await admin.route(`**/work-orders/${blocked.id}/assign`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: { message: "Technician unavailable" } })
    });
  });
  const blockedRow = await listRow(admin, blocked.woNumber);
  await blockedRow.getByRole("button", { name: "Approve & assign" }).click();
  const failureDialog = admin.getByRole("dialog", { name: "Approve and assign" });
  await expect(pageDialogs(admin)).toHaveCount(1);
  await fillApproveAssign(failureDialog, technicianId);
  await failureDialog.getByRole("button", { name: "Approve & assign" }).click();
  await expect(admin.getByText("Technician unavailable The work order stays approved.")).toBeVisible({
    timeout: 20_000
  });
  await expect(failureDialog).toBeHidden();
  const kept = record(await jsonBody(await send(admin, "get", `/api/backend/work-orders/${blocked.id}`)));
  expect(kept.approvalStatus).toBe("APPROVED");
  expect(kept.status).toBe("OPEN");
  expect(kept.technicianId ?? null).toBeNull();
  await admin.unroute(`**/work-orders/${blocked.id}/assign`);

  const ready = await pendingWorkOrder(manager, asset!.id, `${stamp}-close`);
  const approved = await send(admin, "patch", `/api/backend/work-orders/${ready.id}/approve`, {});
  expect(approved.ok(), await approved.text()).toBeTruthy();
  const approvedBody = record(await jsonBody(await send(manager, "get", `/api/backend/work-orders/${ready.id}`)));
  const assignedJob = await jsonBody(
    await send(manager, "post", `/api/backend/work-orders/${ready.id}/assign`, {
      technicianId,
      expectedVersion: approvedBody.version
    })
  );
  expect(record(assignedJob).status).toBe("ASSIGNED");
  const started = await jsonBody(
    await send(tech, "post", `/api/backend/work-orders/${ready.id}/start`, {
      expectedVersion: record(assignedJob).version
    })
  );
  await attachPhoto(tech, ready.id, "BEFORE_PHOTO", "before.jpg");
  await attachPhoto(tech, ready.id, "AFTER_PHOTO", "after.jpg");
  const scanned = await send(tech, "post", `/api/backend/work-orders/${ready.id}/verify-qr`, {
    scannedAssetId: asset!.id
  });
  expect(scanned.ok(), await scanned.text()).toBeTruthy();
  const completed = await send(tech, "post", `/api/backend/work-orders/${ready.id}/complete-technician`, {
    completionNote: "Leak stopped and joint replaced.",
    expectedVersion: record(started).version
  });
  expect(completed.ok(), await completed.text()).toBeTruthy();

  const verifyRow = await listRow(manager, ready.woNumber);
  await verifyRow.getByRole("button", { name: "Verify & close" }).click();
  await expect(manager.getByText(`${ready.woNumber} verified and closed`)).toBeVisible({ timeout: 20_000 });
  const closed = record(await jsonBody(await send(manager, "get", `/api/backend/work-orders/${ready.id}`)));
  expect(closed.status).toBe("CLOSED");

  await Promise.all([manager, admin, tech].map((page) => page.context().close()));
});

function pageDialogs(page: Page) {
  return page.getByRole("dialog");
}
