import { expect, test } from "@playwright/test";
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
 * Safe inventory gate — statuses and yes/no flags only.
 * Never prints user/part/work-order IDs, tokens, or cookies.
 */
test.describe("E2E inventory diagnostic @full-stack @security @smoke @erp-control", () => {
  test("INV-DIAG-001 keeper list and work-order-linked issue", async ({ page, browser }) => {
    const mgr = await browser.newContext();
    const mgrPage = await mgr.newPage();
    let workOrderFound = false;
    let woId = "";
    try {
      const loginMgr = await loginViaUi(mgrPage, "manager-a");
      expect(loginMgr.loginResponse.status()).toBe(200);
      await getAuthenticatedUserId(mgrPage);
      const payload = await buildValidWorkOrderPayload(mgrPage, {
        title: `E2E INV GATE ${e2eRunId().slice(-8)}`
      });
      const create = await authenticatedPost(mgrPage, "/api/backend/work-orders", { data: payload });
      expect(create.status()).toBe(201);
      const body = await create.json();
      woId = String((body.data || body).id || (body.data || body)._id || "");
      workOrderFound = woId.length > 0;
    } finally {
      await mgr.close();
    }

    const login = await loginViaUi(page, "inventory-a");
    expect(login.loginResponse.status()).toBe(200);
    const names = await cookieNamesPresent(page);
    const list = await authenticatedGet(page, "/api/backend/inventory/parts");
    const listBody = await list.json();
    const items = listBody.data?.items || listBody.data || listBody.items || [];
    const part = (Array.isArray(items) ? items : []).find((p: { partNumber?: string }) =>
      String(p.partNumber || "").includes(`E2E-PART-${e2eRunId()}`)
    );
    const itemFound = Boolean(part?.id);
    const opening = Number(part?.quantityInStock || 0);

    const issue = itemFound && workOrderFound
      ? await authenticatedPost(page, `/api/backend/inventory/parts/${part.id}/stock-out`, {
          data: {
            quantity: 1,
            workOrderId: woId,
            notes: "inventory gate",
            idempotencyKey: `e2e-inv-gate-${e2eRunId()}`
          }
        })
      : null;

    const replay =
      issue && issue.status() === 200
        ? await authenticatedPost(page, `/api/backend/inventory/parts/${part.id}/stock-out`, {
            data: {
              quantity: 1,
              workOrderId: woId,
              notes: "inventory gate",
              idempotencyKey: `e2e-inv-gate-${e2eRunId()}`
            }
          })
        : null;

    const after =
      issue && issue.status() === 200
        ? await authenticatedGet(page, `/api/backend/inventory/parts/${part.id}`)
        : null;
    const afterQty =
      after && after.status() === 200
        ? Number(((await after.json()).data || {}).quantityInStock)
        : null;

    const negative =
      itemFound && workOrderFound
        ? await authenticatedPost(page, `/api/backend/inventory/parts/${part.id}/stock-out`, {
            data: {
              quantity: 999999,
              workOrderId: woId,
              notes: "gate negative",
              idempotencyKey: `e2e-inv-gate-${e2eRunId()}-neg`
            }
          })
        : null;

    const movements =
      itemFound ? await authenticatedGet(page, `/api/backend/inventory/parts/${part.id}/movements`) : null;

    console.log(
      [
        `login_status=${login.loginResponse.status()}`,
        `parts_list_status=${list.status()}`,
        `item_found=${itemFound ? "yes" : "no"}`,
        `work_order_found=${workOrderFound ? "yes" : "no"}`,
        `csrf_present=${names.csrf ? "yes" : "no"}`,
        `issue_status=${issue ? issue.status() : "n/a"}`,
        `quantity_delta_valid=${afterQty !== null && afterQty === opening - 1 ? "yes" : "no"}`,
        `duplicate_prevented=${replay && afterQty !== null && replay.status() === 200 && afterQty === opening - 1 ? "yes" : "no"}`,
        `negative_rejected=${negative && negative.status() === 400 ? "yes" : "no"}`,
        `movement_present=${movements && movements.status() === 200 ? "yes" : "no"}`
      ].join(" ")
    );

    expect(list.status()).toBe(200);
    expect(itemFound).toBe(true);
    expect(workOrderFound).toBe(true);
    expect(issue!.status()).toBe(200);
    expect(afterQty).toBe(opening - 1);
    expect(replay!.status()).toBe(200);
    expect(negative!.status()).toBe(400);
    expect(movements!.status()).toBe(200);
  });
});
