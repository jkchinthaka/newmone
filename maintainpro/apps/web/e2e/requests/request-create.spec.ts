import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import {
  createMaintenanceRequest,
  fetchRequest
} from "../helpers/requests";
import { assertNoTokensInBody } from "../helpers/session";

test.describe("Requests › create and persistence", () => {
  test("admin creates request with required fields and can reopen it", async ({ page }) => {
    const description = `${qaTag("REQ")} pump vibration observed on line`;
    const created = await createMaintenanceRequest(page, { description });
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    expect(created.id.length).toBeGreaterThan(0);
    assertNoTokensInBody(created.json);

    const loaded = await fetchRequest(page, created.id);
    expect(String(loaded.description || "")).toContain("QA-E2E-REQ");
    expect(String(loaded.status || "").length).toBeGreaterThan(0);
  });

  test("whitespace-only description is blocked", async ({ page }) => {
    const created = await createMaintenanceRequest(page, { description: "     " });
    expect(created.status).toBeGreaterThanOrEqual(400);
    expect(created.status).toBeLessThan(500);
  });

  test("HTML-like description is stored escaped, sanitized, or rejected", async ({ page }) => {
    // QA-E2E-XSS-REQUEST (class A): raw script must not round-trip in description.
    // Keep failing until the API rejects or sanitizes — do not weaken.
    const payload = `${qaTag("REQ")} <script>alert("xss")</script> seal leak`;
    const created = await createMaintenanceRequest(page, { description: payload });
    if (created.status >= 400) {
      expect(created.status).toBeLessThan(500);
      return;
    }
    expect([200, 201]).toContain(created.status);
    const loaded = await fetchRequest(page, created.id);
    const text = String(loaded.description || "");
    expect(text.toLowerCase()).not.toContain("<script>alert");
    expect(text).toMatch(/QA-E2E-REQ|seal leak/i);
  });
});
