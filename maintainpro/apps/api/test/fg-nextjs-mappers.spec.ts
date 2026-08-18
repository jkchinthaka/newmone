import {
  consumeOccurrenceIntent,
  formUsesIndependentOccurrences,
  getOrCreateOccurrenceToken
} from "../../web/lib/fg-occurrence";
import {
  controlledFormOpenAction,
  fieldErrorsFor,
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

  it("opens CL24 as today's one-per-day record", () => {
    expect(
      controlledFormOpenAction({ code: "NMS/PPU/CL/24", multiplicity: "one_per_day", statusLabel: "IN PROGRESS" }).kind
    ).toBe("openToday");
  });

  it("opens CL18/CL30 as independent occurrences even if a stale API says one_per_day", () => {
    expect(
      controlledFormOpenAction({ code: "NMS/PPU/CL/18", multiplicity: "one_per_day", statusLabel: "NOT STARTED" }).kind
    ).toBe("newOccurrence");
    expect(
      controlledFormOpenAction({ code: "NMS/PPU/CL/30", multiplicity: "one_per_day", statusLabel: "NOT STARTED" }).kind
    ).toBe("newOccurrence");
    expect(formUsesIndependentOccurrences("NMS/PPU/CL/18")).toBe(true);
    expect(formUsesIndependentOccurrences("NMS/PPU/CL/30")).toBe(true);
    expect(formUsesIndependentOccurrences("NMS/PPU/CL/24")).toBe(false);
  });

  it("reuses an in-flight occurrence token on retry and mints a new token after consume", () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      }
    };
    const first = getOrCreateOccurrenceToken("NMS/PPU/CL/18", "2026-08-18", adapter);
    const retry = getOrCreateOccurrenceToken("NMS/PPU/CL/18", "2026-08-18", adapter);
    expect(retry).toBe(first);
    consumeOccurrenceIntent("NMS/PPU/CL/18", "2026-08-18", adapter);
    const nextAction = getOrCreateOccurrenceToken("NMS/PPU/CL/18", "2026-08-18", adapter);
    expect(nextAction).not.toBe(first);
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

  it("reads structured fieldErrors from the FG envelope", () => {
    expect(
      fieldErrorsFor(
        { code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors: { temperature: ["Required"] } },
        "temperature"
      )
    ).toEqual(["Required"]);
  });
});
