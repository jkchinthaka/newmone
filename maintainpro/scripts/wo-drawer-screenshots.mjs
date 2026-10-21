import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.env.WO_DRAWER_BASE || "http://127.0.0.1:3021";
const outDir = path.resolve("docs/handover/ui-redesign/wo-drawer");

const workOrder = {
  id: "wo-visual",
  woNumber: "WO-2026-0202",
  title: "MR-2026-00015 Gate pump leak 88421",
  description: "Water leaking from the pump seal at the main gate. Floor is wet; pump still running.",
  priority: "MEDIUM",
  status: "IN_PROGRESS",
  approvalStatus: "APPROVED",
  verificationStatus: "PENDING",
  type: "CORRECTIVE",
  jobDomain: "MACHINERY",
  assetId: "asset-1",
  createdById: "user-e2e-admin",
  slaBreached: false,
  attachments: [],
  createdAt: "2026-10-23T09:00:00.000Z",
  updatedAt: "2026-10-24T08:46:00.000Z",
  dueDate: "2026-10-24T11:30:00.000Z",
  expectedCompletionDate: "2026-10-24T09:30:00.000Z",
  estimatedCost: 15800,
  estimatedHours: 4,
  categoryNameSnapshot: "Pump / Water system",
  createdBy: { id: "user-e2e-admin", firstName: "Security", lastName: "Officer" },
  asset: { id: "asset-1", name: "Main Gate Water Pump", assetTag: "PUMP-01" }
};

const closedOrder = { ...workOrder, id: "wo-closed", status: "CLOSED", title: "Gate pump leak" };

const assignees = [
  {
    id: "as-1",
    employeeId: "emp-1",
    designation: "Field Technician",
    roleInTask: "Lead technician",
    isPrimary: true,
    plannedStartAt: "2026-10-24T03:00:00.000Z",
    plannedEndAt: "2026-10-24T07:00:00.000Z",
    estimatedHours: 4,
    assignmentStatus: "ACTIVE",
    employee: { id: "emp-1", fullName: "Kasun Perera", designation: "Field Technician" }
  }
];

function json(data) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data, message: "ok" })
  };
}

async function installRoutes(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes("/api/") && !url.includes(":3000")) return route.continue();
    const pathName = new URL(url).pathname;
    if (pathName.includes("/auth/me")) {
      return route.fulfill(json({
        id: "user-e2e-admin",
        email: "admin@maintainpro.local",
        firstName: "Admin",
        lastName: "User",
        tenantId: "tenant-e2e",
        role: { id: "role-admin", name: "ADMIN" },
        permissions: ["work_orders.manage", "audit.view", "reliability.view"]
      }));
    }
    if (pathName.includes("/tenants/me")) {
      return route.fulfill(json({
        activeTenant: { id: "tenant-e2e", name: "E2E Tenant", slug: "e2e-tenant", isActive: true },
        memberships: [{ tenantId: "tenant-e2e", tenantName: "E2E Tenant", tenantSlug: "e2e-tenant", membershipRole: "ADMIN", isActive: true }]
      }));
    }
    if (pathName.endsWith("/work-orders/queues")) {
      return route.fulfill(json({
        queues: [{ key: "all", label: "All", count: 1 }],
        defaultQueue: "all",
        lastUpdated: "2026-10-24T08:46:00.000Z"
      }));
    }
    if (pathName.includes("/work-orders/queues/")) {
      return route.fulfill(json({
        data: [workOrder, closedOrder],
        total: 2,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        queue: "all",
        label: "All",
        lastUpdated: "2026-10-24T08:46:00.000Z"
      }));
    }
    if (pathName.endsWith("/work-orders/wo-closed")) return route.fulfill(json(closedOrder));
    if (pathName.endsWith("/work-orders/wo-visual")) return route.fulfill(json(workOrder));
    if (pathName.includes("/assignees")) return route.fulfill(json(assignees));
    if (pathName.includes("/workforce/employees")) {
      return route.fulfill(json([
        { id: "emp-2", fullName: "Sunil Fernando", designation: "Mechanic", effectiveDesignation: "Mechanic", availabilityLabel: "Available" }
      ]));
    }
    if (pathName.includes("/downtime")) {
      return route.fulfill(json({
        segments: [
          {
            id: "seg-1",
            category: "BREAKDOWN",
            startedAt: new Date(Date.now() - (2 * 3600 + 15 * 60 + 40) * 1000).toISOString(),
            endedAt: null
          }
        ],
        openCount: 1
      }));
    }
    if (pathName.includes("/evidence/") && pathName.endsWith("/content")) {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
        "base64"
      );
      return route.fulfill({ status: 200, contentType: "image/png", body: png });
    }
    if (pathName.includes("/evidence/readiness")) {
      return route.fulfill(json({ state: "configured", allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"], maxFileSizeMb: 10 }));
    }
    if (pathName.includes("/evidence")) {
      return route.fulfill(json({
        items: [
          {
            id: "ev-1",
            fileName: "before.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 120000,
            status: "UPLOADED",
            evidenceType: "BEFORE_PHOTO",
            verificationStatus: "PENDING",
            rejectedReason: null,
            note: null,
            isRequired: true,
            capturedAt: "2026-10-24T03:15:00.000Z",
            source: "UPLOAD",
            clientGeneratedId: null,
            offlineCreatedAt: null,
            syncedAt: null,
            syncStatus: null,
            syncError: null,
            uploadedByName: "Kasun Perera",
            createdAt: "2026-10-24T03:15:00.000Z",
            downloadAvailable: true
          }
        ],
        requirements: { required: true, storageEnabled: true, hasBefore: true, hasAfter: false, beforeCount: 1, afterCount: 0, missingBefore: false, missingAfter: true, complete: false, rejectedCount: 0, completionNoteProvided: false, qrRequired: false }
      }));
    }
    if (pathName.includes("/vendor-repair")) {
      return route.fulfill(json({
        workOrderId: "wo-visual",
        workOrderStatus: "IN_PROGRESS",
        verificationStatus: "PENDING",
        defaultTaxRatePercent: 18,
        vendorCase: {
          id: "vr-1",
          status: "QUOTATION_SUBMITTED",
          externalRepairReason: "Rewind pump motor and pressure test",
          supplier: { id: "sup-1", name: "AquaFix Engineering (Pvt) Ltd" },
          quotations: [
            {
              id: "q-1",
              quotationNo: "QT-AF-2291",
              quotationDate: "2026-10-24T00:00:00.000Z",
              quotedAmount: 40000,
              taxAmount: 7200,
              totalAmount: 47200,
              displayTaxRatePercent: 18,
              currency: "LKR",
              status: "SUBMITTED"
            }
          ],
          invoices: []
        },
        costSummary: {
          approvedQuotationTotal: 47200,
          invoiceTotal: 0,
          varianceAmount: 0,
          variancePercentage: 0,
          partsCost: 0,
          laborCost: 0,
          totalMaintenanceCost: 47200
        }
      }));
    }
    if (pathName.includes("/history")) {
      return route.fulfill(json({
        workOrderId: "wo-visual",
        hasLinkedTarget: true,
        assetSummary: null,
        vehicleSummary: null,
        lastService: null,
        previousMaintenance: [
          { id: "old-1", woNumber: "WO-2025-0101", title: "Seal replaced", type: "CORRECTIVE", completedDate: "2025-11-02T00:00:00.000Z", technicianName: "Kasun Perera" }
        ],
        previousBreakdowns: [],
        previousPartsUsed: [],
        costSummary: { totalActualCost: 0, totalEstimatedCost: 0, completedJobCount: 1 },
        meterHistory: [],
        complianceWarnings: [],
        repeatIssueWarnings: [],
        readOnly: true,
        dataSources: []
      }));
    }
    if (pathName.includes("/domain-context")) {
      return route.fulfill(json({
        workOrderId: "wo-visual",
        woNumber: "WO-2026-0202",
        jobDomain: "MACHINERY",
        identity: { machinery: { label: "Main Gate Water Pump", operationalStatus: "Down", criticality: "High", site: "Hatchery", functionalLocation: "Main gate" }, service: null, vehicle: null },
        completion: {},
        openJobsOnTarget: 1,
        criticalOpenWorkOrders: 0,
        controlIndicators: [],
        readOnlyHints: {}
      }));
    }
    if (pathName.includes("/part-requests") || pathName.endsWith("/parts")) return route.fulfill(json([]));
    if (pathName.includes("/activity")) return route.fulfill(json({ workOrderId: "wo-visual", entries: [], linkedFacilityIssue: null, checkedAt: new Date().toISOString() }));
    if (pathName.includes("/evidence/readiness") || pathName.includes("storage")) {
      return route.fulfill(json({ state: "configured", allowedMimeTypes: ["image/jpeg", "application/pdf"], maxFileSizeMb: 10 }));
    }
    return route.fulfill(json([]));
  });
}

