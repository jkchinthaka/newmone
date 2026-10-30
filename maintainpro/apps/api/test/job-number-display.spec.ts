import {
  displayJobNumbers,
  displayJobNumbersDeep,
  normalizeJobNumberInput,
  storedJobNumberInput
} from "../src/common/job-number-display";
import { normalizeDecimals } from "../src/common/interceptors/response.interceptor";

describe("job order numbers are shown as JO-", () => {
  it("rewrites stored job numbers in text and leaves other codes alone", () => {
    expect(displayJobNumbers("WO-2026-00012")).toBe("JO-2026-00012");
    expect(displayJobNumbers("Job WO-2026-00012 assigned; see WO-2026-00013.")).toBe("Job JO-2026-00012 assigned; see JO-2026-00013.");
    expect(displayJobNumbers("WO-FU-LX12AB")).toBe("JO-FU-LX12AB");
    expect(displayJobNumbers("Asset WO-12 and SWO-2026-1")).toBe("Asset WO-12 and SWO-2026-1");
    expect(displayJobNumbers(null)).toBeNull();
  });

  it("walks plain objects and arrays, and keeps Dates", () => {
    const at = new Date("2026-10-30T00:00:00.000Z");
    const out = displayJobNumbersDeep({ items: [{ woNumber: "WO-2026-00001", at }], note: "x" });
    expect(out).toEqual({ items: [{ woNumber: "JO-2026-00001", at }], note: "x" });
    expect(out.items[0].at).toBe(at);
  });

  it("is applied to every API response", () => {
    expect(normalizeDecimals({ data: { woNumber: "WO-2026-00007", title: "Pump", workOrder: { woNumber: "WO-2026-00008" } } })).toEqual({
      data: { woNumber: "JO-2026-00007", title: "Pump", workOrder: { woNumber: "JO-2026-00008" } }
    });
  });
});

describe("a typed or scanned JO- number finds the stored WO- record", () => {
  it("converts full and partial numbers", () => {
    expect(storedJobNumberInput("JO-2026-00012")).toBe("WO-2026-00012");
    expect(storedJobNumberInput("jo-2026-00012")).toBe("WO-2026-00012");
    expect(storedJobNumberInput("JO-20", { partial: true })).toBe("WO-20");
    expect(storedJobNumberInput("JO-20")).toBe("JO-20");
    expect(storedJobNumberInput("John")).toBe("John");
  });

  it("rewrites search and reference fields only", () => {
    const request = {
      query: { search: "JO-2026-0001", status: "JO-2026-0001", page: "1" },
      body: { code: "JO-2026-00005", workOrderId: "JO-2026-00006", description: "see JO-2026-00001" }
    };
    normalizeJobNumberInput(request);
    expect(request.query).toEqual({ search: "WO-2026-0001", status: "JO-2026-0001", page: "1" });
    expect(request.body).toEqual({ code: "WO-2026-00005", workOrderId: "WO-2026-00006", description: "see JO-2026-00001" });
    expect(() => normalizeJobNumberInput({ query: undefined, body: [1, 2] })).not.toThrow();
  });
});
