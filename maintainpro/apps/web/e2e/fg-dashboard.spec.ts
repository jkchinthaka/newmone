import { test } from "@playwright/test";

/**
 * Full CL18/CL24/CL30 recorder → supervisor → QA → history → print paths require a
 * disposable FG Django API. This suite stays skipped until FG_E2E=1 and a local FG
 * backend are available. Do not treat skip as PASS.
 */
const fgE2eEnabled = process.env.FG_E2E === "1";

test.describe("FG Digital Records browser smoke", () => {
  test.skip(!fgE2eEnabled, "MANUAL_VALIDATION_PENDING: disposable FG backend is not configured (set FG_E2E=1).");

  test("login / SSO / dashboard / CL24 open", async () => {
    test.fail(true, "Executable only against a disposable FG stack");
  });
});
