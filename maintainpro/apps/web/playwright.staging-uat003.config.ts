import { defineConfig, devices } from "@playwright/test";

const stagingWeb = (process.env.MAINTAINPRO_WEB_URL ?? process.env.STAGING_WEB_URL ?? "").replace(
  /\/+$/,
  ""
);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "staging-uat-003.spec.ts",
  timeout: 180_000,
  expect: {
    timeout: 60_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: stagingWeb || "https://newmone.chinthakajayaweera1.workers.dev",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
