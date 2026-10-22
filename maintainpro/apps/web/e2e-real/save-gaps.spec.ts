import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type APIResponse, type Browser, type Page } from "@playwright/test";

import { getCsrfHeader } from "./helpers/browser-session";
import { authDir } from "./save-gaps-auth";

const managerState = path.join(authDir, "manager.json");
const technicianState = path.join(authDir, "technician.json");
const adminState = path.join(authDir, "admin.json");
const inventoryState = path.join(authDir, "inventory.json");

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64"
);

function stamp() {
  return `SG${Date.now().toString(36).toUpperCase()}`;
}

function sqlCount(table: string, filters: Record<string, string>) {
  if (!/^[A-Za-z]+$/.test(table)) throw new Error("Refusing an unexpected SQL table");
  const clauses = Object.entries(filters).map(([column, value]) => {
    if (!/^[A-Za-z]+$/.test(column)) throw new Error("Refusing an unexpected SQL column");
    if (!/^[A-Za-z0-9@._% -]+$/.test(value)) throw new Error("Refusing an unexpected SQL value");
    return `[${column}] = N'${value.replaceAll("'", "''")}'`;
  });
  const query = `SET NOCOUNT ON; SELECT COUNT(*) FROM [${table}] WHERE ${clauses.join(" AND ")}`;
  const output = execFileSync(
    "sqlcmd",
    ["-S", "localhost", "-E", "-C", "-d", "maintainpro_e2e_wo_verify", "-h", "-1", "-W", "-Q", query],
    { encoding: "utf8" }
  );
  const count = Number(output.trim().split(/\r?\n/).filter(Boolean).at(-1));
  if (!Number.isFinite(count)) throw new Error(`SQL count was not a number for ${table}`);
  return count;
}

function sqlCountContaining(table: string, column: string, value: string) {
  if (!/^[A-Za-z]+$/.test(table) || !/^[A-Za-z]+$/.test(column) || !/^[A-Za-z0-9]+$/.test(value)) {
    throw new Error("Refusing an unexpected SQL lookup");
  }
  const query = `SET NOCOUNT ON; SELECT COUNT(*) FROM [${table}] WHERE [${column}] LIKE N'%${value}%'`;
  const output = execFileSync(
    "sqlcmd",
    ["-S", "localhost", "-E", "-C", "-d", "maintainpro_e2e_wo_verify", "-h", "-1", "-W", "-Q", query],
    { encoding: "utf8" }
  );
  const count = Number(output.trim().split(/\r?\n/).filter(Boolean).at(-1));
  if (!Number.isFinite(count)) throw new Error(`SQL count was not a number for ${table}`);
  return count;
}

function sqlInt(table: string, column: string, id: string) {
  if (!/^[A-Za-z]+$/.test(table) || !/^[A-Za-z]+$/.test(column) || !/^[A-Za-z0-9]+$/.test(id)) {
    throw new Error("Refusing an unexpected SQL lookup");
  }
  const query = `SET NOCOUNT ON; SELECT [${column}] FROM [${table}] WHERE [id] = N'${id}'`;
  const output = execFileSync(
    "sqlcmd",
    ["-S", "localhost", "-E", "-C", "-d", "maintainpro_e2e_wo_verify", "-h", "-1", "-W", "-Q", query],
    { encoding: "utf8" }
  );
  return Number(output.trim().split(/\r?\n/).filter(Boolean).at(-1));
}

async function bodyOf(response: APIResponse) {
  return response.json().catch(() => ({}));
}

