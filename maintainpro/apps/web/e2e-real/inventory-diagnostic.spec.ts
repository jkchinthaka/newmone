import { expect, test, type Browser } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  authenticatedGet,
  authenticatedPost,
  cookieNamesPresent,
  getAuthenticatedUserId
} from "./helpers/browser-session";
import { e2eRunId } from "./helpers/env";
import { buildValidWorkOrderPayload } from "./helpers/work-order-payload";

/**
 * Focused inventory gate fixture.
 * Uses a dedicated admin-created part so the shared seeded E2E-PART quantity stays intact
 * for E2E-INV-002. Unique idempotency keys avoid cross-invocation collisions.
 * Safe console output: statuses and yes/no flags only.
 */
async function createGateFixtures(browser: Browser): Promise<{
  workOrderId: string;
  partId: string;
  openingQty: number;
}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const login = await loginViaUi(page, "admin-a");
    expect(login.loginResponse.status()).toBe(200);
    await getAuthenticatedUserId(page);

    const payload = await buildValidWorkOrderPayload(page, {
      title: `E2E INV GATE ${e2eRunId().slice(-8)}`
    });
    const createWo = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(createWo.status()).toBe(201);
    const woBody = await createWo.json();
    const workOrderId = String((woBody.data || woBody).id || (woBody.data || woBody)._id || "");
    expect(workOrderId.length).toBeGreaterThan(0);

    const partNumber = `E2E-GATE-PART-${e2eRunId()}-${Date.now()}`;
    const createPart = await authenticatedPost(page, "/api/backend/inventory/parts", {
      data: {
        partNumber,
        name: "E2E Gate Part",
        category: "FILTER",
        unitCost: 5,
        unit: "pcs",
        minimumStock: 5,
        reorderPoint: 2,
        quantityInStock: 10
      }
    });
    expect(createPart.status()).toBe(201);
    const partBody = await createPart.json();
    const part = partBody.data || partBody;
    const partId = String(part.id || part._id || "");
    expect(partId.length).toBeGreaterThan(0);
    return { workOrderId, partId, openingQty: Number(part.quantityInStock ?? 10) };
  } finally {
    await context.close();
  }
}

test.describe("E2E inventory diagnostic @full-stack @security @erp-control", () => {
  test("INV-DIAG-001 keeper list and work-order-linked issue", async ({ page, browser }) => {
    const fixtures = await createGateFixtures(browser);
    const workOrderFound = fixtures.workOrderId.length > 0;
    const keyPrimary = `e2e-inv-gate-${e2eRunId()}-${Date.now()}-primary`;
    const keyNeg = `e2e-inv-gate-${e2eRunId()}-${Date.now()}-neg`;

    const login = await loginViaUi(page, "inventory-a");
    expect(login.loginResponse.status()).toBe(200);
    const names = await cookieNamesPresent(page);

    const list = await authenticatedGet(page, "/api/backend/inventory/parts");
    const listBody = await list.json();
    const items = listBody.data?.items || listBody.data || listBody.items || [];
    const seeded = (Array.isArray(items) ? items : []).find((p: { partNumber?: string }) =>
      String(p.partNumber || "").includes(`E2E-PART-${e2eRunId()}`)
    );
    const itemFound = Boolean(seeded?.id) && Boolean(fixtures.partId);

    const detail = await authenticatedGet(page, `/api/backend/inventory/parts/${fixtures.partId}`);
    const opening =
      detail.status() === 200
        ? Number(((await detail.json()).data || {}).quantityInStock ?? fixtures.openingQty)
        : fixtures.openingQty;

    const issue = workOrderFound
      ? await authenticatedPost(page, `/api/backend/inventory/parts/${fixtures.partId}/stock-out`, {
          data: {
            quantity: 1,
            workOrderId: fixtures.workOrderId,
            notes: "inventory gate",
            idempotencyKey: keyPrimary
          }
        })
      : null;

    const replay =
      issue && issue.status() === 200
        ? await authenticatedPost(page, `/api/backend/inventory/parts/${fixtures.partId}/stock-out`, {
            data: {
              quantity: 1,
              workOrderId: fixtures.workOrderId,
              notes: "inventory gate",
              idempotencyKey: keyPrimary
            }
          })
        : null;

    const after =
      issue && issue.status() === 200
        ? await authenticatedGet(page, `/api/backend/inventory/parts/${fixtures.partId}`)
        : null;
    const afterQty =
      after && after.status() === 200
        ? Number(((await after.json()).data || {}).quantityInStock)
        : null;

    const negative = workOrderFound
      ? await authenticatedPost(page, `/api/backend/inventory/parts/${fixtures.partId}/stock-out`, {
          data: {
            quantity: 999999,
            workOrderId: fixtures.workOrderId,
            notes: "gate negative",
            idempotencyKey: keyNeg
          }
        })
      : null;

    const movements = await authenticatedGet(
      page,
      `/api/backend/inventory/parts/${fixtures.partId}/movements`
    );

    console.log(
      [
        `login_status=${login.loginResponse.status()}`,
        `parts_list_status=${list.status()}`,
        `item_found=${itemFound ? "yes" : "no"}`,
        `work_order_found=${workOrderFound ? "yes" : "no"}`,
        `csrf_present=${names.csrf ? "yes" : "no"}`,
        `issue_status=${issue ? issue.status() : "n/a"}`,
        `quantity_delta_valid=${afterQty !== null && afterQty === opening - 1 ? "yes" : "no"}`,
        `duplicate_prevented=${
          replay && afterQty !== null && replay.status() === 200 && afterQty === opening - 1
            ? "yes"
            : "no"
        }`,
        `negative_rejected=${negative && negative.status() === 400 ? "yes" : "no"}`,
        `movement_present=${movements.status() === 200 ? "yes" : "no"}`
      ].join(" ")
    );

    expect(list.status()).toBe(200);
    expect(itemFound).toBe(true);
    expect(workOrderFound).toBe(true);
    expect(issue!.status()).toBe(200);
    expect(afterQty).toBe(opening - 1);
    expect(replay!.status()).toBe(200);
    expect(negative!.status()).toBe(400);
    expect(movements.status()).toBe(200);
  });
});
