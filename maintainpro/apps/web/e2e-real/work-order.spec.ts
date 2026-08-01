import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import { authenticatedGet, authenticatedPost } from "./helpers/browser-session";
import {
  assertNoAccessTokensInBody,
  buildValidWorkOrderPayload
} from "./helpers/work-order-payload";

/**
 * Create + read-back smoke for Phase 4B.
 * Full status/assign lifecycle is deferred to Phase 5 (no hardcoded technician IDs).
 */
test.describe("E2E work order create smoke @full-stack @erp-control", () => {
  test("E2E-WO-001 manager creates a work order with valid contract", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const payload = await buildValidWorkOrderPayload(page, {
      title: `E2E Real WO ${Date.now().toString(36)}`
    });

    const create = await authenticatedPost(page, "/api/backend/work-orders", {
      data: payload
    });
    expect(create.status()).toBe(201);
    const created = await create.json();
    assertNoAccessTokensInBody(created);
    const wo = created.data || created;
    const id = wo.id || wo._id;
    expect(id).toBeTruthy();
    expect(wo.woNumber || wo.number).toBeTruthy();

    const detail = await authenticatedGet(page, `/api/backend/work-orders/${id}`);
    expect(detail.status()).toBe(200);
    const detailBody = await detail.json();
    assertNoAccessTokensInBody(detailBody);
    expect(String((detailBody.data || detailBody).title)).toBe(payload.title);

    // Phase 5: assign / status progression — not exercised here.
  });
});
