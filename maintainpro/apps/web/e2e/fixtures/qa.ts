import { test as base } from "@playwright/test";
import { authStatePath } from "../helpers/env";
import { persistRoleStorageState } from "../helpers/role-context";

/**
 * QA suite fixture: after each authenticated test, rewrite admin storageState
 * so refresh-token rotation does not poison subsequent tests.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);
    await persistRoleStorageState(page.context(), "admin");
  }
});

export { expect } from "@playwright/test";
export { authStatePath };
