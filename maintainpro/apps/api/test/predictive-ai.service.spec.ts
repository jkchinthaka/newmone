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
    } as never, {
      createNotification: jest.fn()
    } as never);
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
    expect(result.response.conversationId).toBeNull();
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

  it("builds field insights from copilot context and filters by focus area", async () => {
    jest.spyOn(service, "getCopilotContext").mockResolvedValue({
      generatedAt: "2026-05-01T00:00:00.000Z",
      roleScope: "MANAGER",
      focusArea: "FLEET",
      mode: "PREDICT",
      summary: {
        activeWorkOrders: 3,
        overdueTasks: 2,
        assignedToMe: 1,
        fleetOutOfService: 1,
        utilityAnomalies: 1,
        lowStockItems: 1
      },
      maintenance: {
        activeWorkOrders: [],
        overdueWorkOrders: [
          {
            id: "wo-1",
            woNumber: "WO-1",
            title: "Replace hydraulic hose",
            priority: "HIGH",
            status: "OPEN",
            dueDate: "2026-04-30T00:00:00.000Z",
            technicianId: "tech-1"
          }
        ],
        assignedToMe: [],
        overdueSchedules: []
      },
      fleet: {
        statusCounts: {},
        overdueServiceVehicles: [
          {
            id: "veh-1",
            registrationNo: "ABC-123",
            status: "OUT_OF_SERVICE",
            nextServiceDate: "2026-04-29T00:00:00.000Z"
          }
        ],
        idleVehicles: [],
        fuelAnomalies: [
          {
            vehicleId: "veh-2",
            registrationNo: "XYZ-999",
            averageCostPerLiter: 3.2,
            globalAverageCostPerLiter: 2.6,
            variancePercent: 23.1
          }
        ]
      },
      utilities: {
        overdueBills: 0,
        anomalies: [
          {
            meterId: "meter-1",
            meterNumber: "MTR-001",
            location: "HQ",
            utilityType: "POWER",
            latestAmount: 1800,
            previousAmount: 1200,
            variancePercent: 50,
            billingMonth: "2026-04"
          }
        ]
      },
      inventory: {
        lowStockParts: [],
        projectedStockouts: [
          {
            partId: "part-1",
            partNumber: "P-100",
            name: "Oil Filter",
            quantityInStock: 4,
            avgDailyUsage: 1,
            projectedDaysLeft: 4
          }
        ]
      },
      smartSuggestions: ["Dispatch a roadside technician to the flagged vehicle."]
    } as never);

    const result = await service.getFieldInsights(
      {
        sub: "user-1",
        role: "MANAGER",
        email: "manager@example.com",
        tenantId: "tenant-1"
      },
      "FLEET",
      "PREDICT",
      "1"
    );

    expect(result.smartSuggestions).toEqual([
      "Dispatch a roadside technician to the flagged vehicle."
    ]);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0]).toMatchObject({
      category: "FLEET"
    });
  });
});