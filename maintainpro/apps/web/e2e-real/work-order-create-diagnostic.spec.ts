import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  authenticatedGet,
  authenticatedPost,
  cookieNamesPresent,
  getAuthenticatedUserId
} from "./helpers/browser-session";
import { buildValidWorkOrderPayload } from "./helpers/work-order-payload";

/**
 * Safe work-order create gate — statuses and presence flags only.
 * Never prints user IDs, work-order IDs, emails, passwords, tokens, or cookies.
 */
test.describe("E2E work-order create diagnostic @full-stack @security @smoke", () => {
  test("WO-CREATE-DIAG-001 valid CSRF create reaches business mutation", async ({ page }) => {
    const login = await loginViaUi(page, "manager-a");
    expect(login.loginResponse.status()).toBe(200);

    const names = await cookieNamesPresent(page);
    await getAuthenticatedUserId(page);
    const me = await authenticatedGet(page, "/api/backend/auth/me");
    const payload = await buildValidWorkOrderPayload(page);
    const create = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    const body = await create.json().catch(() => ({}));
    const wo = (body as { data?: { id?: string; _id?: string } }).data || body;
    const id = (wo as { id?: string; _id?: string }).id || (wo as { id?: string; _id?: string })._id;
    const read =
      create.status() === 201 && id
        ? await authenticatedGet(page, `/api/backend/work-orders/${id}`)
        : null;

    console.log(
      [
        `login_status=${login.loginResponse.status()}`,
        `auth_me_status=${me.status()}`,
        `csrf_present=${names.csrf ? "yes" : "no"}`,
        `create_status=${create.status()}`,
        `created_record_id_present=${id ? "yes" : "no"}`,
        `read_back_status=${read ? read.status() : "n/a"}`
      ].join(" ")
    );

    expect(me.status()).toBe(200);
    expect(names.csrf).toBe(true);
    expect(create.status()).toBe(201);
    expect(id).toBeTruthy();
    expect(read!.status()).toBe(200);
  });
});
