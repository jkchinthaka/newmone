import { expect, type Page } from "@playwright/test";
import { qaTag } from "./env";
import {
  assertNoTokensInBody,
  authenticatedGet,
  authenticatedPost,
  getAuthenticatedUser,
  unwrapData,
  unwrapList
} from "./session";

export type WorkOrderRecord = {
  id?: string;
  _id?: string;
  status?: string;
  title?: string;
  technicianId?: string;
  assignedToId?: string;
  assetId?: string;
  vehicleId?: string | null;
  estimatedCost?: number | string | null;
  actualCost?: number | string | null;
  verificationStatus?: string;
  verifiedById?: string;
  verifiedAt?: string | null;
  version?: number;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  dueDate?: string | null;
};

/**
 * Extract a work-order id from create / convert / action envelopes.
 * Convert-to-WO responses nest the WO under `workOrder` or `workOrderId`.
 */
export function workOrderId(body: unknown): string {
  const data = unwrapData<Record<string, unknown>>(body);
  const nested =
    data && typeof data.workOrder === "object" && data.workOrder
      ? (data.workOrder as Record<string, unknown>)
      : null;
  return String(
    nested?.id ||
      nested?._id ||
      data?.workOrderId ||
      data?.id ||
      data?._id ||
      ""
  ).trim();
}

