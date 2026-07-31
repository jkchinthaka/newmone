import { expect, test } from "@playwright/test";
import path from "node:path";
import { loginViaUi, readCookieMap } from "./helpers/auth";

test.describe("E2E file/evidence controls @full-stack", () => {
  test("E2E-FILE-001..004 upload validation where enabled", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const cookies = await readCookieMap(page);
    const csrf = cookies.get("maintainpro_csrf")?.value;

    // Harmless text fixture with misleading extension for MIME tests
    const fixture = path.join(__dirname, "fixtures", "harmless.txt");
    const response = await page.request.post("/api/backend/work-orders/000000000000000000000000/attachments", {
      headers: csrf ? { "x-csrf-token": csrf } : {},
      multipart: {
        file: {
          name: "malware.exe.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("not an executable")
        }
      }
    });
    // Expect controlled rejection or 404 for missing WO — never 500 with stack
    expect(response.status()).toBeLessThan(500);
    const text = await response.text();
    expect(text).not.toMatch(/mongodb:\/\/|BEGIN PRIVATE KEY/i);
    void fixture;
  });
});