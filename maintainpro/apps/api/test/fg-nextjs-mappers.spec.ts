import {
  controlledFormOpenAction,
  mapDashboardKpis,
  parseFgEnvelope,
  safeFgErrorMessage,
  stableActionKey,
  statusTone
} from "../../web/lib/fg-mappers";

describe("FG Next.js presentation mappers", () => {
  it("maps dashboard KPIs from actual payload fields only", () => {
    expect(mapDashboardKpis({ todayRecords: 2, pendingQa: 1 } as never)).toEqual({
      todayRecords: 2,
      draftInProgress: 0,
      pendingSupervisor: 0,
      pendingQa: 1,
      completed: 0,
      needsAttention: 0
    });
  });

  it("opens CL18/CL24/CL30 as today's idempotent record, not a client occurrence token", () => {
    expect(controlledFormOpenAction({ code: "NMS/PPU/CL/18", multiplicity: "one_per_day", statusLabel: "NOT STARTED" }).kind).toBe(
      "openToday"
    );
    expect(controlledFormOpenAction({ code: "NMS/PPU/CL/24", multiplicity: "one_per_day", statusLabel: "IN PROGRESS" }).kind).toBe(
      "openToday"
    );
    expect(controlledFormOpenAction({ code: "NMS/PPU/CL/30", multiplicity: "one_per_day", statusLabel: "NOT STARTED" }).label).toContain(
      "inspection"
    );
  });

  it("parses the documented envelope and hides internal exception text", () => {
    const parsed = parseFgEnvelope({
      data: { ok: true },
      meta: {},
      error: { code: "VALIDATION", message: "OperationalError: secret password traceback" }
    });
    expect(parsed.data).toEqual({ ok: true });
    expect(parsed.error?.code).toBe("VALIDATION");
    expect(safeFgErrorMessage(parsed.error?.message)).not.toMatch(/traceback|secret|password/i);
  });

  it("keeps the same idempotency key for a retry of the same action", () => {
    const first = stableActionKey("submit", "record-1");
    const second = stableActionKey("submit", "record-1");
    expect(first).toBe(second);
  });

  it("does not communicate status by invented colors only — tone is paired with labels", () => {
    expect(statusTone("COMPLETED")).toBe("success");
    expect(statusTone("NEEDS ATTENTION")).toBe("danger");
    expect(statusTone("NOT STARTED")).toBe("neutral");
  });
});
