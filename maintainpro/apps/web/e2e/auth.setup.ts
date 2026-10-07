import { expect, test as setup } from "@playwright/test";
import fs from "node:fs";
import { loginViaUi } from "./helpers/auth";
import { AUTH_DIR, authStatePath, loadQaE2eEnv, type QaRole } from "./helpers/env";
import { authenticatedGet, cookiePresence } from "./helpers/session";

loadQaE2eEnv();

const roles: QaRole[] = [
  "superadmin",
  "admin",
  "manager",
  "tech",
  "security",
  "inventory"
];

setup.describe.configure({ mode: "serial" });
setup.setTimeout(240_000);

const FORCE_AUTH = /^(1|true|yes)$/i.test((process.env.E2E_FORCE_AUTH || "").trim());
/** Minimum gap between persona logins when a fresh login is required (throttle safety). */
const LOGIN_GAP_MS = Number(process.env.E2E_AUTH_LOGIN_GAP_MS || 8_000);
/**
 * Max age for reusing storageState without re-login.
 * Keep well under JWT access TTL (15m) so a full suite (~8m) does not rely on
 * mid-run refresh rotation against a stale shared refresh token file.
 */
const MAX_REUSE_AGE_MS = Number(process.env.E2E_AUTH_MAX_REUSE_MS || 4 * 60_000);

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function storageStateAgeMs(target: string): number {
  if (!fs.existsSync(target)) return Number.POSITIVE_INFINITY;
  return Date.now() - fs.statSync(target).mtimeMs;
}

async function storageStateStillValid(page: import("@playwright/test").Page, role: QaRole) {
  const target = authStatePath(role);
  if (!fs.existsSync(target) || fs.statSync(target).size < 50) return false;
  if (storageStateAgeMs(target) > MAX_REUSE_AGE_MS) return false;
  try {
    await page.context().clearCookies();
    const raw = JSON.parse(fs.readFileSync(target, "utf8")) as {
      cookies?: Array<{ name: string; value: string; domain: string; path: string }>;
    };
    const cookies = (raw.cookies || []).filter((c) => c.name && c.value);
    if (!cookies.length) return false;
    await page.context().addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || "127.0.0.1",
        path: c.path || "/"
      }))
    );
    const me = await authenticatedGet(page, "/api/backend/auth/me");
    return me.status() === 200;
  } catch {
    return false;
  } finally {
    await page.context().clearCookies();
  }
}

for (const role of roles) {
  setup(`authenticate ${role}`, async ({ page }) => {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const target = authStatePath(role);

    if (!FORCE_AUTH && (await storageStateStillValid(page, role))) {
      // Reuse existing storageState — no login call (avoids 429 on rapid suite re-runs).
      expect(fs.existsSync(target), `storage state missing for ${role}`).toBe(true);
      return;
    }

    await sleep(LOGIN_GAP_MS);
    await loginViaUi(page, role);

    const me = await authenticatedGet(page, "/api/backend/auth/me");
    expect(me.status(), `${role} /auth/me`).toBe(200);
    const cookies = await cookiePresence(page);
    expect(cookies.access, `${role} access cookie`).toBe(true);
    expect(cookies.csrf, `${role} csrf cookie`).toBe(true);

    await page.context().storageState({ path: target });
    expect(fs.existsSync(target), `storage state missing for ${role}`).toBe(true);
    const size = fs.statSync(target).size;
    expect(size, `empty storage state for ${role}`).toBeGreaterThan(50);

    await page.context().clearCookies();
  });
}
