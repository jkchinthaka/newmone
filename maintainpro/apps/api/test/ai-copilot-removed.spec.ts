import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PATH_METADATA } from "@nestjs/common/constants";

import { PredictiveAiController } from "../src/modules/predictive-ai/predictive-ai.controller";

describe("AI Copilot is removed", () => {
  it("the predictive AI module is not registered, so none of its routes are served", () => {
    const appModule = readFileSync(join(__dirname, "../src/app.module.ts"), "utf8");
    expect(appModule).not.toMatch(/import \{ PredictiveAiModule \}/);
    expect(appModule).not.toMatch(/^\s*PredictiveAiModule,\s*$/m);
  });

  it("the controller no longer declares the copilot, conversation, log or action routes", () => {
    const routes = Object.getOwnPropertyNames(PredictiveAiController.prototype)
      .filter((name) => name !== "constructor")
      .map((name) => Reflect.getMetadata(PATH_METADATA, (PredictiveAiController.prototype as Record<string, unknown>)[name] as object))
      .filter(Boolean);
    expect(routes).toEqual(["field-insights"]);
  });

  it("the web copilot screen redirects to the dashboard", () => {
    const page = readFileSync(join(__dirname, "../../web/app/(dashboard)/predictive-ai/page.tsx"), "utf8");
    expect(page).toMatch(/redirect\("\/dashboard"\)/);
    expect(page).not.toMatch(/apiClient/);
  });
});
