import type { Browser, BrowserContext, Page } from "@playwright/test";
import { authStatePath, type QaRole } from "./env";

/**
 * Persist rotated session cookies back to the role storageState file.
 * Required because refresh-token rotation invalidates the prior refresh token;
 * the next test must not replay a rotated token (reuse detection → 401 cascade).
 */
export async function persistRoleStorageState(
  context: BrowserContext,
  role: QaRole
): Promise<void> {
  try {
    const probe =
      context.pages()[0] ??
      (await context.newPage());
    const me = await probe.request.get("/api/backend/auth/me");
    if (me.status() !== 200) return;
    await context.storageState({ path: authStatePath(role) });
  } catch {
    /* ignore — do not fail the test on persistence */
  }
}

export async function openRoleContext(
  browser: Browser,
  role: QaRole
): Promise<{ page: Page; context: BrowserContext; close: () => Promise<void> }> {
  const context = await browser.newContext({ storageState: authStatePath(role) });
  const page = await context.newPage();
  return {
    page,
    context,
    close: async () => {
      await persistRoleStorageState(context, role);
      await context.close();
    }
  };
}