function rowsOf(payload: { data?: unknown }) {
  const data = payload.data as { items?: unknown[]; data?: unknown[] } | unknown[] | undefined;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function idOf(payload: { data?: { id?: string }; id?: string }) {
  return String(payload.data?.id || payload.id || "");
}

async function post(page: Page, url: string, data: unknown) {
  return page.request.post(url, { data, headers: await getCsrfHeader(page) });
}

async function patch(page: Page, url: string, data: unknown) {
  return page.request.patch(url, { data, headers: await getCsrfHeader(page) });
}

async function showAfterReload(page: Page, url: string, value: string, searchPlaceholder?: string) {
  await page.goto(url);
  await page.reload();
  if (searchPlaceholder) {
    await page.getByPlaceholder(searchPlaceholder).fill(value);
  }
  await expect(page.getByText(value, { exact: false }).filter({ visible: true }).first()).toBeVisible();
}

async function assetAndMe(page: Page) {
  const me = await page.request.get("/api/backend/auth/me");
  expect(me.status()).toBe(200);
  const meBody = await bodyOf(me);
  const createdById = String(meBody.data?.id || "");
  const assets = await page.request.get("/api/backend/assets?page=1&limit=20");
  expect(assets.status()).toBe(200);
  const assetPayload = await bodyOf(assets);
  const assetRows = rowsOf(assetPayload) as Array<{ id?: string; name?: string }>;
  const asset = assetRows.find((row) => /colombo/i.test(String(row.name || ""))) || assetRows[0];
  expect(asset?.id, `asset list ${JSON.stringify(assetPayload).slice(0, 240)}`).toBeTruthy();
  return { createdById, assetId: String(asset?.id) };
}

async function createWorkOrder(page: Page, title: string, requiresApproval = false) {
  const { createdById, assetId } = await assetAndMe(page);
  const created = await post(page, "/api/backend/work-orders", {
    title,
    description: `${title} Colombo pump`,
    priority: "MEDIUM",
    type: "CORRECTIVE",
    createdById,
    assetId,
    requiresApproval
  });
  expect(created.status(), await created.text()).toBeLessThan(300);
  const id = idOf(await bodyOf(created));
  expect(id).toMatch(/^[a-z0-9]+$/i);
  return id;
}

async function technicianProfile(browser: Browser) {
  const context = await browser.newContext({ storageState: technicianState });
  const page = await context.newPage();
  const me = await bodyOf(await page.request.get("/api/backend/auth/me"));
  await context.close();
  const data = (me.data || {}) as { id?: string; firstName?: string; lastName?: string };
  const name = `${data.firstName || ""} ${data.lastName || ""}`.trim();
  return { id: String(data.id || ""), name: name || "tech@maintainpro.local" };
}

async function planAndAssign(page: Page, id: string, technicianId: string) {
  const plannedStartAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const plan = await post(page, `/api/backend/work-orders/${id}/plan`, { plannedStartAt, estimatedHours: 1 });
  expect(plan.status(), await plan.text()).toBeLessThan(300);
  const assigned = await post(page, `/api/backend/work-orders/${id}/assign`, { technicianId });
  expect(assigned.status(), await assigned.text()).toBeLessThan(300);
}

function jobUrl(id: string) {
  return `/maintenance/jobs?wo=${id}`;
}

async function expectOk(response: APIResponse, label: string) {
  const detail = response.status() >= 300 ? (await response.text()).slice(0, 300) : "";
  expect(response.status(), `${label} ${detail}`).toBeLessThan(300);
}

async function startJob(page: Page, id: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await post(page, `/api/backend/work-orders/${id}/start`, {
      expectedVersion: await workOrderVersion(page, id)
    });
    if (response.status() < 300) return;
    const detail = (await response.text()).slice(0, 400);
    const blocking = detail.match(/work order \(([a-z0-9]+)\)/i)?.[1];
    if (response.status() === 409 && blocking && blocking !== id) {
      const held = await post(page, `/api/backend/work-orders/${blocking}/hold`, {
        holdReasonCode: "OTHER",
        notes: "release save-gap session",
        expectedVersion: await workOrderVersion(page, blocking)
      });
      if (held.status() < 300) continue;
    }
    expect(response.status(), `start ${detail}`).toBeLessThan(300);
  }
}

async function workOrderVersion(page: Page, id: string) {
  const response = await page.request.get(`/api/backend/work-orders/${id}`);
  const payload = await bodyOf(response);
  const row = (payload.data || payload) as { version?: number };
  return Number(row.version || 0);
}

