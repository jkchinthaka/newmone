import { expect, type Page } from "@playwright/test";
import { e2eEmail, e2ePassword, type QaRole } from "./env";
import { assertNoTokensInBody, waitForSessionCookies } from "./session";

async function submitLoginUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/backend/auth/login") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  return responsePromise;
}

async function waitOutThrottle(_page: Page, attempt: number) {
  // Prefer a longer pause over many short retries that burn the test timeout.
  // Uses Promise delay (not UI waitForTimeout) so the page is free to settle.
  const ms = Math.min(20_000, 6_000 + attempt * 4_000);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Establish a browser session for a seeded persona.
 * Prefers API login (shared cookie jar) and falls back to UI.
 */
export async function loginViaUi(page: Page, role: QaRole) {
  const email = e2eEmail(role);
  const password = e2ePassword();
  let lastStatus = 0;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const apiResponse = await page.request.post("/api/backend/auth/login", {
      data: { email, password }
    });
    lastStatus = apiResponse.status();
    if (lastStatus === 429 || lastStatus === 409) {
      await waitOutThrottle(page, attempt);
      continue;
    }
    if (lastStatus === 200) {
      const body = await apiResponse.json().catch(() => ({}));
      assertNoTokensInBody(body);
      await waitForSessionCookies(page);
      await page.goto("/action-center");
      await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
      return { email, via: "api" as const };
    }
    break;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const loginResponse = await submitLoginUi(page, email, password);
    lastStatus = loginResponse.status();
    if (lastStatus === 429 || lastStatus === 409) {
      await waitOutThrottle(page, attempt);
      continue;
    }
    expect(lastStatus, `login failed for ${role}: ${lastStatus}`).toBe(200);
    const body = await loginResponse.json().catch(() => ({}));
    assertNoTokensInBody(body);
    await waitForSessionCookies(page);
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 });
    return { email, via: "ui" as const };
  }

  expect(lastStatus, `login failed for ${role}: ${lastStatus}`).toBe(200);
  return { email, via: "ui" as const };
}

export async function loginExpectFailure(
  page: Page,
  email: string,
  password: string
): Promise<number> {
  let status = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await page.request.post("/api/backend/auth/login", {
      data: { email, password }
    });
    status = response.status();
    if (status === 429 || status === 409) {
      await waitOutThrottle(page, attempt);
      continue;
    }
    break;
  }
  await page.goto("/login");
  return status;
}
