import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const password = process.env.MAINTAINPRO_SEED_PASSWORD?.trim() ?? "";
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function jsonBody(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  return JSON.parse(text) as { data?: Record<string, unknown> };
}

test("request, assign, complete, verify, and role limits", async ({ page }) => {
  test.skip(!password || !databaseUrl, "MAINTAINPRO_SEED_PASSWORD and DATABASE_URL are required");
  test.setTimeout(180_000);
  const stamp = Date.now();

  await signIn(page, "security@maintainpro.local");
  const created = await jsonBody(
    await page.request.post("/api/backend/maintenance-requests", {
      data: {
        description: `Gate pump leak ${stamp}`,
        targetUnresolved: true,
        approximateLocation: "Gate house",
        reportedUrgency: "MEDIUM"
      }
    })
  );
  const requestId = created.data?.id as string;
  expect(requestId).toBeTruthy();

  await signIn(page, "manager@maintainpro.local");
  const approvedRequest = await page.request.post(`/api/backend/maintenance-requests/${requestId}/approve`, { data: {} });
  expect(approvedRequest.ok() || approvedRequest.status() === 400, await approvedRequest.text()).toBeTruthy();
  const converted = await jsonBody(
    await page.request.post(`/api/backend/maintenance-requests/${requestId}/convert-to-work-order`, { data: {} })
  );
  const workOrderId = (converted.data?.workOrderId ??
    (converted.data?.workOrder as { id?: string } | undefined)?.id ??
    converted.data?.id) as string;
  expect(workOrderId).toBeTruthy();

  const approved = await page.request.patch(`/api/backend/work-orders/${workOrderId}/approve`, { data: {} });
  expect([200, 400].includes(approved.status()), await approved.text()).toBeTruthy();

  await signIn(page, "tech@maintainpro.local");
  const me = await jsonBody(await page.request.get("/api/backend/auth/me"));
  const technicianId = (me.data?.id ?? (me.data?.user as { id?: string } | undefined)?.id) as string;
  expect(technicianId).toBeTruthy();

  await signIn(page, "manager@maintainpro.local");
  const current = await jsonBody(await page.request.get(`/api/backend/work-orders/${workOrderId}`));
  const version = current.data?.version as number | undefined;
  const assigned = await jsonBody(
    await page.request.post(`/api/backend/work-orders/${workOrderId}/assign`, {
      data: { technicianId, expectedVersion: version }
    })
  );
  expect(assigned.data?.status ?? "ASSIGNED").toBe("ASSIGNED");

  await signIn(page, "tech@maintainpro.local");
  const mine = await jsonBody(await page.request.get("/api/backend/work-orders/my-jobs"));
  const mineText = JSON.stringify(mine.data ?? {});
  expect(mineText).toContain(workOrderId);
  const notices = await jsonBody(await page.request.get("/api/backend/notifications"));
  expect(JSON.stringify(notices.data ?? {})).toContain(workOrderId);

  await page.goto("/work-orders");
  await expect(page.getByRole("button", { name: "Verify & close" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);

  const started = await jsonBody(
    await page.request.post(`/api/backend/work-orders/${workOrderId}/start`, { data: {} })
  );
  const startedVersion = started.data?.version as number | undefined;
  await page.request.post(`/api/backend/work-orders/${workOrderId}/evidence`, {
    data: { evidenceType: "BEFORE_PHOTO", fileName: "before.jpg", mimeType: "image/jpeg", sizeBytes: 128 }
  });
  await page.request.post(`/api/backend/work-orders/${workOrderId}/evidence`, {
    data: { evidenceType: "AFTER_PHOTO", fileName: "after.jpg", mimeType: "image/jpeg", sizeBytes: 128 }
  });
  const completed = await page.request.post(`/api/backend/work-orders/${workOrderId}/complete-technician`, {
    data: { completionNote: "Leak stopped and joint replaced.", expectedVersion: startedVersion }
  });
  expect(completed.ok(), await completed.text()).toBeTruthy();

  await signIn(page, "manager@maintainpro.local");
  const finished = await jsonBody(await page.request.get(`/api/backend/work-orders/${workOrderId}`));
  const verified = await jsonBody(
    await page.request.post(`/api/backend/work-orders/${workOrderId}/verify-supervisor`, {
      data: { expectedVersion: finished.data?.version, verificationNote: "Checked on site" }
    })
  );
  const closed = await page.request.post(`/api/backend/work-orders/${workOrderId}/close`, {
    data: { expectedVersion: verified.data?.version, note: "Verified and closed" }
  });
  expect(closed.ok(), await closed.text()).toBeTruthy();

  await signIn(page, "security@maintainpro.local");
  const requesterNotices = await jsonBody(await page.request.get("/api/backend/notifications"));
  expect(JSON.stringify(requesterNotices.data ?? {})).toContain(workOrderId);
  await page.goto("/work-orders");
  await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verify & close" })).toHaveCount(0);

  await signIn(page, "inventory@maintainpro.local");
  await page.goto("/work-orders");
  await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start job" })).toHaveCount(0);
});
