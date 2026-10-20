import { expect, test as setup } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { authDir } from "./save-gaps-auth";

const roles = [
  ["manager", "manager@maintainpro.local"],
  ["technician", "tech@maintainpro.local"],
  ["admin", "admin@maintainpro.local"],
  ["inventory", "inventory@maintainpro.local"]
] as const;

setup("sign in once per role", async ({ browser }) => {
  const password = (process.env.MAINTAINPRO_SEED_PASSWORD || "").trim();
  expect(password.length, "MAINTAINPRO_SEED_PASSWORD").toBeGreaterThan(0);
  mkdirSync(authDir, { recursive: true });

  for (const [role, email] of roles) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    let status = 0;
    for (let attempt = 0; attempt < 4 && status !== 200; attempt += 1) {
      const login = page.waitForResponse(
        (res) => res.url().includes("/api/backend/auth/login") && res.request().method() === "POST"
      );
      await page.getByRole("button", { name: /sign in/i }).click();
      status = (await login).status();
      if (status === 429) await page.waitForTimeout(5000);
    }
    expect(status === 200 || (status === 429 && existsSync(path.join(authDir, `${role}.json`))), email).toBeTruthy();
    if (status !== 200) continue;
    await context.storageState({ path: path.join(authDir, `${role}.json`) });
    await context.close();
  }
});
