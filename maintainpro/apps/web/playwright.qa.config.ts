import { defineConfig, devices } from "@playwright/test";
import { authStatePath, e2eBaseUrl, loadQaE2eEnv } from "./e2e/helpers/env";

loadQaE2eEnv();

const baseURL = e2eBaseUrl();

const qaSpecGlobs = [
  "**/smoke/**/*.spec.ts",
  "**/dashboard/**/*.spec.ts",
  "**/auth/**/*.spec.ts",
  "**/requests/**/*.spec.ts",
  "**/maintenance/**/*.spec.ts",
  "**/planning/**/*.spec.ts",
  "**/pm/**/*.spec.ts",
  "**/inspections/**/*.spec.ts",
  "**/assets/**/*.spec.ts",
  "**/fleet/**/*.spec.ts",
  "**/inventory/**/*.spec.ts",
  "**/vendors/**/*.spec.ts",
  "**/costs/**/*.spec.ts",
  "**/approvals/**/*.spec.ts",
  "**/reports/**/*.spec.ts",
  "**/admin/**/*.spec.ts",
  "**/rbac/**/*.spec.ts",
  "**/cross-module/**/*.spec.ts",
  "**/a11y/**/*.spec.ts",
  "**/responsive/**/*.spec.ts"
];

/**
 * Local production-oriented QA suite (seeded personas + running stack).
 * Does not start webServer — point at http://127.0.0.1:3001 with API on :3000.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  // Keep going so a single documented defect does not skip the remaining suite.
  maxFailures: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }]
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
      timeout: 180_000,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "unauthenticated",
      testMatch: [
        "**/smoke/login.smoke.spec.ts",
        "**/auth/session.unauth.spec.ts"
      ],
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "chromium-qa",
      dependencies: ["setup"],
      testMatch: qaSpecGlobs,
      testIgnore: [
        "**/smoke/login.smoke.spec.ts",
        "**/auth/session.unauth.spec.ts",
        "**/staging-*.spec.ts"
      ],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath("admin")
      }
    }
  ]
});
