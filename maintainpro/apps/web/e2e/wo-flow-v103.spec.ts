import { PrismaClient } from "@prisma/client";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const password = process.env.MAINTAINPRO_SEED_PASSWORD?.trim() ?? "";
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
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

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);

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
  expect(attachmentId, JSON.stringify(created.data ?? {})).toBeTruthy();
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

test("request, assign, complete, verify, and role limits", async ({ browser }) => {
  test.skip(!password || !databaseUrl, "MAINTAINPRO_SEED_PASSWORD and DATABASE_URL are required");
  test.setTimeout(240_000);
  const stamp = Date.now();
  const prisma = new PrismaClient();
  const asset = await prisma.asset.findFirst({ select: { id: true } });
  expect(asset?.id).toBeTruthy();

  const security = await signIn(browser, "security@maintainpro.local");
  const manager = await signIn(browser, "manager@maintainpro.local");
  const tech = await signIn(browser, "tech@maintainpro.local");
  const inventory = await signIn(browser, "inventory@maintainpro.local");

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
      delayReason: "Clear leftover labour before the flow test",
      notes: "Clear leftover labour before the flow test",
      expectedVersion: openJob.data?.version
    });
    expect(held.ok(), await held.text()).toBeTruthy();
  }
  await prisma.$disconnect();

  const created = await jsonBody(
    await send(security, "post", "/api/backend/maintenance-requests", {
      description: `Gate pump leak ${stamp}`,
      assetId: asset!.id,
      reportedUrgency: "URGENT"
    })
  );
  const requestId = created.data?.id as string;
  expect(requestId).toBeTruthy();

  const review = await send(manager, "post", `/api/backend/maintenance-requests/${requestId}/start-review`, {});
  expect(review.ok(), await review.text()).toBeTruthy();
  const approvedRequest = await send(manager, "post", `/api/backend/maintenance-requests/${requestId}/approve`, {});
  expect(approvedRequest.ok(), await approvedRequest.text()).toBeTruthy();
  const converted = await jsonBody(
    await send(manager, "post", `/api/backend/maintenance-requests/${requestId}/convert-to-work-order`, {})
  );
  const workOrderId = (converted.data?.workOrderId ??
    (converted.data?.workOrder as { id?: string } | undefined)?.id ??
    converted.data?.id) as string;
  expect(workOrderId).toBeTruthy();

  const approved = await send(manager, "patch", `/api/backend/work-orders/${workOrderId}/approve`, {});
  expect([200, 400].includes(approved.status()), await approved.text()).toBeTruthy();

  const hidden = await send(tech, "get", `/api/backend/work-orders/${workOrderId}`);
  expect(hidden.status(), await hidden.text()).toBe(403);
  const beforeMine = await jsonBody(await send(tech, "get", "/api/backend/work-orders/my-jobs"));
  expect(JSON.stringify(beforeMine.data ?? {})).not.toContain(workOrderId);

  const current = await jsonBody(await send(manager, "get", `/api/backend/work-orders/${workOrderId}`));
  const assigned = await jsonBody(
    await send(manager, "post", `/api/backend/work-orders/${workOrderId}/assign`, {
      technicianId,
      expectedVersion: current.data?.version
    })
  );
  expect(assigned.data?.status ?? "ASSIGNED").toBe("ASSIGNED");

  const mine = await jsonBody(await send(tech, "get", "/api/backend/work-orders/my-jobs"));
  expect(JSON.stringify(mine.data ?? {})).toContain(workOrderId);
  const notices = await jsonBody(await send(tech, "get", "/api/backend/notifications"));
  expect(JSON.stringify(notices.data ?? {})).toContain(workOrderId);

  await tech.goto("/work-orders");
  await expect(tech.getByRole("button", { name: "Verify & close" })).toHaveCount(0);
  await expect(tech.getByRole("button", { name: "Assign technician" })).toHaveCount(0);

  const started = await jsonBody(
    await send(tech, "post", `/api/backend/work-orders/${workOrderId}/start`, {
      expectedVersion: assigned.data?.version
    })
  );
  await attachPhoto(tech, workOrderId, "BEFORE_PHOTO", "before.jpg");
  await attachPhoto(tech, workOrderId, "AFTER_PHOTO", "after.jpg");
  const scanned = await send(tech, "post", `/api/backend/work-orders/${workOrderId}/verify-qr`, {
    scannedAssetId: asset!.id
  });
  expect(scanned.ok(), await scanned.text()).toBeTruthy();
  const completed = await send(tech, "post", `/api/backend/work-orders/${workOrderId}/complete-technician`, {
    completionNote: "Leak stopped and joint replaced.",
    expectedVersion: started.data?.version
  });
  expect(completed.ok(), await completed.text()).toBeTruthy();

  const finished = await jsonBody(await send(manager, "get", `/api/backend/work-orders/${workOrderId}`));
  const verified = await jsonBody(
    await send(manager, "post", `/api/backend/work-orders/${workOrderId}/verify-supervisor`, {
      expectedVersion: finished.data?.version,
      verificationNote: "Checked on site"
    })
  );
  const closed = await send(manager, "post", `/api/backend/work-orders/${workOrderId}/close`, {
    expectedVersion: verified.data?.version,
    note: "Verified and closed"
  });
  expect(closed.ok(), await closed.text()).toBeTruthy();

  const requesterNotices = await jsonBody(await send(security, "get", "/api/backend/notifications"));
  expect(JSON.stringify(requesterNotices.data ?? {})).toContain(workOrderId);
  await security.goto("/work-orders");
  await expect(security.getByRole("button", { name: "Assign technician" })).toHaveCount(0);
  await expect(security.getByRole("button", { name: "Verify & close" })).toHaveCount(0);

  await inventory.goto("/work-orders");
  await expect(inventory.getByRole("button", { name: "Assign technician" })).toHaveCount(0);
  await expect(inventory.getByRole("button", { name: "Start job" })).toHaveCount(0);

  await new Promise((resolve) => setTimeout(resolve, 61_000));
  const admin = await signIn(browser, "admin@maintainpro.local");
  const superadmin = await signIn(browser, "superadmin@maintainpro.local");
  const adminMe = await jsonBody(await send(admin, "get", "/api/backend/auth/me"));
  const superMe = await jsonBody(await send(superadmin, "get", "/api/backend/auth/me"));
  expect(JSON.stringify(adminMe.data ?? {})).toContain("ADMIN");
  expect(JSON.stringify(superMe.data ?? {})).toContain("SUPER_ADMIN");
  const adminRead = await send(admin, "get", `/api/backend/work-orders/${workOrderId}`);
  const superRead = await send(superadmin, "get", `/api/backend/work-orders/${workOrderId}`);
  expect(adminRead.ok(), await adminRead.text()).toBeTruthy();
  expect(superRead.ok(), await superRead.text()).toBeTruthy();
});
