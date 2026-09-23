import {
  hasMeaningfulClassification,
  hasMeaningfulCompletion,
  hasMeaningfulExecution,
  hasMeaningfulPlanning,
  hasMeaningfulSafety,
  preferExtensionValue,
  syncWorkOrderExtensions,
  type WorkOrderExtensionSource
} from "../src/modules/work-orders/work-order-extension-sync.util";

describe("DB-3 work order extension dual-write", () => {
  const base: WorkOrderExtensionSource = {
    id: "wo-1",
    tenantId: "tenant-1"
  };

  it("does not treat empty WorkOrder as meaningful for any extension", () => {
    expect(hasMeaningfulPlanning(base)).toBe(false);
    expect(hasMeaningfulExecution(base)).toBe(false);
    expect(hasMeaningfulCompletion(base)).toBe(false);
    expect(hasMeaningfulSafety(base)).toBe(false);
    expect(hasMeaningfulClassification(base)).toBe(false);
  });

  it("detects planning when expectedCompletionDate is set", () => {
    expect(
      hasMeaningfulPlanning({ ...base, expectedCompletionDate: new Date("2026-10-01") })
    ).toBe(true);
  });

  it("detects safety when lotoRequired is true (boolean true is meaningful)", () => {
    expect(hasMeaningfulSafety({ ...base, lotoRequired: true })).toBe(true);
    expect(hasMeaningfulSafety({ ...base, lotoRequired: false })).toBe(false);
  });

  it("preferExtensionValue uses null semantics, not truthiness", () => {
    expect(preferExtensionValue({ id: "x" }, false, true)).toBe(false);
    expect(preferExtensionValue({ id: "x" }, 0, 9)).toBe(0);
    expect(preferExtensionValue({ id: "x" }, "", "legacy")).toBe("");
    expect(preferExtensionValue(null, false, true)).toBe(true);
    expect(preferExtensionValue(undefined, 0, 9)).toBe(9);
  });

  it("upserts planning when meaningful and skips empty groups", async () => {
    const calls: string[] = [];
    const db = {
      workOrderPlanning: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => {
          calls.push("planning");
          return {};
        })
      },
      workOrderExecution: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => {
          calls.push("execution");
          return {};
        })
      },
      workOrderCompletion: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => {
          calls.push("completion");
          return {};
        })
      },
      workOrderSafety: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => {
          calls.push("safety");
          return {};
        })
      },
      workOrderClassification: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => {
          calls.push("classification");
          return {};
        })
      }
    };

    const result = await syncWorkOrderExtensions(db as never, {
      ...base,
      expectedCompletionDate: new Date("2026-10-01"),
      isTriage: true
    });

    expect(result.planning).toBe(true);
    expect(result.classification).toBe(true);
    expect(result.execution).toBe(false);
    expect(result.completion).toBe(false);
    expect(result.safety).toBe(false);
    expect(calls).toEqual(["planning", "classification"]);
    expect(db.workOrderPlanning.upsert).toHaveBeenCalledTimes(1);
    expect(db.workOrderClassification.upsert).toHaveBeenCalledTimes(1);
  });

  it("updates existing extension even if current snapshot looks empty", async () => {
    const db = {
      workOrderPlanning: {
        findUnique: jest.fn(async () => ({ id: "p1" })),
        upsert: jest.fn(async () => ({}))
      },
      workOrderExecution: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => ({}))
      },
      workOrderCompletion: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => ({}))
      },
      workOrderSafety: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => ({}))
      },
      workOrderClassification: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => ({}))
      }
    };

    const result = await syncWorkOrderExtensions(db as never, base);
    expect(result.planning).toBe(true);
    expect(db.workOrderPlanning.upsert).toHaveBeenCalledTimes(1);
  });
});