async function uploadPhoto(page: Page, workOrderId: string, evidenceType: "BEFORE_PHOTO" | "AFTER_PHOTO") {
  const fileName = evidenceType === "BEFORE_PHOTO" ? "before-photo.jpg" : "after-photo.jpg";
  const requested = await post(page, `/api/backend/work-orders/${workOrderId}/evidence/upload-request`, {
    fileName,
    mimeType: "image/jpeg",
    sizeBytes: TINY_JPEG.length,
    evidenceType
  });
  expect(requested.status(), await requested.text()).toBeLessThan(300);
  const requestedBody = await bodyOf(requested);
  expect(requestedBody.data?.ok === false || requestedBody.data?.status === "misconfigured", "photo storage").toBeFalsy();
  const evidenceId = String(requestedBody.data?.attachmentId || requestedBody.data?.attachment?.id || requestedBody.data?.id || "");
  expect(evidenceId).toMatch(/^[a-z0-9]+$/i);
  const stored = await page.request.post(`/api/backend/work-orders/${workOrderId}/evidence/${evidenceId}/content`, {
    headers: { ...(await getCsrfHeader(page)), "content-type": "image/jpeg" },
    data: TINY_JPEG
  });
  expect(stored.status(), await stored.text()).toBeLessThan(300);
  const confirmed = await post(page, `/api/backend/work-orders/${workOrderId}/evidence/confirm`, { attachmentId: evidenceId });
  expect(confirmed.status(), await confirmed.text()).toBeLessThan(300);
  return fileName;
}

