import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { e2eEmail, e2ePassword } from "./env";

export async function loginViaUi(page: Page, emailLocal: string) {
  const email = e2eEmail(emailLocal);
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(e2ePassword());

  const loginResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/backend/auth/login") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  const loginResponse = await loginResponsePromise;
  const body = await loginResponse.json().catch(() => ({}));
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/"accessToken"\s*:/);
  expect(serialized).not.toMatch(/"refreshToken"\s*:/);
  return { email, loginResponse };
}

export async function loginViaApi(request: APIRequestContext, emailLocal: string) {
  const email = e2eEmail(emailLocal);
  const response = await request.post("/api/backend/auth/login", {
    data: { email, password: e2ePassword() }
  });
  // Canonical Nest/BFF login success is exactly HTTP 200 (not Nest POST default 201).
  expect(response.status()).toBe(200);
  return { email, response };
}

export async function assertNoLegacyTokenStorage(page: Page) {
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("maintainpro_access_token")))
    .toBeNull();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("maintainpro_refresh_token")))
    .toBeNull();
}

export async function readCookieMap(page: Page) {
  const cookies = await page.context().cookies();
  const map = new Map(cookies.map((c) => [c.name, c]));
  return map;
}