const tabs = [
  ["overview", "01-overview"],
  ["assignment", "02-assignment"],
  ["parts", "03-parts"],
  ["safety", "04-downtime"],
  ["evidence", "05-evidence"],
  ["vendor-repair", "06-vendor"],
  ["history", "07-history"]
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (err) => console.log("PAGEERROR", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text());
});
await page.context().addCookies([
  { name: "maintainpro_access", value: "e2e-access-token", url: base, httpOnly: true, sameSite: "Lax" },
  { name: "maintainpro_refresh", value: "e2e-refresh-token", url: base, httpOnly: true, sameSite: "Lax" },
  { name: "maintainpro_csrf", value: "e2e-csrf-token", url: base, httpOnly: false, sameSite: "Lax" }
]);
await page.addInitScript(() => {
  localStorage.setItem("maintainpro_user", JSON.stringify({
    id: "user-e2e-admin",
    email: "admin@maintainpro.local",
    role: { name: "ADMIN" },
    tenantId: "tenant-e2e",
    permissions: ["work_orders.manage", "audit.view"]
  }));
});
await installRoutes(page);

for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  for (const [tab, name] of tabs) {
    await page.goto(`${base}/work-orders?wo=wo-visual&tab=${tab}`, { waitUntil: "domcontentloaded" });
    const dialog = page.getByRole("dialog");
    try {
      await dialog.waitFor({ state: "visible", timeout: 45000 });
    } catch (error) {
      await page.screenshot({ path: path.join(outDir, `debug-${name}-${width}.png`), fullPage: true });
      console.log("URL", page.url());
      console.log((await page.locator("body").innerText()).slice(0, 400));
      continue;
    }
    await page.waitForTimeout(400);
    await dialog.screenshot({ path: path.join(outDir, `${name}-${width}.png`) });
  }
  await page.goto(`${base}/work-orders?wo=wo-closed&tab=assignment`, { waitUntil: "domcontentloaded" });
  const closed = page.getByRole("dialog");
  await closed.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(400);
  await closed.screenshot({ path: path.join(outDir, `08-assignment-closed-${width}.png`) });
}

await browser.close();
console.log(`screenshots written to ${outDir}`);