export async function fetchWorkOrder(page: Page, id: string): Promise<WorkOrderRecord> {
  const response = await authenticatedGet(page, `/api/backend/work-orders/${id}`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  assertNoTokensInBody(body);
  return unwrapData<WorkOrderRecord>(body);
}

export async function resolveAssetId(page: Page): Promise<string> {
  const candidates = [
    "/api/backend/assets?page=1&limit=25",
    "/api/backend/assets?limit=25",
    "/api/backend/assets"
  ];
  for (const path of candidates) {
    const response = await authenticatedGet(page, path);
    if (response.status() !== 200) continue;
    const items = unwrapList<{ id?: string; status?: string }>(await response.json());
    const active = items.find(
      (row) => row.id && String(row.status || "").toUpperCase() !== "RETIRED"
    );
    const id = String(active?.id || items[0]?.id || "").trim();
    if (id) return id;
  }
  throw new Error("No asset available for QA-E2E work order creation.");
}

export async function resolveTechnicianId(page: Page): Promise<string> {
  // If the current session is already the technician, use /auth/me.
  const me = await getAuthenticatedUser(page).catch(() => null);
  if (me?.email?.toLowerCase() === "tech@maintainpro.local") {
    return me.id;
  }

  const paths = [
    "/api/backend/users?page=1&limit=50",
    "/api/backend/users?role=TECHNICIAN&page=1&limit=50",
    "/api/backend/users?limit=50"
  ];
  for (const path of paths) {
    const response = await authenticatedGet(page, path);
    if (response.status() !== 200) continue;
    const items = unwrapList<{
      id?: string;
      email?: string;
      role?: { name?: string } | string;
    }>(await response.json());
    const tech = items.find((row) => {
      const roleName = typeof row.role === "string" ? row.role : row.role?.name;
      return (
        String(row.email || "").toLowerCase() === "tech@maintainpro.local" ||
        String(roleName || "").toUpperCase() === "TECHNICIAN"
      );
    });
    if (tech?.id) return String(tech.id);
  }
  throw new Error("Could not resolve technician user id for assignment.");
}

/** Resolve technician id from the tech storage-state session. */
export async function resolveTechnicianIdFromTechSession(
  browser: import("@playwright/test").Browser
): Promise<string> {
  const { openRoleContext } = await import("./role-context");
  const { page, close } = await openRoleContext(browser, "tech");
  try {
    const user = await getAuthenticatedUser(page);
    return user.id;
  } finally {
    await close();
  }
}

export async function createWorkOrder(
  page: Page,
  overrides?: {
    title?: string;
    description?: string;
    priority?: string;
    type?: string;
    assetId?: string;
    estimatedCost?: number;
    plannedStartAt?: string;
    plannedEndAt?: string;
    dueDate?: string;
    requiresApproval?: boolean;
  }
): Promise<{ id: string; title: string; body: unknown }> {
  const user = await getAuthenticatedUser(page);
  const assetId = overrides?.assetId ?? (await resolveAssetId(page));
  const title = overrides?.title ?? qaTag("WO");
  const payload = {
    title,
    description: overrides?.description ?? `${title} automated description`,
    priority: overrides?.priority ?? "MEDIUM",
    type: overrides?.type ?? "CORRECTIVE",
    createdById: user.id,
    assetId,
    requiresApproval: overrides?.requiresApproval ?? false,
    ...(overrides?.estimatedCost !== undefined ? { estimatedCost: overrides.estimatedCost } : {}),
    ...(overrides?.plannedStartAt ? { plannedStartAt: overrides.plannedStartAt } : {}),
    ...(overrides?.plannedEndAt ? { plannedEndAt: overrides.plannedEndAt } : {}),
    ...(overrides?.dueDate ? { dueDate: overrides.dueDate } : {})
  };

  const response = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
  const body = await response.json().catch(() => ({}));
  return { id: workOrderId(body), title, body: { status: response.status(), json: body } };
}

export async function expectWorkOrderStatus(page: Page, id: string, status: string) {
  await expect
    .poll(async () => (await fetchWorkOrder(page, id)).status, {
      timeout: 20_000,
      message: `expected WO ${id} status ${status}`
    })
    .toBe(status);
}

export async function postWoAction(
  page: Page,
  id: string,
  action:
    | "plan"
    | "assign"
    | "start"
    | "hold"
    | "resume"
    | "complete-technician"
    | "verify-supervisor"
    | "close",
  data: Record<string, unknown> = {}
) {
  const response = await authenticatedPost(page, `/api/backend/work-orders/${id}/${action}`, {
    data
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status(), body };
}

/**
 * Hold IN_PROGRESS jobs for the current persona so start() is not blocked by
 * the single active labour-session rule. Prefer My Jobs (assigned scope).
 */
export async function clearTechnicianActiveSessions(page: Page): Promise<string[]> {
  const held: string[] = [];
  const tryHold = async (id: string) => {
    if (!id || held.includes(id)) return;
    const result = await postWoAction(page, id, "hold", {
      holdReasonCode: "OTHER",
      delayReason: "QA-E2E clear active labour session",
      notes: "QA-E2E clear active labour session"
    });
    if (result.status < 300) held.push(id);
  };

  const myJobs = await authenticatedGet(
    page,
    "/api/backend/work-orders/my-jobs?view=in-progress&pageSize=50"
  );
  if (myJobs.status() === 200) {
    const body = await myJobs.json().catch(() => ({}));
    const payload = (body as { data?: { items?: Array<{ id?: string }> } }).data;
    const items = Array.isArray(payload?.items)
      ? payload.items
      : unwrapList<{ id?: string }>(body);
    for (const row of items) {
      await tryHold(String(row.id || ""));
    }
  }

  const list = await authenticatedGet(page, "/api/backend/work-orders?status=IN_PROGRESS&limit=20");
  if (list.status() === 200) {
    const items = unwrapList<{ id?: string }>(await list.json());
    for (const row of items) {
      await tryHold(String(row.id || ""));
    }
  }

  return held;
}

/** Scan-match QR for the WO asset/vehicle so technician completion can proceed. */
export async function verifyWorkOrderQr(page: Page, id: string) {
  const wo = await fetchWorkOrder(page, id);
  const response = await authenticatedPost(page, `/api/backend/work-orders/${id}/verify-qr`, {
    data: {
      scannedAssetId: wo.assetId || undefined,
      scannedVehicleId: (wo as { vehicleId?: string }).vehicleId || undefined
    }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status(), body };
}

/** Start → (optional hold/resume) → QR → complete-technician with labour-session hygiene. */
export async function runTechnicianExecution(
  page: Page,
  workOrderIdValue: string,
  options?: { holdResume?: boolean; completionNote?: string }
) {
  await clearTechnicianActiveSessions(page);
  const start = await postWoAction(page, workOrderIdValue, "start", {});
  expect(start.status, JSON.stringify(start.body)).toBe(200);

  if (options?.holdResume) {
    const hold = await postWoAction(page, workOrderIdValue, "hold", {
      holdReasonCode: "OTHER",
      delayReason: "QA-E2E hold before complete",
      notes: "QA-E2E hold"
    });
    expect(hold.status, JSON.stringify(hold.body)).toBe(200);
    const resume = await postWoAction(page, workOrderIdValue, "resume", {});
    expect(resume.status, JSON.stringify(resume.body)).toBe(200);
  }

  const qr = await verifyWorkOrderQr(page, workOrderIdValue);
  expect([200, 201]).toContain(qr.status);

  const complete = await postWoAction(page, workOrderIdValue, "complete-technician", {
    completionNote: options?.completionNote ?? "QA-E2E technician completion"
  });
  expect(complete.status, JSON.stringify(complete.body)).toBe(200);
  return { start, qr, complete };
}
