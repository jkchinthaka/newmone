import { Logger } from "@nestjs/common";

import { PredictiveAiService } from "../src/modules/predictive-ai/predictive-ai.service";

describe("PredictiveAiService", () => {
  const prisma = {
    predictiveLog: {
      findMany: jest.fn()
    }
  };

  let configValues: Record<string, string | undefined>;
  let service: PredictiveAiService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    configValues = {};
    originalFetch = global.fetch;

    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    service = new PredictiveAiService(prisma as never, {
      get: jest.fn((key: string) => configValues[key])
    } as never, {} as never, {} as never, {} as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns a built-in fallback when the assistant is not configured", async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await service.copilotChat({
      message: "Say hello to MaintainPro in one short sentence.",
      focusArea: "GENERAL",
      mode: "CHAT",
      markdown: true
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.response.conversationId).toMatch(/^local-/);
    expect(result.response.text).toContain("Hello from MaintainPro");
    expect(result.response.raw).toMatchObject({
      source: "maintainpro-local-fallback",
      code: "assistant_not_configured"
    });
  });

  it("returns a built-in fallback when the upstream provider rejects the request", async () => {
    configValues.RAPIDAPI_COPILOT_API_KEY = "test-key";
    configValues.RAPIDAPI_COPILOT_HOST = "copilot5.p.rapidapi.com";

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "You are not subscribed to this API." })
    } as Response) as unknown as typeof fetch;

    const result = await service.copilotChat({
      message: "How should I prioritize overdue preventive maintenance work orders?",
      focusArea: "MAINTENANCE",
      mode: "CHAT",
      markdown: true
    });

    expect(result.response.raw).toMatchObject({
      source: "maintainpro-local-fallback",
      code: "upstream_403",
      reason: "You are not subscribed to this API."
    });
    expect(result.response.text).toContain("Built-in MaintainPro guidance for maintenance operations");
  });

  it("returns the upstream assistant response when the provider succeeds", async () => {
    configValues.RAPIDAPI_COPILOT_API_KEY = "test-key";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          conversation_id: "conv-123",
          data: {
            text: "Upstream assistant reply"
          }
        })
    } as Response) as unknown as typeof fetch;

    const result = await service.copilotChat({
      message: "Give me a dispatch playbook for handling a live vehicle breakdown.",
      focusArea: "FLEET",
      mode: "CHAT",
      markdown: true
    });

    expect(result.response.conversationId).toBe("conv-123");
    expect(result.response.text).toBe("Upstream assistant reply");
  });
});