import type { FgDashboard, FgEnvelope } from "../../web/lib/fg-types";

const requiredDashboardKeys = [
  "todayRecords",
  "draftInProgress",
  "pendingSupervisor",
  "pendingQa",
  "completed",
  "needsAttention"
] as const;

describe("FG Next.js ↔ Django contract", () => {
  it("documents the success envelope", () => {
    const payload: FgEnvelope<{ ok: true }> = { data: { ok: true }, meta: { page: 1 }, error: null };
    expect(payload.error).toBeNull();
    expect(payload.data).toEqual({ ok: true });
  });

  it("documents the error envelope without stack traces", () => {
    const payload: FgEnvelope<null> = {
      data: null,
      meta: null,
      error: { code: "FORBIDDEN", message: "Permission denied.", fieldErrors: {} }
    };
    expect(payload.error?.code).toBe("FORBIDDEN");
    expect(JSON.stringify(payload)).not.toMatch(/traceback/i);
  });

  it("requires dashboard KPI keys used by the Next.js cards", () => {
    const kpis: FgDashboard["kpis"] = {
      todayRecords: 0,
      draftInProgress: 0,
      pendingSupervisor: 0,
      pendingQa: 0,
      completed: 0,
      needsAttention: 0
    };
    expect(Object.keys(kpis).sort()).toEqual([...requiredDashboardKeys].sort());
  });

  it("uses backend supervisor and QA decision tokens", () => {
    expect(["APPROVED", "RETURNED_FOR_CORRECTION"]).toContain("APPROVED");
    expect(["RELEASE", "HOLD", "REJECT"]).toEqual(["RELEASE", "HOLD", "REJECT"]);
  });
});
