import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { e2eEmail, e2ePassword } from "./env";

const ACCESS_COOKIE = "maintainpro_access";
const CSRF_COOKIE = "maintainpro_csrf";

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
  expect(loginResponse.status(), `login failed for persona ${emailLocal}`).toBe(200);
  const body = await loginResponse.json().catch(() => ({}));
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/"accessToken"\s*:/);
  expect(serialized).not.toMatch(/"refreshToken"\s*:/);

  // Wait until the browser jar has both session cookies before any APIRequestContext call.
  await expect
    .poll(
      async () => {
        const cookies = await page.context().cookies();
        const names = new Set(cookies.map((cookie) => cookie.name));
        return names.has(ACCESS_COOKIE) && names.has(CSRF_COOKIE);
      },
      { timeout: 15_000, message: `session cookies missing after login for ${emailLocal}` }
    )
    .toBe(true);

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