test.describe("save gaps", () => {
  test("1 create work order survives reload and a second submit", async ({ browser }) => {
    const title = stamp();
    const context = await browser.newContext({ storageState: managerState });
    const page = await context.newPage();
    const id = await createWorkOrder(page, title);
    await showAfterReload(page, jobUrl(id), title);
    expect(sqlCount("WorkOrder", { title })).toBe(1);
    await createWorkOrder(page, title);
    expect(sqlCount("WorkOrder", { title })).toBe(1);
    await context.close();
  });

  test("2 assign survives reload and a second submit", async ({ browser }) => {
    const title = stamp();
    const tech = await technicianProfile(browser);
    const context = await browser.newContext({ storageState: managerState });
    const page = await context.newPage();
    const id = await createWorkOrder(page, title);
    await planAndAssign(page, id, tech.id);
    await showAfterReload(page, jobUrl(id), tech.name);
    expect(sqlCount("WorkOrderAssignee", { workOrderId: id })).toBe(1);
    await post(page, `/api/backend/work-orders/${id}/assign`, { technicianId: tech.id });
    expect(sqlCount("WorkOrderAssignee", { workOrderId: id })).toBe(1);
    await context.close();
  });

  test("3 start hold resume survives reload and a second resume", async ({ browser }) => {
    const title = stamp();
    const tech = await technicianProfile(browser);
    const manager = await browser.newContext({ storageState: managerState });
    const managerPage = await manager.newPage();
    const id = await createWorkOrder(managerPage, title);
    await planAndAssign(managerPage, id, tech.id);
    await manager.close();
    const context = await browser.newContext({ storageState: technicianState });
    const page = await context.newPage();
    await startJob(page, id);
    expect((await post(page, `/api/backend/work-orders/${id}/hold`, { holdReasonCode: "OTHER", notes: title, expectedVersion: await workOrderVersion(page, id) })).status()).toBeLessThan(300);
    const resumed = await post(page, `/api/backend/work-orders/${id}/resume`, { expectedVersion: await workOrderVersion(page, id) });
    expect(resumed.status(), await resumed.text()).toBeLessThan(300);
    await showAfterReload(page, jobUrl(id), "In Progress");
    expect(sqlCount("WorkOrderStatusHistory", { workOrderId: id, action: "ON_HOLD" })).toBe(1);
    expect(sqlCount("WorkOrderStatusHistory", { workOrderId: id, action: "RESUMED" })).toBe(1);
    await post(page, `/api/backend/work-orders/${id}/resume`, { expectedVersion: await workOrderVersion(page, id) });
    expect(sqlCount("WorkOrderStatusHistory", { workOrderId: id, action: "RESUMED" })).toBe(1);
    await context.close();
  });

  test("4 before and after photos survive reload and a second upload", async ({ browser }) => {
    test.setTimeout(120_000);
    const title = stamp();
    const tech = await technicianProfile(browser);
    const manager = await browser.newContext({ storageState: managerState });
    const managerPage = await manager.newPage();
    const id = await createWorkOrder(managerPage, title);
    await planAndAssign(managerPage, id, tech.id);
    await manager.close();
    const context = await browser.newContext({ storageState: technicianState });
    const page = await context.newPage();
    await startJob(page, id);
    const beforeName = await uploadPhoto(page, id, "BEFORE_PHOTO");
    const afterName = await uploadPhoto(page, id, "AFTER_PHOTO");
    const completed = await post(page, `/api/backend/work-orders/${id}/complete-technician`, {
      completionNote: title,
      expectedVersion: await workOrderVersion(page, id)
    });
    expect(completed.status(), await completed.text()).toBeLessThan(300);
    await showAfterReload(page, jobUrl(id), "Completed");
    expect(sqlCount("EvidenceAttachment", { workOrderId: id, fileName: beforeName })).toBe(1);
    expect(sqlCount("EvidenceAttachment", { workOrderId: id, fileName: afterName })).toBe(1);
    await uploadPhoto(page, id, "AFTER_PHOTO");
    expect(sqlCount("EvidenceAttachment", { workOrderId: id, fileName: afterName })).toBe(1);
    await context.close();
  });

  test("5 verify and close survives reload and a second close", async ({ browser }) => {
    test.setTimeout(120_000);
    const title = stamp();
    const tech = await technicianProfile(browser);
    const manager = await browser.newContext({ storageState: managerState });
    const managerPage = await manager.newPage();
    const id = await createWorkOrder(managerPage, title);
    await planAndAssign(managerPage, id, tech.id);
    const techContext = await browser.newContext({ storageState: technicianState });
    const techPage = await techContext.newPage();
    await startJob(techPage, id);
    await uploadPhoto(techPage, id, "BEFORE_PHOTO");
    await uploadPhoto(techPage, id, "AFTER_PHOTO");
    expect((await post(techPage, `/api/backend/work-orders/${id}/complete-technician`, { completionNote: title, expectedVersion: await workOrderVersion(techPage, id) })).status()).toBeLessThan(300);
    await techContext.close();
    const verified = await post(managerPage, `/api/backend/work-orders/${id}/verify-supervisor`, {
      verificationNote: title,
      expectedVersion: await workOrderVersion(managerPage, id)
    });
    expect(verified.status(), await verified.text()).toBeLessThan(300);
    const closed = await post(managerPage, `/api/backend/work-orders/${id}/close`, {
      note: title,
      expectedVersion: await workOrderVersion(managerPage, id)
    });
    expect(closed.status(), await closed.text()).toBeLessThan(300);
    await showAfterReload(managerPage, jobUrl(id), "Closed");
    expect(sqlCount("WorkOrder", { id })).toBe(1);
    await post(managerPage, `/api/backend/work-orders/${id}/close`, { note: title, expectedVersion: await workOrderVersion(managerPage, id) });
    expect(sqlCount("WorkOrder", { id, status: "CLOSED" })).toBe(1);
    await manager.close();
  });

  test("6 cancel keeps one cancelled row and the reason", async ({ browser }) => {
    const title = stamp();
    const reason = `Cancel ${title}`;
    const context = await browser.newContext({ storageState: managerState });
    const page = await context.newPage();
    const id = await createWorkOrder(page, title);
    const cancelled = await patch(page, `/api/backend/work-orders/${id}/status`, {
      status: "CANCELLED",
      cancelReason: reason,
      expectedVersion: await workOrderVersion(page, id)
    });
    expect(cancelled.status(), await cancelled.text()).toBeLessThan(300);
    await showAfterReload(page, `${jobUrl(id)}&tab=audit`, reason);
    expect(sqlCount("WorkOrder", { id, status: "CANCELLED" })).toBe(1);
    await patch(page, `/api/backend/work-orders/${id}/status`, { status: "CANCELLED", cancelReason: reason });
    expect(sqlCount("WorkOrder", { id, status: "CANCELLED" })).toBe(1);
    await context.close();
  });

  test("7 approve one and reject another", async ({ browser }) => {
    const approvedTitle = `${stamp()}A`;
    const rejectedTitle = `${stamp()}B`;
    const reason = `Reject ${rejectedTitle}`;
    const context = await browser.newContext({ storageState: adminState });
    const page = await context.newPage();
    const approvedId = await createWorkOrder(page, approvedTitle, true);
    const rejectedId = await createWorkOrder(page, rejectedTitle, true);
    expect((await post(page, `/api/backend/work-orders/${approvedId}/submit-for-approval`, { notes: approvedTitle })).status()).toBeLessThan(300);
    expect((await post(page, `/api/backend/work-orders/${rejectedId}/submit-for-approval`, { notes: rejectedTitle })).status()).toBeLessThan(300);
    const inbox = await page.request.get("/api/backend/approvals/inbox?page=1&pageSize=50");
    expect(inbox.status()).toBe(200);
    const items = rowsOf(await bodyOf(inbox)) as Array<{ id?: string; title?: string; kind?: string; version?: number; workOrderId?: string }>;
    const approvedItem = items.find((item) => item.workOrderId === approvedId || item.title === approvedTitle);
    const rejectedItem = items.find((item) => item.workOrderId === rejectedId || item.title === rejectedTitle);
    expect(approvedItem?.id, "pending approval").toBeTruthy();
    expect(rejectedItem?.id, "pending rejection").toBeTruthy();
    const approved = await post(page, "/api/backend/approvals/inbox/decide", {
      id: approvedItem?.id,
      kind: approvedItem?.kind || "work_order",
      decision: "APPROVED",
      expectedVersion: approvedItem?.version || 0,
      workOrderId: approvedId
    });
    const rejected = await post(page, "/api/backend/approvals/inbox/decide", {
      id: rejectedItem?.id,
      kind: rejectedItem?.kind || "work_order",
      decision: "REJECTED",
      reason,
      expectedVersion: rejectedItem?.version || 0,
      workOrderId: rejectedId
    });
    expect(approved.status(), await approved.text()).toBeLessThan(300);
    expect(rejected.status(), await rejected.text()).toBeLessThan(300);
    await showAfterReload(page, jobUrl(approvedId), "Approved");
    await showAfterReload(page, jobUrl(rejectedId), reason);
    expect(sqlCount("WorkOrder", { id: approvedId })).toBe(1);
    expect(sqlCount("WorkOrder", { id: rejectedId })).toBe(1);
    await post(page, "/api/backend/approvals/inbox/decide", {
      id: approvedItem?.id,
      kind: approvedItem?.kind || "work_order",
      decision: "APPROVED",
      expectedVersion: approvedItem?.version || 0,
      workOrderId: approvedId
    });
    await post(page, "/api/backend/approvals/inbox/decide", {
      id: rejectedItem?.id,
      kind: rejectedItem?.kind || "work_order",
      decision: "REJECTED",
      reason,
      expectedVersion: rejectedItem?.version || 0,
      workOrderId: rejectedId
    });
    expect(sqlCount("WorkOrder", { id: approvedId })).toBe(1);
    expect(sqlCount("WorkOrder", { id: rejectedId })).toBe(1);
    await context.close();
  });

  test("8 part request and issue stay one row", async ({ browser }) => {
    const title = stamp();
    const manager = await browser.newContext({ storageState: managerState });
    const managerPage = await manager.newPage();
    const id = await createWorkOrder(managerPage, title);
    const parts = await managerPage.request.get("/api/backend/inventory/parts?page=1&limit=20");
    expect(parts.status()).toBe(200);
    const partList = rowsOf(await bodyOf(parts)) as Array<{ id?: string; quantityInStock?: number }>;
    const part = partList.find((row) => Number(row.quantityInStock) > 0) || partList[0];
    expect(part?.id, "seeded part").toBeTruthy();
    const stockBefore = sqlInt("SparePart", "quantityInStock", String(part?.id));
    const techProfile = await technicianProfile(browser);
    await planAndAssign(managerPage, id, techProfile.id);
    await manager.close();
    const tech = await browser.newContext({ storageState: technicianState });
    const techPage = await tech.newPage();
    const requested = await post(techPage, `/api/backend/work-orders/${id}/part-requests`, {
      partId: part?.id,
      quantity: 1,
      reason: title
    });
    expect(requested.status(), await requested.text()).toBeLessThan(300);
    const requestId = idOf(await bodyOf(requested));
    expect(requestId).toMatch(/^[a-z0-9]+$/i);
    await showAfterReload(techPage, jobUrl(id), title);
    expect(sqlCount("PartRequest", { id: requestId })).toBe(1);
    await post(techPage, `/api/backend/work-orders/${id}/part-requests`, { partId: part?.id, quantity: 1, reason: title });
    expect(sqlCount("PartRequest", { reason: title })).toBe(1);
    const approver = await browser.newContext({ storageState: managerState });
    const approverPage = await approver.newPage();
    const approved = await patch(approverPage, `/api/backend/work-orders/${id}/part-requests/${requestId}/approve-operational`, {
      approvedQuantity: 1,
      reason: title
    });
    await expectOk(approved, "part approval");
    await approver.close();
    await tech.close();
    const keeper = await browser.newContext({ storageState: inventoryState });
    const keeperPage = await keeper.newPage();
    const issued = await post(keeperPage, `/api/backend/work-orders/${id}/part-requests/${requestId}/issue`, { quantity: 1 });
    expect(issued.status(), await issued.text()).toBeLessThan(300);
    expect(sqlInt("SparePart", "quantityInStock", String(part?.id))).toBe(stockBefore - 1);
    const issuedQuantity = sqlInt("PartRequest", "issuedQuantity", requestId);
    await post(keeperPage, `/api/backend/work-orders/${id}/part-requests/${requestId}/issue`, { quantity: 1 });
    expect(sqlInt("PartRequest", "issuedQuantity", requestId)).toBe(issuedQuantity);
    expect(sqlCount("PartRequest", { id: requestId })).toBe(1);
    await keeper.close();
  });

  test("9 meter reading stays the latest single row", async ({ browser }) => {
    const note = stamp();
    const context = await browser.newContext({ storageState: technicianState });
    const page = await context.newPage();
    const meters = await page.request.get("/api/backend/utilities/meters?page=1&limit=20");
    expect(meters.status()).toBe(200);
    const meterRows = rowsOf(await bodyOf(meters)) as Array<{ id?: string }>;
    let meter = meterRows[0];
    let readingValue = 1;
    for (const candidate of meterRows) {
      const history = await page.request.get(`/api/backend/utilities/meters/${candidate.id}/readings`);
      const values = (rowsOf(await bodyOf(history)) as Array<{ readingValue?: number }>).map((row) => Number(row.readingValue || 0));
      const latest = values.length ? Math.max(...values) : 0;
      if (latest < 100_000) {
        meter = candidate;
        readingValue = latest + 1;
        break;
      }
    }
    expect(meter?.id).toBeTruthy();
    const readingDate = new Date().toISOString();
    const saved = await post(page, `/api/backend/utilities/meters/${meter?.id}/readings`, {
      readingDate,
      readingValue,
      notes: note
    });
    expect(saved.status(), await saved.text()).toBeLessThan(300);
    const meterNumber = String((meter as { meterNumber?: string }).meterNumber || "");
    await page.goto("/utilities/readings");
    await page.reload();
    await page.getByPlaceholder("Meter number, name, or location").fill(meterNumber || String(meter?.id));
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: meterNumber || String(meter?.id) }).click();
    await expect(page.getByText(String(readingValue), { exact: false }).filter({ visible: true }).first()).toBeVisible();
    expect(sqlCountContaining("MeterReading", "notes", note)).toBe(1);
    await post(page, `/api/backend/utilities/meters/${meter?.id}/readings`, { readingDate, readingValue, notes: note });
    expect(sqlCountContaining("MeterReading", "notes", note)).toBe(1);
    await context.close();
  });

  test("10 vendor quote keeps tax 18 and one row", async ({ browser }) => {
    const title = stamp();
    const context = await browser.newContext({ storageState: managerState });
    const page = await context.newPage();
    const id = await createWorkOrder(page, title);
    const supplierName = `Vendor ${title}`;
    const createdSupplier = await post(page, "/api/backend/suppliers", { name: supplierName, phone: "+94112345678" });
    await expectOk(createdSupplier, "supplier");
    const supplier = { id: idOf(await bodyOf(createdSupplier)) };
    expect(supplier.id).toMatch(/^[a-z0-9]+$/i);
    const quoteNo = title.slice(0, 20);
    expect((await post(page, `/api/backend/work-orders/${id}/vendor-repair/request`, { externalRepairReason: title, supplierId: supplier?.id })).status()).toBeLessThan(300);
    expect((await post(page, `/api/backend/work-orders/${id}/vendor-repair/select-vendor`, { supplierId: supplier?.id })).status()).toBeLessThan(300);
    const quoted = await post(page, `/api/backend/work-orders/${id}/vendor-repair/quotations`, {
      supplierId: supplier?.id,
      quotationNo: quoteNo,
      quotationDate: new Date().toISOString(),
      quotedAmount: 1000,
      taxRatePercent: 18,
      currency: "LKR"
    });
    expect(quoted.status(), await quoted.text()).toBeLessThan(300);
    await showAfterReload(page, `${jobUrl(id)}&tab=vendor-repair`, "18%");
    expect(sqlCount("VendorQuotation", { quotationNo: quoteNo })).toBe(1);
    await post(page, `/api/backend/work-orders/${id}/vendor-repair/quotations`, {
      supplierId: supplier?.id,
      quotationNo: quoteNo,
      quotationDate: new Date().toISOString(),
      quotedAmount: 1000,
      taxRatePercent: 18,
      currency: "LKR"
    });
    expect(sqlCount("VendorQuotation", { quotationNo: quoteNo })).toBe(1);
    await context.close();
  });

  test("11 asset and tag file stay after reload", async ({ browser }) => {
    const tag = `AST-${stamp().replace(/[^A-Z0-9]/g, "").slice(0, 12)}`;
    const name = `Asset ${tag}`;
    const context = await browser.newContext({ storageState: adminState });
    const page = await context.newPage();
    const created = await post(page, "/api/backend/assets", { assetTag: tag, name });
    expect(created.status(), await created.text()).toBeLessThan(300);
    const csv = `assetTag,assetCode,serialNumber,erpCode,vehicleRegistrationNo,note\n${tag},,${tag},,,save gap\n`;
    const applied = await page.request.post("/api/backend/admin/asset-tags/apply", {
      headers: await getCsrfHeader(page),
      multipart: { file: { name: "tags.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } }
    });
    expect(applied.status(), await applied.text()).toBeLessThan(300);
    await page.goto("/assets");
    await page.reload();
    await page.getByPlaceholder("Tag, name, category, location").fill(tag);
    await expect(page.getByText(tag).first()).toBeVisible();
    expect(sqlCount("Asset", { assetTag: tag })).toBe(1);
    await page.request.post("/api/backend/admin/asset-tags/apply", {
      headers: await getCsrfHeader(page),
      multipart: { file: { name: "tags.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } }
    });
    expect(sqlCount("Asset", { assetTag: tag })).toBe(1);
    await context.close();
  });

  test("12 user keeps the assigned role after reload", async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminState });
    const page = await context.newPage();
    const roles = await page.request.get("/api/backend/roles");
    expect(roles.status()).toBe(200);
    const list = rowsOf(await bodyOf(roles)) as Array<{ id?: string; name?: string }>;
    const role = list.find((row) => row.name === "VIEWER") || list[0];
    expect(role?.id).toBeTruthy();
    const email = `${stamp().toLowerCase()}@e2e.maintainpro.test`;
    const created = await post(page, "/api/backend/users", {
      email,
      password: "SaveGap-Pass-1",
      firstName: "Save",
      lastName: "Gap",
      roleId: role?.id
    });
    expect(created.status(), await created.text()).toBeLessThan(300);
    await page.goto("/admin/users");
    await page.reload();
    await page.getByPlaceholder("Search name, email, role, or tenant").fill(email);
    await expect(page.getByText(email).first()).toBeVisible();
    await expect(page.getByText(role?.name || "VIEWER").first()).toBeVisible();
    expect(sqlCount("User", { email })).toBe(1);
    await post(page, "/api/backend/users", {
      email,
      password: "SaveGap-Pass-1",
      firstName: "Save",
      lastName: "Gap",
      roleId: role?.id
    });
    expect(sqlCount("User", { email })).toBe(1);
    await context.close();
  });
});
