import { expect, type APIResponse, type Page } from "@playwright/test";

const ACCESS_COOKIE = "maintainpro_access";
const REFRESH_COOKIE = "maintainpro_refresh";
const CSRF_COOKIE = "maintainpro_csrf";
const CSRF_HEADER = "x-csrf-token";

export async function getCsrfHeader(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === CSRF_COOKIE);
  if (!csrf?.value) {
    throw new Error("CSRF cookie missing — login may have failed.");
  }
  return { [CSRF_HEADER]: csrf.value };
}

export async function cookiePresence(page: Page) {
  const names = new Set((await page.context().cookies()).map((c) => c.name));
  return {
    access: names.has(ACCESS_COOKIE),
    refresh: names.has(REFRESH_COOKIE),
    csrf: names.has(CSRF_COOKIE)
  };
}

export async function waitForSessionCookies(page: Page, timeout = 20_000) {
  await expect
    .poll(async () => {
      const c = await cookiePresence(page);
      return c.access && c.csrf;
    }, { timeout, message: "session cookies not established after login" })
    .toBe(true);
}

export async function authenticatedGet(page: Page, path: string): Promise<APIResponse> {
  return page.request.get(path);
}

export async function authenticatedPost(
  page: Page,
  path: string,
  options?: { data?: unknown }
): Promise<APIResponse> {
  const csrf = await getCsrfHeader(page);
  return page.request.post(path, {
    data: options?.data,
    headers: csrf
  });
}

export async function authenticatedPatch(
  page: Page,
  path: string,
  options?: { data?: unknown }
): Promise<APIResponse> {
  const csrf = await getCsrfHeader(page);
  return page.request.patch(path, {
    data: options?.data,
    headers: csrf
  });
}

export async function authenticatedPut(
  page: Page,
  path: string,
  options?: { data?: unknown }
): Promise<APIResponse> {
  const csrf = await getCsrfHeader(page);
  return page.request.put(path, {
    data: options?.data,
    headers: csrf
  });
}

export async function getAuthenticatedUser(page: Page): Promise<{
  id: string;
  email?: string;
  roleName?: string;
}> {
  const response = await authenticatedGet(page, "/api/backend/auth/me");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: {
      id?: string;
      _id?: string;
      email?: string;
      role?: { name?: string } | string;
    };
  };
  const id = String(body.data?.id || body.data?._id || "").trim();
  expect(id.length).toBeGreaterThan(0);
  const role = body.data?.role;
  const roleName = typeof role === "string" ? role : role?.name;
  return { id, email: body.data?.email, roleName };
}

export async function logoutViaUi(page: Page) {
  const logout = page.getByRole("button", { name: /^Logout$/i });
  if (await logout.count()) {
    await logout.click();
  } else {
    await authenticatedPost(page, "/api/backend/auth/logout", { data: {} }).catch(() => undefined);
    await page.goto("/login");
  }
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  // Mirror product clearSession so leftover client cache cannot fake an authed shell.
  await page.evaluate(() => {
    try {
      localStorage.removeItem("maintainpro_user");
      localStorage.removeItem("maintainpro_access_token");
      localStorage.removeItem("maintainpro_refresh_token");
      localStorage.removeItem("maintainpro_active_tenant");
    } catch {
      /* ignore */
    }
  });
  await page.context().clearCookies();
}

export function unwrapData<T = Record<string, unknown>>(body: unknown): T {
  const root = body as { data?: T };
  return (root.data ?? body) as T;
}

export function unwrapList<T = Record<string, unknown>>(body: unknown): T[] {
  const root = body as {
    data?: T[] | { items?: T[]; data?: T[] };
    items?: T[];
  };
  const payload = root.data ?? root;
  if (Array.isArray(payload)) return payload;
  const nested =
    (payload as { items?: T[]; data?: T[] }).items ||
    (payload as { items?: T[]; data?: T[] }).data ||
    root.items ||
    [];
  return Array.isArray(nested) ? nested : [];
}

export async function assertNoRuntimeOverlay(page: Page) {
  await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
  await expect(page.getByText(/Unhandled Runtime Error/i)).toHaveCount(0);
  await expect(page.getByText(/Application error:/i)).toHaveCount(0);
}

export function assertNoTokensInBody(body: unknown) {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/"accessToken"\s*:/);
  expect(serialized).not.toMatch(/"refreshToken"\s*:/);
}
