import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { e2eEmail, e2ePassword } from "./env";

/**
 * POST /auth/login is intentionally rate-limited (5 requests / 60s, unrelated
 * to and untouched by this change — a real anti-brute-force control that
 * must stay exactly as strict for real traffic). Specs that log in many
 * distinct seed users in quick succession (e.g. a multi-actor work-order
 * lifecycle gate) can legitimately exceed that budget purely from test
 * volume. Previously loginViaUi neither asserted success nor retried, so a
 * throttled (429) login silently proceeded as if it had succeeded — no
 * session cookies were ever set (the BFF only sets them on a 2xx upstream
 * response), and the failure only surfaced much later as a confusing,
 * unrelated-looking "CSRF cookie unavailable" or "/auth/me returned 401"
 * deep inside the test. Root-caused by reproducing locally and reading the
 * API's own logs during a failing run (repeated
 * `POST /api/auth/login -> 429 code=RATE_LIMITED`).
 *
 * Fix: loginViaUi now behaves like a well-mannered client against a real
 * rate limit — on 429 it waits out the server's own `Retry-After` and
 * retries (bounded), then asserts success exactly like the sibling
 * loginViaApi already does. The throttle itself is completely untouched.
 */
const LOGIN_RETRY_MAX_ATTEMPTS = 3;
const LOGIN_RETRY_FALLBACK_WAIT_MS = 61_000; // safely past the 60s throttle window

export async function loginViaUi(page: Page, emailLocal: string) {
  const email = e2eEmail(emailLocal);

  for (let attempt = 1; attempt <= LOGIN_RETRY_MAX_ATTEMPTS; attempt++) {
    await page.goto("/login");
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(e2ePassword());

    const loginResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/backend/auth/login") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: /sign in/i }).click();
    const loginResponse = await loginResponsePromise;

    if (loginResponse.status() === 429 && attempt < LOGIN_RETRY_MAX_ATTEMPTS) {
      const retryAfterHeader = loginResponse.headers()["retry-after"];
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const waitMs = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs + 1000 : LOGIN_RETRY_FALLBACK_WAIT_MS;
      console.log(`loginViaUi: /auth/login throttled (429), waiting ${waitMs}ms before retry ${attempt + 1}/${LOGIN_RETRY_MAX_ATTEMPTS}`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    const body = await loginResponse.json().catch(() => ({}));
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/"accessToken"\s*:/);
    expect(serialized).not.toMatch(/"refreshToken"\s*:/);
    // Matches the guarantee loginViaApi already makes — every caller can now
    // rely on loginViaUi() either succeeding or throwing, never silently
    // returning a failed/throttled response.
    expect(loginResponse.status()).toBe(200);
    return { email, loginResponse };
  }

  throw new Error(`loginViaUi: /auth/login still throttled after ${LOGIN_RETRY_MAX_ATTEMPTS} attempts`);
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