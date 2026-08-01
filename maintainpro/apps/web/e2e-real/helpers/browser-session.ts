import { expect, type APIResponse, type Page } from "@playwright/test";

/** Canonical Nest/BFF logout success status (exact). */
export const CANONICAL_LOGOUT_SUCCESS_STATUS = 200 as const;

const CSRF_COOKIE = "maintainpro_csrf";
const CSRF_HEADER = "x-csrf-token";
const ACCESS_COOKIE = "maintainpro_access";
const REFRESH_COOKIE = "maintainpro_refresh";

/**
 * Read CSRF cookie presence and build the double-submit header.
 * Never logs the cookie value.
 */
export async function getCsrfHeader(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === CSRF_COOKIE);
  if (!csrf || !csrf.value) {
    throw new Error("Expected browser CSRF cookie is unavailable.");
  }
  return { [CSRF_HEADER]: csrf.value };
}

export async function cookieNamesPresent(page: Page): Promise<{
  access: boolean;
  refresh: boolean;
  csrf: boolean;
}> {
  const cookies = await page.context().cookies();
  const names = new Set(cookies.map((c) => c.name));
  return {
    access: names.has(ACCESS_COOKIE),
    refresh: names.has(REFRESH_COOKIE),
    csrf: names.has(CSRF_COOKIE)
  };
}

/** Authenticated GET via BrowserContext cookie jar. No CSRF header. */
export async function authenticatedGet(
  page: Page,
  path: string,
  options?: { headers?: Record<string, string> }
): Promise<APIResponse> {
  return page.request.get(path, {
    headers: options?.headers
  });
}

/**
 * Resolve the authenticated actor ID via BFF `/auth/me`.
 * Never logs the identifier. Does not use localStorage or Mongo.
 */
export async function getAuthenticatedUserId(page: Page): Promise<string> {
  const response = await authenticatedGet(page, "/api/backend/auth/me");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { id?: string; _id?: string };
    id?: string;
    _id?: string;
  };
  const id = String(body.data?.id || body.data?._id || body.id || body._id || "").trim();
  if (!id) {
    throw new Error("Authenticated user ID is unavailable from /auth/me.");
  }
  return id;
}

/** Authenticated mutation via BrowserContext cookies + matching CSRF header. */
export async function authenticatedPost(
  page: Page,
  path: string,
  options?: { data?: unknown; headers?: Record<string, string> }
): Promise<APIResponse> {
  const csrfHeaders = await getCsrfHeader(page);
  return page.request.post(path, {
    data: options?.data,
    headers: {
      ...csrfHeaders,
      ...(options?.headers ?? {})
    }
  });
}

/** Authenticated PATCH via BrowserContext cookies + matching CSRF header. */
export async function authenticatedPatch(
  page: Page,
  path: string,
  options?: { data?: unknown; headers?: Record<string, string> }
): Promise<APIResponse> {
  const csrfHeaders = await getCsrfHeader(page);
  return page.request.patch(path, {
    data: options?.data,
    headers: {
      ...csrfHeaders,
      ...(options?.headers ?? {})
    }
  });
}

export async function authenticatedMutationWithoutCsrf(
  page: Page,
  path: string,
  options?: { data?: unknown }
): Promise<APIResponse> {
  return page.request.post(path, {
    data: options?.data
  });
}

export async function authenticatedMutationWithWrongCsrf(
  page: Page,
  path: string,
  options?: { data?: unknown }
): Promise<APIResponse> {
  return page.request.post(path, {
    data: options?.data,
    headers: { [CSRF_HEADER]: "definitely-wrong-csrf-token" }
  });
}

/**
 * Logout through BFF with browser cookies + CSRF.
 * Does not print tokens or cookie values.
 */
export async function logoutBrowserSession(page: Page): Promise<APIResponse> {
  const response = await authenticatedPost(page, "/api/backend/auth/logout", {
    data: {}
  });
  expect(response.status()).toBe(CANONICAL_LOGOUT_SUCCESS_STATUS);
  return response;
}

export function assertSessionCookiesCleared(setCookieHeader: string): void {
  expect(setCookieHeader).toMatch(/maintainpro_access=/);
  expect(setCookieHeader).toMatch(/maintainpro_refresh=/);
  expect(setCookieHeader).toMatch(/maintainpro_csrf=/);
  // Cleared cookies typically have Max-Age=0 or empty value
  expect(setCookieHeader).toMatch(/maintainpro_access=(?:;|$)|Max-Age=0/i);
}